import { NavLink, Navigate, useParams } from 'react-router-dom';
import ResourceManager from '../components/ResourceManager';
import { ENTITIES, RESOURCE_ORDER } from '../config/entities';

const AcademicManagement = () => {
  const { resource } = useParams();

  if (resource && !ENTITIES[resource]) {
    return <Navigate to={`/academic/${RESOURCE_ORDER[0]}`} replace />;
  }

  const active = resource && ENTITIES[resource] ? resource : RESOURCE_ORDER[0];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Academic Management</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage students, staff and the academic structure of your institution.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide">
        {RESOURCE_ORDER.map((key) => {
          const entity = ENTITIES[key];
          const Icon = entity.icon;
          return (
            <NavLink
              key={key}
              to={`/academic/${key}`}
              className={({ isActive }) =>
                `inline-flex items-center whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`
              }
            >
              <Icon className="w-4 h-4 mr-2" />
              {entity.title}
            </NavLink>
          );
        })}
      </div>

      <ResourceManager key={active} resource={active} />
    </main>
  );
};

export default AcademicManagement;
