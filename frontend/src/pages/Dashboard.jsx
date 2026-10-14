import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { academicAPI } from '../services/api';
import { HUBS } from '../config/hubs';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Calendar,
  CalendarClock,
  CalendarCheck,
  GraduationCap,
  ClipboardList,
  Bell,
  BarChart3,
  Wallet,
  CreditCard,
  Banknote,
  FileText,
  ExternalLink,
} from 'lucide-react';

const ADMIN_ROLES = ['owner', 'admin', 'super_admin'];

const menuItems = [
  { name: 'Students', icon: Users, description: 'Manage student records', path: '/academic/students' },
  { name: 'Faculty', icon: GraduationCap, description: 'Manage faculty records', path: '/academic/faculty' },
  { name: 'Classes', icon: Calendar, description: 'Manage classes and sections', path: '/academic/classes' },
  { name: 'Timetable', icon: CalendarClock, description: 'Weekly schedule for classes and staff', path: '/timetable' },
  { name: 'Attendance', icon: CalendarCheck, description: 'Mark attendance and review history', path: '/attendance' },
  { name: 'Exams', icon: ClipboardList, description: 'Create exams and record marks', path: '/exams' },
  { name: 'Results', icon: BarChart3, description: 'Class & student results and report cards', path: '/results' },
  { name: 'Fees', icon: Wallet, description: 'Fee types, structures and assignments', path: '/fees' },
  { name: 'Fee Dashboard', icon: LayoutDashboard, description: 'Collections and outstanding dues', path: '/fees/dashboard' },
  { name: 'Payments', icon: CreditCard, description: 'Record payments and print receipts', path: '/payments' },
  { name: 'Payroll', icon: Banknote, description: 'Salary structures and payroll runs', path: '/payroll', adminOnly: true },
  { name: 'Reports', icon: FileText, description: 'Collection, outstanding and payroll reports', path: '/reports' },
];

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  const isAdmin = ADMIN_ROLES.includes(user?.profile?.role);
  const visibleItems = menuItems.filter((item) => !item.adminOnly || isAdmin);

  useEffect(() => {
    let active = true;
    academicAPI
      .stats()
      .then((response) => {
        if (active) setStats(response.data.data);
      })
      .catch(() => {
        if (active) setStatsError(true);
      })
      .finally(() => {
        if (active) setStatsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const statCards = [
    { label: 'Students', value: stats?.students, icon: Users, color: 'bg-primary-500' },
    { label: 'Faculty', value: stats?.faculty, icon: GraduationCap, color: 'bg-emerald-500' },
    { label: 'Courses', icon: BookOpen, value: stats?.courses, color: 'bg-accent-500' },
    { label: 'Classes', value: stats?.classes, icon: Calendar, color: 'bg-amber-500' },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.metadata?.name || user?.profile?.fullName || 'User'}
        </h2>
        <p className="text-gray-600 mt-1">
          {user?.profile?.institution?.name
            ? `${user.profile.institution.name} · academic overview`
            : "Here's an overview of your institution."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statsLoading ? '—' : statsError ? '—' : stats?.[stat.label.toLowerCase()] ?? 0}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Modules</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-primary-300 transition-all text-left group"
              >
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                    <Icon className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">{item.name}</h4>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">External Hubs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {HUBS.map((hub) => (
            <a
              key={hub.name}
              href={hub.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-accent-300 transition-all text-left group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center group-hover:bg-accent-100 transition-colors">
                    <ExternalLink className="w-5 h-5 text-accent-600" />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">{hub.name}</h4>
                    <p className="text-xs text-gray-500">{hub.description}</p>
                  </div>
                </div>
                <BookOpen className="w-4 h-4 text-gray-300 group-hover:text-accent-500 transition-colors" />
              </div>
            </a>
          ))}
        </div>
      </div>

      {statsError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-amber-900 mb-1">Statistics unavailable</h3>
              <p className="text-sm text-amber-700 leading-relaxed">
                Could not load academic statistics. Ensure the database migrations have been applied and
                your account belongs to an institution.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Dashboard;
