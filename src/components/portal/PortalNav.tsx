import { Link, useLocation } from 'react-router-dom';
import logo from '@/assets/atalnt-logo-transparent.png';
import { LogOut } from 'lucide-react';

interface PortalNavProps {
  userType: 'client' | 'ops_lead';
  userName?: string;
  onLogout: () => void;
}

export function PortalNav({ userType, userName, onLogout }: PortalNavProps) {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link to={userType === 'ops_lead' ? '/portal/admin' : '/portal/dashboard'}>
            <img src={logo} alt="ATALNT" className="h-12 w-auto" />
          </Link>
          {userType === 'ops_lead' && (
            <div className="hidden items-center gap-1 sm:flex">
              <Link
                to="/portal/admin"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive('/portal/admin')
                    ? 'bg-white/[0.06] text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                Candidates
              </Link>
              <Link
                to="/portal/admin/new"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive('/portal/admin/new')
                    ? 'bg-white/[0.06] text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                + New Submission
              </Link>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {userName && (
            <span className="text-xs text-white/40">{userName}</span>
          )}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/70"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
