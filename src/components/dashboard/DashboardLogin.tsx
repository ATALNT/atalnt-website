import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, AlertCircle } from 'lucide-react';

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Title */}
        <div className="text-center space-y-3">
          <img
            src="/atalnt-logo-transparent.png"
            alt="ATALNT"
            className="h-12 mx-auto"
          />
          <h1 className="text-2xl font-bold font-display text-foreground">
            Analytics Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your password to access team analytics
          </p>
        </div>

        {/* Login Form */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Dashboard password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-background/50 border-border/50 focus:border-primary"
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
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                disabled={loading || !password}
              >
                {loading ? 'Authenticating...' : 'Access Dashboard'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          ATALNT LLC - Internal Use Only
        </p>
      </div>
    </div>
  );
}
