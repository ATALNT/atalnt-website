import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, AlertCircle, Shield } from 'lucide-react';

interface DashboardLoginProps {
  onLogin: (password: string) => Promise<boolean>;
}

export function DashboardLogin({ onLogin }: DashboardLoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await onLogin(password);
    if (!success) {
      setError('Invalid password');
      setPassword('');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid */}
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(212,168,83,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(212,168,83,0.4) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#D4A853]/[0.04] rounded-full blur-[120px]" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Logo & Title */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <img
              src="/atalnt-logo-transparent.png"
              alt="ATALNT"
              className="h-14 mx-auto relative z-10"
            />
            <div className="absolute inset-0 blur-2xl bg-[#D4A853]/20 rounded-full scale-150" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-white tracking-wide">
              Executive Dashboard
            </h1>
            <p className="text-sm text-white/30 mt-1 tracking-wide">
              Secure access to operational intelligence
            </p>
          </div>
        </div>

        {/* Login Form */}
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/40 to-transparent" />
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                  <Input
                    type="password"
                    placeholder="Enter access code"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 focus:border-[#D4A853]/40 focus:ring-[#D4A853]/10"
                    autoFocus
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#D4A853] to-[#b8912e] text-black font-semibold hover:from-[#e0b960] hover:to-[#c9a03a] shadow-lg shadow-[#D4A853]/20 transition-all"
                disabled={loading || !password}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Access Dashboard
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-white/15 tracking-widest uppercase">
          ATALNT LLC - Authorized Personnel Only
        </p>
      </div>
    </div>
  );
}
