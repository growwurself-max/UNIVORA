import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HUBS } from '../config/hubs';
import {
  BookOpen,
  LayoutDashboard,
  GraduationCap,
  CalendarClock,
  CalendarCheck,
  ClipboardList,
  BarChart3,
  Wallet,
  PieChart,
  CreditCard,
  Banknote,
  FileText,
  ShieldCheck,
  ExternalLink,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const ADMIN_ROLES = ['owner', 'admin', 'super_admin'];

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Academics',
    items: [
      { to: '/academic', label: 'Academic', icon: GraduationCap, match: '/academic' },
      { to: '/timetable', label: 'Timetable', icon: CalendarClock },
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
      { to: '/exams', label: 'Exams', icon: ClipboardList },
      { to: '/results', label: 'Results', icon: BarChart3 },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/fees', label: 'Fees', icon: Wallet },
      { to: '/fees/dashboard', label: 'Fee Dashboard', icon: PieChart },
      { to: '/payments', label: 'Payments', icon: CreditCard },
      { to: '/payroll', label: 'Payroll', icon: Banknote, adminOnly: true },
      { to: '/reports', label: 'Reports', icon: FileText },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

const isActivePath = (item, pathname) => {
  if (item.match) return pathname.startsWith(item.match);
  return pathname === item.to;
};

const pageTitle = (pathname) => {
  const match = ALL_ITEMS.find((item) => isActivePath(item, pathname));
  if (match) return match.label;
  if (pathname.startsWith('/admin')) return 'Super Admin Console';
  return 'Univora';
};

const initials = (user) =>
  (user?.metadata?.name || user?.email || 'U').charAt(0).toUpperCase();

const SidebarContent = ({ role, user, onNavigate }) => {
  const isAdmin = ADMIN_ROLES.includes(role);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center h-16 px-5 border-b border-gray-200 shrink-0">
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center">
          <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-accent-600 rounded-xl flex items-center justify-center shadow-sm">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="ml-3 text-lg font-bold tracking-tight text-gray-900">Univora</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.adminOnly || isAdmin);
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {group.label}
              </p>
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={!item.match}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`
                      }
                    >
                      <Icon className="w-[18px] h-[18px] mr-3" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div>
          <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            External Hubs
          </p>
          <div className="space-y-1">
            {HUBS.map((hub) => (
              <a
                key={hub.name}
                href={hub.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-accent-50 hover:text-accent-700 transition-colors"
              >
                <ExternalLink className="w-[18px] h-[18px] mr-3" />
                <span className="flex-1">{hub.name}</span>
              </a>
            ))}
          </div>
        </div>

        {role === 'super_admin' && (
          <div>
            <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Platform
            </p>
            <NavLink
              to="/admin"
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <ShieldCheck className="w-[18px] h-[18px] mr-3" />
              Super Admin
            </NavLink>
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-gray-200 shrink-0">
        <div className="flex items-center px-2 py-2">
          <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-accent-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {initials(user)}
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.metadata?.name || user?.profile?.fullName || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate capitalize">
              {user?.profile?.roleName || role || user?.email || ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const role = user?.profile?.role;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      navigate('/login', {
        state: { notice: 'You are signed out on this device, but the server could not confirm session revocation.' },
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile drawer */}
      <div className={`lg:hidden fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-gray-900/50 transition-opacity ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
        <div
          className={`absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-xl transition-transform duration-300 ease-in-out ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-3 p-2 rounded-md text-gray-500 hover:bg-gray-100 z-10"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
          <SidebarContent role={role} user={user} onNavigate={() => setOpen(false)} />
        </div>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-gray-200">
          <SidebarContent role={role} user={user} onNavigate={() => {}} />
        </aside>

        {/* Content column */}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="bg-white/90 backdrop-blur border-b border-gray-200 sticky top-0 z-30">
            <div className="h-16 flex items-center gap-3 px-4 sm:px-6 lg:px-8">
              <button
                onClick={() => setOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                {pageTitle(location.pathname)}
              </h1>
              <div className="flex-1" />
              <div className="hidden sm:flex items-center text-sm text-gray-500">
                {user?.profile?.institution?.name || user?.email}
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </header>

          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
