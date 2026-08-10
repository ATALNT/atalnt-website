import { useState, useEffect, useCallback } from 'react';
import { Voicemail, Users, Send, Loader2, RefreshCw, X, AlertCircle, ClipboardList, CheckCircle2 } from 'lucide-react';

// ─── Sourcing dial companion ────────────────────────────────────────────────
// Recruiters paste the candidates they called and left voicemails for. Each one
// becomes a lead in that recruiter's ISOLATED: Instantly campaign and gets the
// 4-email sequence the team already wrote, from the recruiter's own mailbox.
//
// Everything comes from the paste — nothing is selected here. Columns, any order:
//   job title | candidate first name | email 1, email 2, email 3... | rep name
// A candidate with several addresses on file becomes one lead per address, so
// the sequence reaches them wherever they actually read mail. One paste can
// cover several recruiters at once.

const REPS = [
  { key: 'mikee', name: 'Mikee' },
  { key: 'dee', name: 'Dee' },
  { key: 'jeet', name: 'Jeet' },
  { key: 'remishka', name: 'Remishka' },
  { key: 'kelona', name: 'Kelona' },
  { key: 'jessica', name: 'Jessica' },
] as const;

type RepKey = (typeof REPS)[number]['key'];

// Chunk size for the queue call. Each lead costs two Instantly requests (dedupe
// + create) and the workspace is capped at 20/minute, so keep batches small
// enough to finish inside the function timeout.
const CHUNK = 10;

// One pasted line = one candidate, which may carry several addresses on file.
type Row = {
  rep: string; // resolved rep key, or '' when the recruiter was not recognised
  repRaw: string; // what the paste actually said, for the error message
  firstName: string;
  jobTitle: string;
  emails: string[]; // valid + deduped; each becomes its own lead
  badEmails: string[]; // non-empty but malformed, surfaced so nothing vanishes quietly
  dupeEmails: string[]; // valid but already claimed by an earlier row in this paste
  valid: boolean;
  reason?: string;
};

const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Every outcome the API can return, in the order worth reading. Listed here so
// the results panel reports all of them rather than a bare "n failed".
const OUTCOMES: { key: string; label: string; tone: string }[] = [
  { key: 'added', label: 'Queued', tone: 'text-emerald-400/90' },
  { key: 'skipped_duplicate', label: 'Already in Instantly', tone: 'text-white/45' },
  { key: 'skipped_unverified', label: 'Failed address check', tone: 'text-amber-400/80' },
  { key: 'skipped_campaign_not_ready', label: 'Sequence not ready', tone: 'text-amber-400/80' },
  { key: 'skipped_bad_email', label: 'Malformed email', tone: 'text-white/45' },
  { key: 'skipped_no_first_name', label: 'No first name', tone: 'text-white/45' },
  { key: 'skipped_no_job_title', label: 'No job title', tone: 'text-white/45' },
  { key: 'skipped_unknown_recruiter', label: 'Unknown recruiter', tone: 'text-white/45' },
  { key: 'failed_create', label: 'Rejected by Instantly', tone: 'text-red-400/70' },
  { key: 'failed_activate', label: 'Campaign would not activate', tone: 'text-red-400/70' },
  { key: 'failed_request', label: 'Request failed', tone: 'text-red-400/70' },
];

// Resolve whatever the recruiter column says to a rep key: "Mikee", "mikee",
// "Mikee Gagarin", "mikee@atalntrecruiting.com" all land on the same person.
function resolveRep(raw: string): string {
  const v = (raw || '').trim().toLowerCase();
  if (!v) return '';
  const local = v.includes('@') ? v.split('@')[0] : v;
  const first = local.split(/[\s.]+/)[0];
  const hit = REPS.find((r) => r.key === first || r.key === local || r.name.toLowerCase() === first);
  return hit ? hit.key : '';
}

// ─── Paste parsing ──────────────────────────────────────────────────────────
// Handles tab-separated (copied straight out of Excel), CSV, and 2+ space
// separated pastes, with or without a header row.
function parsePaste(raw: string): Row[] {
  const text = raw.replace(/\r\n?/g, '\n').trim();
  if (!text) return [];
  const lines = text.split('\n').filter((l) => l.trim());
  if (!lines.length) return [];

  const delim = lines.some((l) => l.includes('\t')) ? '\t' : lines[0].includes(',') ? ',' : '  ';
  const parseLine = (line: string): string[] => {
    if (delim === '\t') return line.split('\t');
    if (delim === '  ') return line.split(/\s{2,}/);
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };

  const firstCells = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const looksLikeHeader =
    !firstCells.some((h) => EMAIL_RE.test(h)) &&
    firstCells.some((h) =>
      ['recruiter', 'first name', 'firstname', 'email', 'job title', 'jobtitle', 'title', 'personalization'].some((f) => h.includes(f))
    );

  // Column positions are only ever a HINT, taken from an explicit header row.
  // Every value is ultimately confirmed by what the cell contains, because real
  // spreadsheet copies arrive with ragged delimiters: one row carrying an extra
  // tab used to shift that row's columns and, since positions were chosen once
  // for the whole paste, corrupt every other row with it.
  let dataLines: string[];
  let col = { rep: -1, first: -1, job: -1 };

  if (looksLikeHeader) {
    const header = firstCells;
    const find = (...frags: string[]) => {
      for (const f of frags) {
        const i = header.findIndex((h) => h.includes(f));
        if (i !== -1) return i;
      }
      return -1;
    };
    // Recruiter before candidate: "recruiter first name" contains "first name"
    // too, so claim the recruiter column first and exclude it afterwards.
    const repCol = find('recruiter', 'rep name', 'rep', 'sender', 'sent by', 'owner', 'assigned');
    const jobCol = find('job title', 'jobtitle', 'personalization', 'role', 'position', 'title');
    let firstCol = -1;
    for (let i = 0; i < header.length; i++) {
      if (i === repCol || i === jobCol) continue;
      if (header[i].includes('first') || header[i].includes('candidate') || header[i].includes('name')) {
        firstCol = i;
        break;
      }
    }
    col = { rep: repCol, first: firstCol, job: jobCol };
    dataLines = lines.slice(1);
  } else {
    dataLines = lines;
  }

  // Job titles repeat down a list; candidate names do not. Used only to break a
  // tie when a row's two leftover cells are both single words, e.g. the title
  // "Dispatcher" sitting next to the name "Marcus".
  const leftoverCounts = new Map<string, number>();
  for (const line of dataLines) {
    for (const raw of parseLine(line)) {
      const c = raw.trim();
      if (!c || c.includes('@') || resolveRep(c)) continue;
      leftoverCounts.set(c.toLowerCase(), (leftoverCounts.get(c.toLowerCase()) || 0) + 1);
    }
  }
  const repeats = (v: string) => leftoverCounts.get(v.toLowerCase()) || 0;

  // Classify one row purely by cell content. Addresses and the six recruiter
  // names are unmistakable, so whatever is left is at most a name and a title.
  const classify = (cells: string[]) => {
    const nonEmpty = cells.map((c) => c.trim()).filter(Boolean);
    const emails = nonEmpty.filter((c) => EMAIL_RE.test(c));
    // A cell with an @ that fails the pattern is a broken address, not a name.
    // Deliberately only the @ test: anything looser misreads hyphenated names
    // like "Mary-Jane" as a malformed address.
    const badEmails = nonEmpty.filter((c) => !EMAIL_RE.test(c) && c.includes('@'));
    const repRaw = nonEmpty.find((c) => !c.includes('@') && resolveRep(c)) || '';
    const rest = nonEmpty.filter((c) => !c.includes('@') && c !== repRaw);

    let jobTitle = '';
    let firstName = '';
    if (rest.length === 1) {
      if (/\s/.test(rest[0])) jobTitle = rest[0];
      else firstName = rest[0];
    } else if (rest.length >= 2) {
      const ranked = [...rest].sort(
        (a, b) =>
          b.split(/\s+/).length - a.split(/\s+/).length || repeats(b) - repeats(a) || b.length - a.length
      );
      jobTitle = ranked[0];
      firstName = rest.find((c) => c !== jobTitle) || '';
    }
    return { emails, badEmails, repRaw, jobTitle, firstName };
  };

  const rows: Row[] = [];
  // Addresses already claimed earlier in this paste. The same person often
  // appears on two recruiters' lists; whoever is listed first keeps them, so a
  // candidate is never emailed twice from two different mailboxes.
  const seenEmails = new Set<string>();

  for (const line of dataLines) {
    const cells = parseLine(line);
    const get = (i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : '');
    const guess = classify(cells);

    // Trust a header position only when the cell it points at actually holds
    // that kind of value. On a ragged row the header points at the wrong cell,
    // so fall through to what the content says instead of importing the shift.
    // Keep an unrecognised header value as a last resort so the row can say
    // unknown recruiter "Bob" rather than the far less useful "missing recruiter".
    const headerRep = get(col.rep);
    const repRaw = resolveRep(headerRep) ? headerRep : guess.repRaw || headerRep;

    const headerFirst = get(col.first);
    const firstName = headerFirst && !headerFirst.includes('@') && !resolveRep(headerFirst) ? headerFirst : guess.firstName;

    const headerJob = get(col.job);
    const jobTitle = headerJob && !headerJob.includes('@') && !resolveRep(headerJob) ? headerJob : guess.jobTitle;

    // Addresses are always taken from content: EMAIL_RE is definitive, so a
    // column index could only ever lose one.
    const emails: string[] = [];
    const dupeEmails: string[] = [];
    for (const addr of guess.emails) {
      const key = addr.toLowerCase();
      if (seenEmails.has(key)) {
        dupeEmails.push(addr);
        continue;
      }
      seenEmails.add(key);
      emails.push(addr);
    }
    const badEmails = guess.badEmails;

    const row: Row = {
      rep: resolveRep(repRaw),
      repRaw,
      firstName,
      jobTitle,
      emails,
      badEmails,
      dupeEmails,
      valid: true,
    };

    if (!emails.length) {
      row.valid = false;
      // Say which it was: missing data and already-claimed data are very
      // different problems for whoever is fixing the sheet.
      if (dupeEmails.length) row.reason = 'address already used by an earlier row';
      else if (badEmails.length) row.reason = 'no valid email';
      else row.reason = 'no email on file';
    } else if (!row.firstName) {
      row.valid = false;
      row.reason = 'missing first name';
    } else if (!row.rep) {
      row.valid = false;
      row.reason = repRaw ? `unknown recruiter "${repRaw}"` : 'missing recruiter';
    } else if (!row.jobTitle) {
      row.valid = false;
      row.reason = 'missing job title';
    }
    rows.push(row);
  }

  // Nothing address-shaped anywhere: this is not a candidate list. Return empty
  // so the UI shows the "no email column found" hint rather than a table of
  // rows all failing for the same reason.
  if (!rows.some((r) => r.emails.length || r.badEmails.length || r.dupeEmails.length)) return [];
  return rows;
}

// ─── Component ──────────────────────────────────────────────────────────────
export function SourcingDialer({ token }: { token: string }) {
  const [paste, setPaste] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<any[]>([]);
  const [submitError, setSubmitError] = useState('');

  const [status, setStatus] = useState<any[]>([]);
  const [statusErr, setStatusErr] = useState('');
  const [statusLoading, setStatusLoading] = useState(true);
  const [readiness, setReadiness] = useState<Record<string, { ready: boolean; missing: string[] }>>({});

  const [queueRep, setQueueRep] = useState<RepKey>('remishka');
  // Default to people still due an email. Finished, replied and bounced rows are
  // the bulk of the list and are not something anyone needs to act on.
  const [pendingOnly, setPendingOnly] = useState(true);
  const [queue, setQueue] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/instantly/dialer?action=status', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      setStatus(d.reps || []);
      setStatusErr('');
    } catch {
      setStatusErr('Could not load campaign status from Instantly.');
    }
    setStatusLoading(false);
  }, [token]);

  const loadReadiness = useCallback(async () => {
    try {
      const res = await fetch('/api/instantly/dialer?action=readiness', { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      const map: Record<string, { ready: boolean; missing: string[] }> = {};
      for (const r of d.reps || []) map[r.rep] = { ready: !!r.ready, missing: r.missing || [] };
      setReadiness(map);
    } catch {
      /* readiness is advisory in the UI; the server re-checks before creating anything */
    }
  }, [token]);

  // Clear long-finished leads out of Instantly once when the tab opens, then
  // load. Totals are read from the email log so they survive the purge.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetch('/api/instantly/dialer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'purge' }),
        });
      } catch {
        /* housekeeping only; never block the dashboard on it */
      }
      if (cancelled) return;
      loadStatus();
      loadReadiness();
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loadStatus, loadReadiness]);

  const loadQueue = useCallback(
    async (r: RepKey) => {
      setQueueLoading(true);
      try {
        const res = await fetch(`/api/instantly/dialer?action=list&rep=${r}`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await res.json();
        setQueue(d.leads || []);
      } catch {
        setQueue([]);
      }
      setQueueLoading(false);
    },
    [token]
  );

  useEffect(() => {
    loadQueue(queueRep);
  }, [queueRep, loadQueue]);

  const removeLead = async (id: string) => {
    if (deleting[id]) return;
    setDeleting((m) => ({ ...m, [id]: true }));
    try {
      const res = await fetch('/api/instantly/dialer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete', id }),
      });
      if (res.ok) {
        setQueue((q) => q.filter((l) => l.id !== id));
        loadStatus();
      }
    } finally {
      setDeleting((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
    }
  };

  const handlePaste = (text: string) => {
    setPaste(text);
    setRows(parsePaste(text));
    setResults([]);
    setSubmitError('');
  };

  const validRows = rows.filter((r) => r.valid);
  // Rows whose recruiter's sequence still needs fields a paste cannot fill.
  const blocked = validRows.filter((r) => readiness[r.rep] && !readiness[r.rep].ready);
  const sendable = validRows.filter((r) => !readiness[r.rep] || readiness[r.rep].ready);
  const blockedReps = [...new Set(blocked.map((r) => r.rep))];

  // A candidate with three addresses on file becomes three leads. Everything the
  // recruiter is shown counts leads, because that is what actually gets sent.
  const leads = sendable.flatMap((r) =>
    r.emails.map((email) => ({ rep: r.rep, firstName: r.firstName, email, jobTitle: r.jobTitle }))
  );
  const byRep = leads.reduce((m: Record<string, number>, l) => {
    m[l.rep] = (m[l.rep] || 0) + 1;
    return m;
  }, {});
  const extraAddresses = leads.length - sendable.length;

  const submit = async () => {
    if (!leads.length || running) return;
    setRunning(true);
    setResults([]);
    setSubmitError('');
    setProgress({ done: 0, total: leads.length });

    const all: any[] = [];
    for (let i = 0; i < leads.length; i += CHUNK) {
      const chunk = leads.slice(i, i + CHUNK);
      try {
        const res = await fetch('/api/instantly/dialer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'add', leads: chunk }),
        });
        const d = await res.json();
        if (!res.ok) {
          setSubmitError(d?.error || `Request failed (${res.status})`);
          break;
        }
        all.push(...(d.results || []));
      } catch {
        all.push(...chunk.map((c) => ({ email: c.email, rep: c.rep, outcome: 'failed_request' })));
      }
      setProgress({ done: Math.min(i + CHUNK, leads.length), total: leads.length });
      setResults([...all]);
    }
    setRunning(false);
    loadStatus();
    loadQueue(queueRep);
  };

  const counts = results.reduce((m: Record<string, number>, r) => {
    m[r.outcome] = (m[r.outcome] || 0) + 1;
    return m;
  }, {});
  // What the verifier said, across everything submitted.
  const verifyCounts: Record<string, number> = {};
  for (const r of results) {
    if (r.verifyStatus) verifyCounts[r.verifyStatus] = (verifyCounts[r.verifyStatus] || 0) + 1;
  }
  const failedRows = results.filter((r) => r.outcome !== 'added');

  const fmtDate = (iso: string | null) => {
    if (!iso) return '–';
    const d = new Date(iso);
    const now = new Date();
    const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return d.toDateString() === now.toDateString()
      ? `Today ${t}`
      : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${t}`;
  };

  const stateLabel: Record<string, string> = {
    queued: 'Queued',
    in_sequence: 'In sequence',
    done: 'Completed',
    replied: 'Replied',
    bounced: 'Bounced',
  };
  const stateColor: Record<string, string> = {
    queued: 'text-white/50',
    in_sequence: 'text-blue-300/80',
    done: 'text-white/40',
    replied: 'text-emerald-400/90',
    bounced: 'text-red-400/70',
  };
  const repName = (k: string) => REPS.find((r) => r.key === k)?.name || k;
  // Pending = still due an email. Everything else is history.
  const visibleQueue = pendingOnly ? queue.filter((l) => l.state === 'queued' || l.state === 'in_sequence') : queue;

  return (
    <div className="space-y-6">
      {/* ── Per-recruiter status ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(status.length ? status : REPS.map((r) => ({ rep: r.key, name: r.name }))).map((s: any) => {
          const rd = readiness[s.rep];
          return (
            <div key={s.rep} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#D4A853]" />
                  {s.name || s.rep}
                </p>
                <span className="text-[10px] text-white/25 truncate">{s.email || ''}</span>
              </div>
              {/* "Pending" is people still due to receive something. It used to
                  print Instantly's raw lead count, which included bounced and
                  finished rows and read far higher than reality. */}
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-white">{statusLoading ? '–' : s.queued ?? '–'}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">pending</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">
                    {statusLoading ? '–' : s.sentToday ?? '–'}
                    <span className="text-white/30 text-xs">/{s.dailyCap ?? 30}</span>
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">sent today</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{statusLoading ? '–' : s.completedTotal ?? '–'}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">completed</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-400/90">{statusLoading ? '–' : s.replies ?? '–'}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">replies</p>
                </div>
              </div>

              {/* Intake: how many candidates this recruiter actually loaded. */}
              <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[11px]">
                <span className="uppercase tracking-wider text-white/25">added</span>
                <span className="text-white/45">
                  today <span className="text-white/80 font-semibold">{s.addedToday ?? 0}</span>
                  {' · '}yest <span className="text-white/80 font-semibold">{s.addedYesterday ?? 0}</span>
                  {' · '}7d <span className="text-white/80 font-semibold">{s.added7d ?? 0}</span>
                  {' · '}30d <span className="text-white/80 font-semibold">{s.added30d ?? 0}</span>
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-white/25">
                  sent 7d <span className="text-white/60 font-semibold">{s.sentWeek ?? 0}</span> · 30d{' '}
                  <span className="text-white/60 font-semibold">{s.sentMonth ?? 0}</span>
                  {s.bounced ? <span className="text-red-400/70"> · {s.bounced} bounced</span> : null}
                </span>
                {s.mailboxScore != null && (
                  <span className={s.mailboxScore < 97 ? 'text-amber-400/80' : 'text-emerald-400/70'}>health {s.mailboxScore}</span>
                )}
              </div>
              {rd && !rd.ready ? (
                <p className="mt-2 text-[11px] text-amber-400/80 flex items-start gap-1.5">
                  <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>Sequence still needs {rd.missing.join(', ')}. Uploads are blocked until it uses only first name and personalization.</span>
                </p>
              ) : rd ? (
                <p className="mt-2 text-[11px] text-emerald-400/60 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  Ready for uploads
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {statusErr && <p className="text-xs text-red-400/70">{statusErr}</p>}

      {/* ── Upload ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4 backdrop-blur-sm">
        <div>
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <Voicemail className="h-4 w-4 text-[#D4A853]" />
            Paste your candidates
          </p>
          <p className="text-[11px] text-white/30 mt-1">
            Any order: job title, candidate first name, one or more email columns, rep name. The job title becomes the personalization in
            Instantly. A candidate with several addresses on file gets the sequence at each one. Nothing to select, and one paste can cover
            several recruiters.
          </p>
        </div>

        <textarea
          value={paste}
          onChange={(e) => handlePaste(e.target.value)}
          placeholder={
            'Job Title,First Name,Email 1,Email 2,Email 3,Rep Name\nRegional Fleet Maintenance Manager,Marcus,marcus.holloway@gulfcoastfleet.com,mholloway@gmail.com,,Remishka\nDiesel Shop Supervisor,Priya,priya.raman@meridiantransport.com,,,Remishka'
          }
          rows={7}
          className="w-full bg-black/30 border border-white/[0.08] rounded-lg p-3 text-xs text-white/80 font-mono focus:outline-none focus:border-[#D4A853]/40 placeholder:text-white/20"
        />

        {paste.trim() && rows.length === 0 && (
          <div className="flex items-start gap-2 text-xs text-amber-300/90 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-3 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              No email column found in that paste. Copy the rows straight out of Excel or your CSV and make sure each row has a recruiter
              name, a candidate first name, an email, and a job title. A header row is fine but optional.
            </span>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-white/[0.06]">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.03] text-white/40 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium">Recruiter</th>
                    <th className="text-left px-2 py-1.5 font-medium">Candidate</th>
                    <th className="text-left px-2 py-1.5 font-medium">Addresses on file</th>
                    <th className="text-left px-2 py-1.5 font-medium">Job title (personalization)</th>
                    <th className="text-left px-2 py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const notReady = r.valid && readiness[r.rep] && !readiness[r.rep].ready;
                    return (
                      <tr key={i} className="border-t border-white/[0.04] align-top">
                        <td className="px-2 py-1.5 text-white/70">{r.rep ? repName(r.rep) : r.repRaw || '–'}</td>
                        <td className="px-2 py-1.5 text-white/75">{r.firstName || <span className="text-white/25">(no name)</span>}</td>
                        <td className="px-2 py-1.5">
                          {r.emails.length === 0 && r.badEmails.length === 0 && r.dupeEmails.length === 0 && (
                            <span className="text-white/25">none</span>
                          )}
                          {r.emails.map((e) => (
                            <div key={e} className="text-white/50">
                              {e}
                            </div>
                          ))}
                          {r.badEmails.map((e) => (
                            <div key={e} className="text-red-400/50 line-through">
                              {e}
                            </div>
                          ))}
                          {r.dupeEmails.map((e) => (
                            <div key={e} className="text-white/25 line-through">
                              {e}
                            </div>
                          ))}
                          {r.valid && r.emails.length > 1 && (
                            <div className="text-[#D4A853]/70 mt-0.5">{r.emails.length} leads</div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-white/55">{r.jobTitle}</td>
                        <td className="px-2 py-1.5">
                          {!r.valid ? (
                            <span className="text-red-400/70">{r.reason}</span>
                          ) : notReady ? (
                            <span className="text-amber-400/80">sequence not ready</span>
                          ) : (
                            <span className="text-emerald-400/80">ready</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {blockedReps.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-300/90 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {blocked.length} row{blocked.length === 1 ? '' : 's'} held back for {blockedReps.map(repName).join(', ')}. Those sequences
                  still use merge fields this paste cannot fill, so the emails would send with a visible placeholder. They will queue
                  automatically once the sequence is updated.
                </span>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-white/40">
                {sendable.length} of {rows.length} candidates ready
                {extraAddresses > 0 && (
                  <span className="text-[#D4A853]/70">
                    {' '}
                    · {leads.length} leads, since {extraAddresses} extra address{extraAddresses === 1 ? ' gets its' : 'es get their'} own
                    sequence
                  </span>
                )}
                {Object.keys(byRep).length > 0 && (
                  <>
                    {' '}
                    ·{' '}
                    {Object.entries(byRep)
                      .map(([k, n]) => `${n} to ${repName(k)}`)
                      .join(', ')}
                  </>
                )}
                . Each gets the 4-email sequence from their own mailbox, 30/day, stops on reply.
              </p>
              <button
                onClick={submit}
                disabled={!leads.length || running}
                className="flex items-center gap-2 bg-gradient-to-r from-[#D4A853] to-[#b8912e] text-black text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-[#D4A853]/20"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Queueing {progress.done}/{progress.total}...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Queue {leads.length} lead{leads.length === 1 ? '' : 's'}
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {submitError && (
          <div className="flex items-start gap-2 text-xs text-red-300/90 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {results.length > 0 && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2.5">
            <p className="text-xs text-white/60">
              <span className="text-emerald-400/90 font-semibold">{counts.added || 0} queued</span>
              {' of '}
              {results.length} submitted
            </p>

            {/* Every outcome with its count, so nothing needs digging into. */}
            <div className="grid gap-1 sm:grid-cols-2">
              {OUTCOMES.filter((o) => counts[o.key]).map((o) => (
                <div key={o.key} className="flex items-center justify-between text-[11px] gap-2">
                  <span className={o.tone}>{o.label}</span>
                  <span className="text-white/70 font-semibold">{counts[o.key]}</span>
                </div>
              ))}
            </div>

            {/* Verification breakdown: what MyEmailVerifier actually said. */}
            {Object.keys(verifyCounts).length > 0 && (
              <div className="pt-2 border-t border-white/[0.05]">
                <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Address check</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                  {Object.entries(verifyCounts).map(([st, n]) => (
                    <span key={st} className={/invalid|unknown/i.test(st) ? 'text-red-400/70' : 'text-white/45'}>
                      {st} <span className="text-white/75 font-semibold">{n}</span>
                    </span>
                  ))}
                </div>
                {verifyCounts.unverified ? (
                  <p className="text-[11px] text-amber-400/70 mt-1">
                    Verification is off — set MYEMAILVERIFIER_API_KEY to stop bad addresses before they bounce.
                  </p>
                ) : null}
              </div>
            )}

            {/* The specific addresses that did not make it, and why. */}
            {failedRows.length > 0 && (
              <div className="pt-2 border-t border-white/[0.05] max-h-40 overflow-y-auto space-y-0.5">
                {failedRows.map((r, i) => (
                  <p key={i} className="text-[11px] text-white/40">
                    <span className="text-white/60">{r.email}</span>
                    {r.detail ? ` — ${r.detail.replace(`${r.email} `, '')}` : ` — ${r.outcome.replace(/_/g, ' ')}`}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Queue & activity ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3 backdrop-blur-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[#D4A853]" />
            Queue &amp; activity
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border border-white/[0.08] overflow-hidden text-xs">
              {REPS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setQueueRep(r.key)}
                  className={`px-2.5 py-1.5 transition-colors ${
                    queueRep === r.key ? 'bg-[#D4A853]/20 text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-white/[0.08] overflow-hidden text-xs">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setPendingOnly(v)}
                  className={`px-2.5 py-1.5 transition-colors ${
                    pendingOnly === v ? 'bg-[#D4A853]/20 text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {v ? 'Pending' : 'All'}
                </button>
              ))}
            </div>
            <button
              onClick={() => loadQueue(queueRep)}
              className="text-white/40 hover:text-[#D4A853] p-1.5 rounded-md hover:bg-white/[0.05] transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${queueLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {visibleQueue.length === 0 ? (
          <p className="text-xs text-white/30 py-6 text-center">
            {queueLoading
              ? 'Loading...'
              : queue.length
                ? `Nobody pending for ${repName(queueRep)}. ${queue.length} finished or bounced — switch to All to see them.`
                : `No candidates in ${repName(queueRep)}'s queue yet.`}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="text-white/35 border-b border-white/[0.06]">
                <tr>
                  <th className="text-left font-medium px-2 py-2">Candidate</th>
                  <th className="text-left font-medium px-2 py-2">Job title</th>
                  <th className="text-left font-medium px-2 py-2">Added</th>
                  <th className="text-center font-medium px-2 py-2">Step</th>
                  <th className="text-left font-medium px-2 py-2">Next email</th>
                  <th className="text-left font-medium px-2 py-2">Status</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibleQueue.map((l) => (
                  <tr key={l.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-2 py-2">
                      <div className="text-white/80">{l.name || '(no name)'}</div>
                      <div className="text-white/35">{l.email}</div>
                    </td>
                    <td className="px-2 py-2 text-white/55">{l.jobTitle || '–'}</td>
                    <td className="px-2 py-2 text-white/45">{fmtDate(l.uploaded)}</td>
                    <td className="px-2 py-2 text-center">
                      <span className="inline-flex items-center gap-1">
                        {[1, 2, 3, 4].map((n) => (
                          <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= l.step ? 'bg-[#D4A853]' : 'bg-white/15'}`} />
                        ))}
                        <span className="text-white/40 ml-1">{l.step}/4</span>
                      </span>
                    </td>
                    <td className="px-2 py-2 text-white/45">
                      {l.state === 'queued' || l.state === 'in_sequence' ? fmtDate(l.nextSend) : '–'}
                    </td>
                    <td className={`px-2 py-2 ${stateColor[l.state] || 'text-white/50'}`}>{stateLabel[l.state] || l.state}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => removeLead(l.id)}
                        disabled={deleting[l.id]}
                        className="text-white/30 hover:text-red-400/90 p-1 rounded hover:bg-red-500/10 disabled:opacity-40"
                        title="Remove from sequence"
                      >
                        {deleting[l.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
