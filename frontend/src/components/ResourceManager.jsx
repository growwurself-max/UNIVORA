import { useCallback, useEffect, useMemo, useState } from 'react';
import { academicAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ENTITIES, lookupLabel } from '../config/entities';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Inbox,
} from 'lucide-react';

const ADMIN_ROLES = ['owner', 'admin', 'college_admin', 'super_admin'];

const STATUS_STYLES = {
  active: 'bg-green-50 text-green-700 border-green-200',
  enrolled: 'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  graduated: 'bg-blue-50 text-blue-700 border-blue-200',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200',
  archived: 'bg-gray-100 text-gray-600 border-gray-200',
  dropped: 'bg-amber-50 text-amber-700 border-amber-200',
  on_leave: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  terminated: 'bg-red-50 text-red-700 border-red-200',
  withdrawn: 'bg-red-50 text-red-700 border-red-200',
};

function StatusPill({ value }) {
  if (!value) return <span>—</span>;
  const style = STATUS_STYLES[value] || 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${style}`}>
      {String(value).replace(/_/g, ' ')}
    </span>
  );
}

const buildEmptyForm = (entity) => {
  const values = {};
  entity.fields.forEach((field) => {
    values[field.name] = field.default !== undefined ? field.default : '';
  });
  return values;
};

const buildFormFromRow = (entity, row) => {
  const values = buildEmptyForm(entity);
  entity.fields.forEach((field) => {
    const value = row[field.name];
    if (value === undefined || value === null) return;
    values[field.name] = field.input === 'checkbox' ? Boolean(value) : value;
  });
  return values;
};

const ResourceManager = ({ resource }) => {
  const entity = ENTITIES[resource];
  const { user } = useAuth();
  const normalizedRole = user?.profile?.role?.toLowerCase().replace(/[\s-]+/g, '_');
  const isAdmin = ADMIN_ROLES.includes(normalizedRole);

  const [data, setData] = useState({ items: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [lookups, setLookups] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState('');
  const [formErrors, setFormErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    setSearch('');
    setDebouncedSearch('');
    setFilters({});
    setPage(1);
    setError('');
    setNotice('');
  }, [resource]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  const refResources = useMemo(() => {
    const set = new Set();
    entity.fields.forEach((field) => {
      if (field.input === 'ref' && field.ref) set.add(field.ref);
    });
    entity.filters.forEach((filter) => {
      if (filter.ref) set.add(filter.ref);
    });
    return Array.from(set).sort();
  }, [entity]);

  useEffect(() => {
    let active = true;
    if (!refResources.length) {
      setLookups({});
      return undefined;
    }

    Promise.all(
      refResources.map(async (ref) => {
        try {
          const response = await academicAPI.list(ref, { limit: 100 });
          const options = (response.data.data.items || []).map((row) => ({
            value: row.id,
            label: lookupLabel(ref, row),
          }));
          return [ref, options];
        } catch {
          return [ref, []];
        }
      })
    ).then((entries) => {
      if (active) setLookups(Object.fromEntries(entries));
    });

    return () => {
      active = false;
    };
  }, [refResources]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 10 };
      if (debouncedSearch) params.search = debouncedSearch;
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const response = await academicAPI.list(resource, params);
      setData(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [resource, page, debouncedSearch, filters]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const openCreate = () => {
    setEditing(null);
    setForm(buildEmptyForm(entity));
    setFormError('');
    setFormErrors([]);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm(buildFormFromRow(entity, row));
    setFormError('');
    setFormErrors([]);
    setModalOpen(true);
  };

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    setFormErrors([]);

    const payload = {};
    entity.fields.forEach((field) => {
      const value = form[field.name];
      if (field.input === 'checkbox') {
        payload[field.name] = Boolean(value);
      } else if (value === '' || value === undefined || value === null) {
        if (field.required) {
          payload[field.name] = '';
        } else if (editing) {
          payload[field.name] = null;
        }
      } else {
        payload[field.name] = typeof value === 'string' ? value.trim() : value;
      }
    });

    try {
      if (editing) {
        await academicAPI.update(resource, editing.id, payload);
      } else {
        await academicAPI.create(resource, payload);
      }
      setModalOpen(false);
      setNotice(`${entity.singular} ${editing ? 'updated' : 'created'} successfully.`);
      await fetchList();
    } catch (err) {
      const body = err.response?.data;
      setFormError(body?.message || 'Failed to save record');
      setFormErrors(Array.isArray(body?.data?.errors) ? body.data.errors : []);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete this ${entity.singular.toLowerCase()}? This cannot be undone.`)) {
      return;
    }
    setDeletingId(row.id);
    setError('');
    setNotice('');
    try {
      await academicAPI.remove(resource, row.id);
      setNotice(`${entity.singular} deleted successfully.`);
      await fetchList();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete record');
    } finally {
      setDeletingId(null);
    }
  };

  const renderCell = (column, row) => {
    if (column.key === 'status') return <StatusPill value={row.status} />;
    if (column.render) return column.render(row);
    return row[column.key] ?? '—';
  };

  const renderField = (field) => {
    const value = form[field.name] ?? '';
    const baseClass =
      'block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

    if (field.input === 'checkbox') {
      return (
        <label className="mt-1 inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={Boolean(form[field.name])}
            onChange={(event) => setField(field.name, event.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600"
          />
          {field.label}
        </label>
      );
    }

    if (field.input === 'textarea') {
      return (
        <textarea
          value={value}
          onChange={(event) => setField(field.name, event.target.value)}
          rows={3}
          className={baseClass}
        />
      );
    }

    if (field.input === 'select') {
      return (
        <select value={value} onChange={(event) => setField(field.name, event.target.value)} className={`${baseClass} capitalize`}>
          <option value="">Select {field.label.toLowerCase()}</option>
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value} className="capitalize">
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.input === 'ref') {
      const options = lookups[field.ref] || [];
      return (
        <select value={value} onChange={(event) => setField(field.name, event.target.value)} className={baseClass}>
          <option value="">Select {field.label.toLowerCase()}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={field.input || 'text'}
        value={value}
        required={Boolean(field.required)}
        maxLength={field.maxLength}
        step={field.step}
        min={field.min}
        onChange={(event) => setField(field.name, event.target.value)}
        className={baseClass}
      />
    );
  };

  if (!entity) {
    return <div className="p-8 text-gray-500">Unknown resource.</div>;
  }

  const Icon = entity.icon;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{entity.title}</h2>
            <p className="text-sm text-gray-600">{entity.description}</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New {entity.singular}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {notice && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
          <span className="text-sm">{notice}</span>
          <button onClick={() => setNotice('')} className="text-sm font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className={`relative ${entity.filters.length ? 'md:col-span-2' : 'md:col-span-3'}`}>
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={entity.searchPlaceholder}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {entity.filters.map((filter) => (
            <select
              key={filter.name}
              value={filters[filter.name] || ''}
              onChange={(event) => setFilters((prev) => ({ ...prev, [filter.name]: event.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All {filter.label.toLowerCase()}</option>
              {(filter.ref ? lookups[filter.ref] || [] : filter.options || []).map((option) => (
                <option key={option.value} value={option.value} className="capitalize">
                  {option.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">{entity.title} directory</h3>
          <button
            onClick={fetchList}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {entity.columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {column.label}
                  </th>
                ))}
                {isAdmin && (
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={entity.columns.length + (isAdmin ? 1 : 0)} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading...
                  </td>
                </tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={entity.columns.length + (isAdmin ? 1 : 0)} className="px-6 py-12 text-center text-gray-500">
                    <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No {entity.title.toLowerCase()} found.
                  </td>
                </tr>
              ) : (
                data.items.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    {entity.columns.map((column) => (
                      <td key={column.key} className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {renderCell(column, row)}
                      </td>
                    ))}
                    {isAdmin && (
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEdit(row)}
                          title="Edit"
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(row)}
                          disabled={deletingId === row.id}
                          title="Delete"
                          className="p-2 rounded-lg text-red-500 hover:bg-gray-100 disabled:opacity-50"
                        >
                          {deletingId === row.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && data.items.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Page {data.page} of {data.totalPages} · {data.total} total
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={data.page <= 1}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Prev
              </button>
              <button
                onClick={() => setPage((current) => Math.min(data.totalPages, current + 1))}
                disabled={data.page >= data.totalPages}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editing ? `Edit ${entity.singular}` : `New ${entity.singular}`}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5">
              {formError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{formError}</span>
                  </div>
                  {formErrors.length > 0 && (
                    <ul className="mt-2 ml-7 list-disc text-xs text-red-600">
                      {formErrors.map((item, index) => (
                        <li key={`${item.field}-${index}`}>
                          {item.field ? `${item.field}: ` : ''}
                          {item.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {entity.fields.map((field) => (
                  <div key={field.name} className={field.input === 'textarea' ? 'sm:col-span-2' : ''}>
                    {field.input !== 'checkbox' && (
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {field.label}
                        {field.required && <span className="text-red-500"> *</span>}
                      </label>
                    )}
                    {renderField(field)}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editing ? 'Save Changes' : `Create ${entity.singular}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceManager;
