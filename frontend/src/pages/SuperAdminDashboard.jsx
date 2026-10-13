import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../services/api';
import {
  Building2,
  Plus,
  Search,
  Pencil,
  Power,
  Eye,
  CheckCircle2,
  XCircle,
  Users,
  Layers,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Globe,
  RefreshCw,
  AlertCircle,
  CalendarDays,
  GraduationCap,
} from 'lucide-react';

const PLANS = ['free', 'basic', 'pro', 'enterprise'];
const STATUSES = ['active', 'suspended'];

const planStyles = {
  free: 'bg-gray-100 text-gray-700 border-gray-200',
  basic: 'bg-blue-50 text-blue-700 border-blue-200',
  pro: 'bg-purple-50 text-purple-700 border-purple-200',
  enterprise: 'bg-amber-50 text-amber-700 border-amber-200',
};

const statusStyles = {
  active: 'bg-green-50 text-green-700 border-green-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

function StatusBadge({ status }) {
  const Icon = status === 'active' ? CheckCircle2 : XCircle;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
        statusStyles[status] || statusStyles.suspended
      }`}
    >
      <Icon className="w-3.5 h-3.5 mr-1" />
      {status || 'unknown'}
    </span>
  );
}

function PlanBadge({ plan }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
        planStyles[plan] || planStyles.free
      }`}
    >
      {plan || 'free'}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center">
        <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function InstitutionFormModal({ open, mode, initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    slug: '',
    domain: '',
    status: 'active',
    subscription_plan: 'free',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name || '',
        slug: initial?.slug || '',
        domain: initial?.domain || '',
        status: initial?.status || 'active',
        subscription_plan: initial?.subscription_plan || 'free',
      });
      setError('');
      setSaving(false);
    }
  }, [open, initial]);

  if (!open) return null;

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const autoSlug = () => {
    setForm((current) => {
      if (current.slug) return current;
      const generated = current.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);
      return { ...current, slug: generated };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        domain: form.domain,
        status: form.status,
        subscription_plan: form.subscription_plan,
      };
      if (!payload.slug) delete payload.slug;
      if (!payload.domain) delete payload.domain;

      if (mode === 'create') {
        await adminAPI.createInstitution(payload);
      } else {
        await adminAPI.updateInstitution(initial.id, payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save institution');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {mode === 'create' ? 'New Institution' : 'Edit Institution'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              onBlur={autoSlug}
              required
              maxLength={200}
              placeholder="State University"
              className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug</label>
            <input
              name="slug"
              value={form.slug}
              onChange={handleChange}
              placeholder="state-university"
              className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">Lowercase letters, numbers and hyphens.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Domain</label>
            <input
              name="domain"
              value={form.domain}
              onChange={handleChange}
              placeholder="state-university.edu"
              className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent capitalize"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status} className="capitalize">
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Plan</label>
              <select
                name="subscription_plan"
                value={form.subscription_plan}
                onChange={handleChange}
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {PLANS.map((plan) => (
                  <option key={plan} value={plan} className="capitalize">
                    {plan}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
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
              {mode === 'create' ? 'Create Institution' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InstitutionDetailModal({ institutionId, onClose }) {
  const [state, setState] = useState({ loading: true, error: '', institution: null, stats: null });

  useEffect(() => {
    if (!institutionId) return undefined;
    let active = true;
    setState({ loading: true, error: '', institution: null, stats: null });

    adminAPI
      .getInstitution(institutionId)
      .then((response) => {
        if (active) {
          setState({ loading: false, error: '', ...response.data.data });
        }
      })
      .catch((err) => {
        if (active) {
          setState({
            loading: false,
            error: err.response?.data?.message || 'Failed to load institution',
            institution: null,
            stats: null,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [institutionId]);

  if (!institutionId) return null;

  const { loading, error, institution, stats } = state;
  const detailStats = [
    { label: 'Members', value: stats?.members, icon: Users },
    { label: 'Departments', value: stats?.departments, icon: Layers },
    { label: 'Academic Years', value: stats?.academicYears, icon: CalendarDays },
    { label: 'Terms', value: stats?.terms, icon: GraduationCap },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Institution Details</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="py-10 text-center text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              Loading...
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{institution.name}</p>
                  <p className="text-sm text-gray-500">{institution.slug}</p>
                </div>
                <StatusBadge status={institution.status} />
              </div>

              <dl className="grid grid-cols-2 gap-4 text-sm mb-5">
                <div>
                  <dt className="text-gray-500">Domain</dt>
                  <dd className="text-gray-900">{institution.domain || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Plan</dt>
                  <dd><PlanBadge plan={institution.subscription_plan} /></dd>
                </div>
                <div>
                  <dt className="text-gray-500">Created</dt>
                  <dd className="text-gray-900">{formatDate(institution.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Subscription ends</dt>
                  <dd className="text-gray-900">{formatDate(institution.subscription_expires_at)}</dd>
                </div>
              </dl>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {detailStats.map((item) => (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                    <item.icon className="w-5 h-5 mx-auto text-blue-600" />
                    <p className="mt-1 text-xl font-bold text-gray-900">{item.value ?? 0}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [data, setData] = useState({ items: [], total: 0, page: 1, totalPages: 1, limit: 10 });
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ open: false, mode: 'create', institution: null });
  const [detailId, setDetailId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, planFilter]);

  const loadStats = useCallback(async () => {
    try {
      const response = await adminAPI.getStats();
      setStats(response.data.data);
    } catch {
      // statistics are non-critical; keep the last known values
    }
  }, []);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const params = { page, limit: 10 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (planFilter) params.subscription_plan = planFilter;
      const response = await adminAPI.listInstitutions(params);
      setData(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load institutions');
    } finally {
      setListLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, planFilter]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const refreshAll = async () => {
    await Promise.all([loadList(), loadStats()]);
  };

  const toggleStatus = async (institution) => {
    const target = institution.status === 'active' ? 'suspended' : 'active';
    setBusyId(institution.id);
    setError('');
    try {
      await adminAPI.setInstitutionStatus(institution.id, target);
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  };

  const openCreate = () => setModal({ open: true, mode: 'create', institution: null });
  const openEdit = (institution) => setModal({ open: true, mode: 'edit', institution });
  const closeModal = () => setModal((current) => ({ ...current, open: false }));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-bold text-gray-900 leading-tight">Univora</p>
              <p className="text-xs text-gray-500 leading-tight">Super Admin Console</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="hidden sm:inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </button>
            <span className="hidden md:block text-sm text-gray-500">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Institution Management</h1>
            <p className="text-gray-600 mt-1">Manage tenants, plans and platform access.</p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Institution
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard label="Total Institutions" value={stats?.total ?? '—'} icon={Building2} color="bg-blue-500" />
          <StatCard label="Active" value={stats?.active ?? '—'} icon={CheckCircle2} color="bg-green-500" />
          <StatCard label="Suspended" value={stats?.suspended ?? '—'} icon={XCircle} color="bg-red-500" />
          <StatCard label="Added (30d)" value={stats?.addedLast30Days ?? '—'} icon={TrendingUp} color="bg-indigo-500" />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Subscription Plans</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {PLANS.map((plan) => (
              <div key={plan} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                <span className="text-sm font-medium text-gray-700 capitalize">{plan}</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${planStyles[plan]}`}>
                  {stats?.byPlan?.[plan] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, slug or domain"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status} className="capitalize">
                  {status}
                </option>
              ))}
            </select>
            <select
              value={planFilter}
              onChange={(event) => setPlanFilter(event.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All plans</option>
              {PLANS.map((plan) => (
                <option key={plan} value={plan} className="capitalize">
                  {plan}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Institution Directory</h3>
            <button
              onClick={refreshAll}
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
                  {['Institution', 'Domain', 'Status', 'Plan', 'Created', 'Actions'].map((heading) => (
                    <th
                      key={heading}
                      className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${
                        heading === 'Actions' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading institutions...
                    </td>
                  </tr>
                ) : data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      No institutions found.
                    </td>
                  </tr>
                ) : (
                  data.items.map((institution) => (
                    <tr key={institution.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">{institution.name}</p>
                            <p className="text-xs text-gray-500">{institution.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {institution.domain ? (
                          <span className="inline-flex items-center">
                            <Globe className="w-4 h-4 mr-1.5 text-gray-400" />
                            {institution.domain}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={institution.status} />
                      </td>
                      <td className="px-6 py-4">
                        <PlanBadge plan={institution.subscription_plan} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(institution.created_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailId(institution.id)}
                            title="View"
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(institution)}
                            title="Edit"
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleStatus(institution)}
                            disabled={busyId === institution.id}
                            title={institution.status === 'active' ? 'Suspend' : 'Activate'}
                            className={`p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 ${
                              institution.status === 'active' ? 'text-red-500' : 'text-green-600'
                            }`}
                          >
                            {busyId === institution.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!listLoading && data.items.length > 0 && (
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
      </main>

      <InstitutionFormModal
        open={modal.open}
        mode={modal.mode}
        initial={modal.institution}
        onClose={closeModal}
        onSaved={async () => {
          closeModal();
          await refreshAll();
        }}
      />
      <InstitutionDetailModal institutionId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

export default SuperAdminDashboard;
