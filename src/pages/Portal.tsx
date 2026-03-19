import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import logo from '@/assets/atalnt-logo-transparent.png';
import { Mail, ArrowRight, Loader2, Shield } from 'lucide-react';

export default function Portal() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Handle magic link token
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setLoading(true);
      fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.session) {
            sessionStorage.setItem('portal_session', JSON.stringify(data.session));
            navigate('/portal/dashboard', { replace: true });
          } else {
            setError(data.error || 'Invalid or expired link');
          }
        })
        .catch(() => setError('Connection error'))
        .finally(() => setLoading(false));
    }
  }, [searchParams]);

  // Check if already logged in
  const existingSession = sessionStorage.getItem('portal_session');
  if (existingSession) {
    const session = JSON.parse(existingSession);
    if (session.type === 'client') {
      navigate('/portal/dashboard', { replace: true });
      return null;
    }
    if (session.type === 'ops_lead') {
      navigate('/portal/admin', { replace: true });
      return null;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      if (data.type === 'ops_lead') {
        // Ops leads get direct access (password-based in future)
        sessionStorage.setItem('portal_session', JSON.stringify(data.session));
        navigate('/portal/admin');
      } else if (data.type === 'magic_link_sent') {
        setSent(true);
      } else {
        setError('Email not found. Contact your ATALNT representative.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,168,83,0.04),transparent_60%)]" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src={logo} alt="ATALNT" className="mx-auto h-16 w-auto" />
          <h1 className="mt-4 font-display text-xl font-bold text-white">Client Portal</h1>
          <p className="mt-1 text-sm text-white/40">Sign in to view your candidates</p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-[#D4A853]/20 bg-[#D4A853]/[0.04] p-8 text-center">
            <Mail className="mx-auto h-8 w-8 text-[#D4A853]" />
            <h2 className="mt-4 font-display text-lg font-semibold text-white">Check your email</h2>
            <p className="mt-2 text-sm text-white/40">
              We sent a login link to <span className="text-white/60">{email}</span>
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-xs text-[#D4A853]/60 hover:text-[#D4A853]"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
                Email Address
              </label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:border-[#D4A853]/30 focus:outline-none"
                />
              </div>

              {error && (
                <p className="mt-2 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4A853] to-[#b8912e] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/20">
              <Shield className="h-3 w-3" />
              Secure, password-free login
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
