import { useState, useCallback, useEffect } from 'react';

interface AuthState {
  token: string | null;
  expiresAt: number | null;
}

const STORAGE_KEY = 'atalnt_dashboard_auth';

function getStoredAuth(): AuthState {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
        return parsed;
      }
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
  return { token: null, expiresAt: null };
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(getStoredAuth);

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const newAuth = { token: data.token, expiresAt: data.expiresAt };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newAuth));
      setAuth(newAuth);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuth({ token: null, expiresAt: null });
  }, []);

  // Check expiry periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (auth.expiresAt && Date.now() >= auth.expiresAt) {
        logout();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [auth.expiresAt, logout]);

  return {
    token: auth.token,
    isAuthenticated: !!auth.token,
    login,
    logout,
  };
}
