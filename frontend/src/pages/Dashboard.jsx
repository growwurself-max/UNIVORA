import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { academicAPI } from '../services/api';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Calendar,
  CalendarClock,
  CalendarCheck,
  GraduationCap,
  Library,
  Layers,
  Building2,
  ClipboardList,
  LogOut,
  Menu,
  X,
  Bell,
  Settings,
} from 'lucide-react';

const menuItems = [
  { name: 'Overview', icon: LayoutDashboard, description: 'View your dashboard overview' },
  { name: 'Students', icon: Users, description: 'Manage student records', path: '/academic/students' },
  { name: 'Faculty', icon: GraduationCap, description: 'Manage faculty members', path: '/academic/faculty' },
  { name: 'Departments', icon: Building2, description: 'Manage departments', path: '/academic/departments' },
  { name: 'Courses', icon: BookOpen, description: 'Manage the course catalog', path: '/academic/courses' },
  { name: 'Subjects', icon: Library, description: 'Manage subjects', path: '/academic/subjects' },
  { name: 'Classes', icon: Layers, description: 'Manage class sections', path: '/academic/classes' },
  { name: 'Enrollments', icon: ClipboardList, description: 'Enroll students in classes', path: '/academic/enrollments' },
  { name: 'Timetable', icon: CalendarClock, description: 'Weekly class schedules', path: '/timetable' },
  { name: 'Attendance', icon: CalendarCheck, description: 'Mark and review attendance', path: '/attendance' },
];

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMenuClick = (item) => {
    setSidebarOpen(false);
    if (item.path) navigate(item.path);
  };

  const statCards = [
    { label: 'Students', value: stats?.students, icon: Users, color: 'bg-blue-500' },
    { label: 'Faculty', value: stats?.faculty, icon: GraduationCap, color: 'bg-green-500' },
    { label: 'Courses', value: stats?.courses, icon: BookOpen, color: 'bg-purple-500' },
    { label: 'Classes', value: stats?.classes, icon: Calendar, color: 'bg-amber-500' },
  ];

  const displayValue = (value) => {
    if (statsLoading) return '—';
    if (statsError) return '—';
    return value ?? 0;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="ml-3 text-xl font-bold text-gray-900">Univora</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-md hover:bg-gray-100"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            <div className="px-3 mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Main Menu</p>
            </div>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.name === 'Overview';
              return (
                <button
                  key={item.name}
                  onClick={() => handleMenuClick(item)}
                  className={`w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                {(user?.metadata?.name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.metadata?.name || 'User'}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 h-16">
          <div className="flex items-center justify-between h-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100 mr-4"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-md hover:bg-gray-100">
                <Bell className="w-5 h-5 text-gray-500" />
              </button>
              <button className="p-2 rounded-md hover:bg-gray-100">
                <Settings className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
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
                <div
                  key={stat.label}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-center">
                    <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900">{displayValue(stat.value)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Academic Management</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems
                .filter((item) => item.path)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleMenuClick(item)}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all text-left group"
                    >
                      <div className="flex items-start">
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                          <Icon className="w-5 h-5 text-blue-600" />
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
      </div>
    </div>
  );
};

export default Dashboard;
