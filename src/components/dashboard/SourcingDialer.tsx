import { useState, useEffect, useCallback } from 'react';
import { Voicemail, Users, Send, Loader2, RefreshCw, X, AlertCircle, ClipboardList, Briefcase } from 'lucide-react';

// ─── Sourcing dial companion ────────────────────────────────────────────────
// Recruiters paste the candidates they called and left voicemails for. Each one
// becomes a lead in that recruiter's ISOLATED: Instantly campaign and gets the
// 4-email sequence the team already wrote, from the recruiter's own mailbox.
//
// The sequence copy lives in Instantly and is never touched from here. This
// screen only collects the merge-field values that copy expects.

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

type Row = {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  title: string;
  specificExperience: string;
  valid: boolean;
  reason?: string;
};

type JobFields = {
  jobTitle: string;
  bullet1: string;
  bullet2: string;
  bullet3: string;
  usp: string;
  specificExperience: string;
};

const EMPTY_JOB: JobFields = { jobTitle: '', bullet1: '', bullet2: '', bullet3: '', usp: '', specificExperience: '' };

// ─── Paste parsing ──────────────────────────────────────────────────────────
// Handles tab-separated (copied straight out of Excel), CSV, and 2+ space
// separated pastes, with or without a header row. Headerless pastes get their
// columns detected by content.
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

  const emailRe = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  const firstCells = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const exactHeader = firstCells.some((h) =>
    ['first name', 'firstname', 'email', 'work email', 'company name', 'company', 'job title', 'title'].includes(h)
  );
  const fuzzyHeader =
    !firstCells.some((h) => emailRe.test(h)) &&
    firstCells.some((h) => ['first name', 'last name', 'email', 'company', 'job title', 'title'].some((f) => h.includes(f)));

  let dataLines: string[];
  let col: Record<string, number>;

  if (exactHeader || fuzzyHeader) {
    const header = firstCells;
    const findCol = (...names: string[]) => {
      for (const n of names) {
        const i = header.indexOf(n);
        if (i !== -1) return i;
      }
      return -1;
    };
    const fuzzyCol = (...frags: string[]) => {
      for (const f of frags) {
        const i = header.findIndex((h) => h.includes(f));
        if (i !== -1) return i;
      }
      return -1;
    };
    col = {
      first: findCol('first name', 'firstname', 'first'),
      last: findCol('last name', 'lastname', 'last'),
      email: findCol('email', 'work email', 'email address', 'personal email'),
      company: findCol('company name', 'company', 'current company', 'employer'),
      title: findCol('job title', 'title', 'current title'),
      experience: findCol('specific experience', 'experience', 'skills', 'notes'),
    };
    if (col.first === -1) col.first = fuzzyCol('first');
    if (col.last === -1) col.last = fuzzyCol('last');
    if (col.email === -1) col.email = fuzzyCol('email', 'e-mail');
    if (col.company === -1) col.company = fuzzyCol('company', 'employer', 'organization');
    if (col.title === -1) col.title = fuzzyCol('title', 'position', 'role');
    if (col.experience === -1) col.experience = fuzzyCol('experience', 'skill', 'note');
    dataLines = lines.slice(1);
  } else {
    // ── Headerless: detect columns by content ──
    dataLines = lines;
    const sample = dataLines.slice(0, 30).map(parseLine);
    const nCols = Math.max(...sample.map((r) => r.length));
    const frac = (fn: (c: string) => boolean) =>
      Array.from({ length: nCols }, (_, i) => {
        const filled = sample.map((r) => (r[i] || '').trim()).filter(Boolean);
        if (!filled.length) return 0;
        return filled.filter(fn).length / filled.length;
      });
    const emptyFrac = Array.from({ length: nCols }, (_, i) => {
      const cells = sample.map((r) => (r[i] || '').trim());
      return cells.filter((c) => !c).length / cells.length;
    });

    const STATES = new Set([
      'alabama','alaska','arizona','arkansas','california','colorado','connecticut','delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa','kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan','minnesota','mississippi','missouri','montana','nebraska','nevada','new hampshire','new jersey','new mexico','new york','north carolina','north dakota','ohio','oklahoma','oregon','pennsylvania','rhode island','south carolina','south dakota','tennessee','texas','utah','vermont','virginia','washington','west virginia','wisconsin','wyoming',
    ]);

    const emailF = frac((c) => emailRe.test(c));
    const urlF = frac((c) => /https?:\/\/|linkedin\.|indeed\./i.test(c));
    const phoneF = frac((c) => (c.match(/\d/g) || []).length >= 7 && /^[\d\s()\-.+ext]+$/i.test(c));
    const numericF = frac((c) => /^[\d,.$ ]+$/.test(c));
    const jsonF = frac((c) => /^[[{]/.test(c));
    const stateF = frac((c) => STATES.has(c.toLowerCase()));
    const countryF = frac((c) => /^(united states|usa|canada|united kingdom|india|philippines)$/i.test(c));
    const titleF = frac(
      (c) =>
        /engineer|manager|director|analyst|specialist|coordinator|supervisor|technician|driver|dispatcher|operator|planner|clerk|foreman|superintendent|estimator|accountant|developer|architect|sales|president|officer|lead|head of/i.test(c) &&
        !emailRe.test(c)
    );
    const singleWordF = frac((c) => /^[A-Za-z][A-Za-z'-]{1,15}$/.test(c));
    const companyTokenF = frac((c) =>
      /(inc|llc|corp|company|group|construction|services|engineering|solutions|associates|partners|builders|contracting|logistics|transport|freight)\b/i.test(c)
    );

    const used = new Set<number>();
    for (let i = 0; i < nCols; i++) if (urlF[i] > 0.3 || phoneF[i] > 0.3 || jsonF[i] > 0.2) used.add(i);

    const pick = (scores: number[], min: number, extra?: (i: number) => boolean) => {
      let best = -1;
      let bestV = min;
      for (let i = 0; i < nCols; i++) {
        if (used.has(i) || urlF[i] > 0.3 || phoneF[i] > 0.3 || numericF[i] > 0.5 || jsonF[i] > 0.2) continue;
        if (extra && !extra(i)) continue;
        if (scores[i] > bestV) {
          best = i;
          bestV = scores[i];
        }
      }
      if (best !== -1) used.add(best);
      return best;
    };

    const emailCol = pick(emailF, 0.4);
    const titleCol = pick(titleF, 0.3);
    let firstCol = -1;
    let lastCol = -1;
    for (let i = 0; i < nCols; i++) {
      if (used.has(i) || countryF[i] > 0.3 || stateF[i] > 0.3) continue;
      if (singleWordF[i] > 0.7 && emptyFrac[i] < 0.4) {
        if (firstCol === -1) {
          firstCol = i;
          used.add(i);
        } else if (lastCol === -1 && i > firstCol) {
          lastCol = i;
          used.add(i);
          break;
        }
      }
    }
    let companyCol = pick(companyTokenF, 0.15, (i) => countryF[i] < 0.3 && stateF[i] < 0.3);
    if (companyCol === -1) {
      const avgLen = Array.from({ length: nCols }, (_, i) => {
        if (used.has(i) || countryF[i] > 0.3 || numericF[i] > 0.3 || emptyFrac[i] > 0.5) return 0;
        const cells = sample.map((r) => (r[i] || '').trim()).filter(Boolean);
        return cells.length ? cells.reduce((s, c) => s + Math.min(c.length, 40), 0) / cells.length : 0;
      });
      companyCol = pick(avgLen, 5, (i) => countryF[i] < 0.3 && stateF[i] < 0.3);
    }

    col = { first: firstCol, last: lastCol, email: emailCol, company: companyCol, title: titleCol, experience: -1 };
    if (col.email === -1) return [];
  }

  const rows: Row[] = [];
  for (const line of dataLines) {
    const cells = parseLine(line);
    const get = (i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : '');
    const row: Row = {
      firstName: get(col.first),
      lastName: get(col.last),
      email: get(col.email),
      company: get(col.company),
      title: get(col.title),
      specificExperience: get(col.experience),
      valid: true,
    };
    if (!row.email || !emailRe.test(row.email)) {
      row.valid = false;
      row.reason = 'no valid email';
    } else if (!row.firstName) {
      row.valid = false;
      row.reason = 'missing first name';
    }
    rows.push(row);
  }
  return rows;
}

// ─── Component ──────────────────────────────────────────────────────────────
export function SourcingDialer({ token }: { token: string }) {
  const [rep, setRep] = useState<RepKey>('mikee');
  const [job, setJob] = useState<JobFields>(EMPTY_JOB);
  const [paste, setPaste] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<any[]>([]);
  const [submitError, setSubmitError] = useState('');

  const [status, setStatus] = useState<any[]>([]);
  const [statusErr, setStatusErr] = useState('');
  const [statusLoading, setStatusLoading] = useState(true);

  const [queueRep, setQueueRep] = useState<RepKey>('mikee');
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

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

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
    const parsed = parsePaste(text);
    // Rows without their own experience note inherit the batch default.
    setRows(parsed.map((r) => ({ ...r, specificExperience: r.specificExperience || job.specificExperience })));
    setResults([]);
    setSubmitError('');
  };

  const setRowExperience = (i: number, value: string) => {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, specificExperience: value } : r)));
  };

  const jobMissing = (Object.keys(EMPTY_JOB) as (keyof JobFields)[]).filter((k) => !job[k].trim());
  const validRows = rows.filter((r) => r.valid);
  const canSubmit = validRows.length > 0 && jobMissing.length === 0 && !running;

  const submit = async () => {
    if (!canSubmit) return;
    setRunning(true);
    setResults([]);
    setSubmitError('');
    setProgress({ done: 0, total: validRows.length });

    const all: any[] = [];
    for (let i = 0; i < validRows.length; i += CHUNK) {
      const chunk = validRows.slice(i, i + CHUNK);
      try {
        const res = await fetch('/api/instantly/dialer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'add',
            rep,
            job,
            leads: chunk.map((c) => ({
              firstName: c.firstName,
              lastName: c.lastName,
              email: c.email,
              company: c.company,
              title: c.title,
              specificExperience: c.specificExperience,
            })),
          }),
        });
        const d = await res.json();
        if (!res.ok) {
          setSubmitError(d?.error || `Request failed (${res.status})`);
          break;
        }
        all.push(...(d.results || []));
      } catch {
        all.push(...chunk.map((c) => ({ email: c.email, outcome: 'failed_request' })));
      }
      setProgress({ done: Math.min(i + CHUNK, validRows.length), total: validRows.length });
      setResults([...all]);
    }
    setRunning(false);
    loadStatus();
    if (queueRep === rep) loadQueue(rep);
  };

  const counts = results.reduce((m: Record<string, number>, r) => {
    m[r.outcome] = (m[r.outcome] || 0) + 1;
    return m;
  }, {});

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

  const jobField = (key: keyof JobFields, label: string, placeholder: string, textarea = false) => (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">{label}</label>
      {textarea ? (
        <textarea
          value={job[key]}
          onChange={(e) => setJob((j) => ({ ...j, [key]: e.target.value }))}
          placeholder={placeholder}
          rows={2}
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-[#D4A853]/40 placeholder:text-white/20 resize-none"
        />
      ) : (
        <input
          value={job[key]}
          onChange={(e) => setJob((j) => ({ ...j, [key]: e.target.value }))}
          placeholder={placeholder}
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-[#D4A853]/40 placeholder:text-white/20"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Per-recruiter status ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(status.length ? status : REPS.map((r) => ({ rep: r.key, name: r.name }))).map((s: any) => {
          const cold = s.mailboxScore != null && s.mailboxScore < 97;
          return (
            <div key={s.rep} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#D4A853]" />
                  {s.name || s.rep}
                </p>
                <span className="text-[10px] text-white/25 truncate">{s.email || ''}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-white">{statusLoading ? '–' : s.queued ?? '–'}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">in queue</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">
                    {statusLoading ? '–' : s.sentToday ?? '–'}
                    <span className="text-white/30 text-xs">/{s.dailyCap ?? 30}</span>
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">sent today</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{statusLoading ? '–' : s.replies ?? '–'}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">replies</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[11px]">
                <span className="text-white/25">
                  7d <span className="text-white/60 font-semibold">{s.sentWeek ?? 0}</span> · 30d{' '}
                  <span className="text-white/60 font-semibold">{s.sentMonth ?? 0}</span>
                </span>
                {s.mailboxScore != null && (
                  <span className={cold ? 'text-amber-400/80' : 'text-emerald-400/70'}>health {s.mailboxScore}</span>
                )}
              </div>
              {s.campaignStatus === 0 && (
                <p className="mt-2 text-[11px] text-white/30">Campaign is a draft. It goes live the first time you queue candidates.</p>
              )}
            </div>
          );
        })}
      </div>
      {statusErr && <p className="text-xs text-red-400/70">{statusErr}</p>}

      {/* ── Upload ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-5 backdrop-blur-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <Voicemail className="h-4 w-4 text-[#D4A853]" />
            Add candidates you left voicemails for
          </p>
          <select
            value={rep}
            onChange={(e) => setRep(e.target.value as RepKey)}
            className="bg-[#12131a] border border-white/[0.08] text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#D4A853]/50"
          >
            {REPS.map((r) => (
              <option key={r.key} value={r.key}>
                Send as {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Job details — these fill the merge fields in the existing sequence */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-4 space-y-4">
          <p className="text-xs font-semibold text-white/70 flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 text-[#D4A853]" />
            The role these candidates are being contacted about
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {jobField('jobTitle', 'Job title', 'Regional Fleet Maintenance Manager')}
            {jobField('specificExperience', 'Specific experience (default)', 'running multi-site diesel shops')}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {jobField('bullet1', 'Bullet 1', 'Direct hire, full benefits from day one', true)}
            {jobField('bullet2', 'Bullet 2', 'Reports straight to the VP of Operations', true)}
            {jobField('bullet3', 'Bullet 3', 'Relocation covered, base plus bonus', true)}
          </div>
          {jobField('usp', 'Unique selling point', 'they promote from within and the last two RMs moved up in 18 months', true)}
          <p className="text-[11px] text-white/25">
            These fill the blanks in the sequence your team already wrote. Every field is required, otherwise the email would send with a
            visible placeholder in it. Specific experience can be overridden per candidate below.
          </p>
        </div>

        {/* Paste */}
        <textarea
          value={paste}
          onChange={(e) => handlePaste(e.target.value)}
          placeholder={
            'Paste your candidate list here. Header row optional, the columns are detected automatically.\nCSV or rows copied straight out of Excel both work. Each row needs an email and a first name.'
          }
          rows={6}
          className="w-full bg-black/30 border border-white/[0.08] rounded-lg p-3 text-xs text-white/80 font-mono focus:outline-none focus:border-[#D4A853]/40 placeholder:text-white/20"
        />

        {paste.trim() && rows.length === 0 && (
          <div className="flex items-start gap-2 text-xs text-amber-300/90 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-3 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              No email column found in that paste, so there is nothing to queue yet. Copy the rows straight out of Excel or your export (tab
              or comma separated) and make sure every row has an email address. A header row is fine but optional.
            </span>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-white/[0.06]">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.03] text-white/40 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium">Candidate</th>
                    <th className="text-left px-2 py-1.5 font-medium">Company</th>
                    <th className="text-left px-2 py-1.5 font-medium">Specific experience</th>
                    <th className="text-left px-2 py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-white/[0.04]">
                      <td className="px-2 py-1.5">
                        <div className="text-white/75">
                          {r.firstName} {r.lastName}
                        </div>
                        <div className="text-white/35">{r.email || '(no email)'}</div>
                      </td>
                      <td className="px-2 py-1.5 text-white/50">{r.company}</td>
                      <td className="px-2 py-1.5">
                        <input
                          value={r.specificExperience}
                          onChange={(e) => setRowExperience(i, e.target.value)}
                          placeholder={job.specificExperience || 'inherits the default above'}
                          className="w-full bg-transparent border border-transparent hover:border-white/[0.08] focus:border-[#D4A853]/40 rounded px-1.5 py-1 text-white/60 focus:outline-none placeholder:text-white/20"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        {r.valid ? <span className="text-emerald-400/80">ready</span> : <span className="text-red-400/70">{r.reason}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {jobMissing.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-300/90 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Fill in the role details first. Still empty: {jobMissing.join(', ')}.</span>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-white/40">
                {validRows.length} of {rows.length} rows ready. Each gets the 4-email sequence from{' '}
                {REPS.find((r) => r.key === rep)?.name}, 30/day, stops on reply.
              </p>
              <button
                onClick={submit}
                disabled={!canSubmit}
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
                    Queue {validRows.length} candidate{validRows.length === 1 ? '' : 's'}
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
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-xs text-white/60">
              <span className="text-emerald-400/90 font-semibold">{counts.added || 0} queued</span>
              {counts.skipped_duplicate ? <span className="text-white/40"> · {counts.skipped_duplicate} already in Instantly</span> : null}
              {counts.skipped_bad_email ? <span className="text-white/40"> · {counts.skipped_bad_email} bad email</span> : null}
              {counts.skipped_no_first_name ? <span className="text-white/40"> · {counts.skipped_no_first_name} no first name</span> : null}
              {(counts.failed_create || 0) + (counts.failed_request || 0) ? (
                <span className="text-red-400/70"> · {(counts.failed_create || 0) + (counts.failed_request || 0)} failed</span>
              ) : null}
            </p>
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
          <div className="flex items-center gap-2">
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
            <button
              onClick={() => loadQueue(queueRep)}
              className="text-white/40 hover:text-[#D4A853] p-1.5 rounded-md hover:bg-white/[0.05] transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${queueLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {queue.length === 0 ? (
          <p className="text-xs text-white/30 py-6 text-center">
            {queueLoading ? 'Loading...' : `No candidates in ${REPS.find((r) => r.key === queueRep)?.name}'s queue yet.`}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead className="text-white/35 border-b border-white/[0.06]">
                <tr>
                  <th className="text-left font-medium px-2 py-2">Candidate</th>
                  <th className="text-left font-medium px-2 py-2">Company</th>
                  <th className="text-left font-medium px-2 py-2">Role</th>
                  <th className="text-left font-medium px-2 py-2">Added</th>
                  <th className="text-center font-medium px-2 py-2">Step</th>
                  <th className="text-left font-medium px-2 py-2">Next email</th>
                  <th className="text-left font-medium px-2 py-2">Status</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {queue.map((l) => (
                  <tr key={l.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-2 py-2">
                      <div className="text-white/80">{l.name || '(no name)'}</div>
                      <div className="text-white/35">{l.email}</div>
                    </td>
                    <td className="px-2 py-2 text-white/55">{l.company}</td>
                    <td className="px-2 py-2 text-white/45">{l.jobTitle || '–'}</td>
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
