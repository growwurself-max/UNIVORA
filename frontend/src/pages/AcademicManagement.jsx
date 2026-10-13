import { useState } from 'react';
import { NavLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ResourceManager from '../components/ResourceManager';
import { ENTITIES, RESOURCE_ORDER } from '../config/entities';
import { BookOpen, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';

const AcademicManagement = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { resource } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (resource && !ENTITIES[resource]) {
    return <Navigate to={`/academic/${RESOURCE_ORDER[0]}`} replace />;
  }

  const active = resource && ENTITIES[resource] ? resource : RESOURCE_ORDER[0];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
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

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            <div className="px-3 mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Academic Management
              </p>
            </div>
            {RESOURCE_ORDER.map((key) => {
              const entity = ENTITIES[key];
              const Icon = entity.icon;
              return (
                <NavLink
                  key={key}
                  to={`/academic/${key}`}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 mr-3" />
                  {entity.title}
                </NavLink>
              );
            })}
          </nav>

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

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 h-16">
          <div className="flex items-center justify-between h-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100 mr-4"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center">
                <BookOpen className="w-5 h-5 text-blue-600 mr-2" />
                <span className="text-lg font-semibold text-gray-900">Academic Management</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <ResourceManager key={active} resource={active} />
        </main>
      </div>
    </div>
  );
};

export default AcademicManagement;
