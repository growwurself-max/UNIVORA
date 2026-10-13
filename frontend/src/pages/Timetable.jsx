import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { academicAPI, timetableAPI } from '../services/api';
import {
  BookOpen,
  CalendarClock,
  CalendarCheck,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Loader2,
  X,
  Pencil,
  Trash2,
  AlertCircle,
  Inbox,
  Filter,
} from 'lucide-react';

const DAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 7, label: 'Sunday', short: 'Sun' },
];

const ADMIN_ROLES = ['owner', 'admin', 'super_admin'];

const EMPTY_FORM = {
  class_id: '',
  subject_id: '',
  faculty_id: '',
  term_id: '',
  room: '',
  day_of_week: '1',
  start_time: '09:00',
  end_time: '10:00',
  status: 'active',
  notes: '',
};

const formatTime = (value) => (value ? String(value).slice(0, 5) : '');

const Timetable = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = ADMIN_ROLES.includes(user?.profile?.role);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lookups, setLookups] = useState({});
  const [filters, setFilters] = useState({ class_id: '', faculty_id: '', term_id: '' });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadLookups = async () => {
    const refs = ['classes', 'faculty', 'subjects', 'terms'];
    const results = await Promise.all(
      refs.map(async (ref) => {
        try {
          const response = await academicAPI.list(ref, { limit: 100 });
          return [ref, response.data.data.items || []];
        } catch {
          return [ref, []];
        }
      })
    );
    setLookups(Object.fromEntries(results));
  };

  const loadEntries = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: 100 };
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const response = await timetableAPI.list(params);
      setEntries(response.data.data.items || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(DAYS.map((day) => [day.value, []]));
    entries.forEach((entry) => {
      if (map[entry.day_of_week]) map[entry.day_of_week].push(entry);
    });
    return map;
  }, [entries]);

  const optionLabel = (ref, row) => {
    if (ref === 'faculty') return [row.first_name, row.last_name].filter(Boolean).join(' ') || row.employee_id;
    if (ref === 'classes') return row.section ? `${row.name} (${row.section})` : row.name;
    if (ref === 'subjects') return row.code ? `${row.name} (${row.code})` : row.name;
    return row.name;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setForm({
      class_id: entry.class_id || '',
      subject_id: entry.subject_id || '',
      faculty_id: entry.faculty_id || '',
      term_id: entry.term_id || '',
      room: entry.room || '',
      day_of_week: String(entry.day_of_week || 1),
      start_time: formatTime(entry.start_time) || '09:00',
      end_time: formatTime(entry.end_time) || '10:00',
      status: entry.status || 'active',
      notes: entry.notes || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');

    const payload = {
      class_id: form.class_id,
      subject_id: form.subject_id || null,
      faculty_id: form.faculty_id || null,
      term_id: form.term_id || null,
      room: form.room || null,
      day_of_week: Number(form.day_of_week),
      start_time: form.start_time,
      end_time: form.end_time,
      status: form.status,
      notes: form.notes || null,
    };

    try {
      if (editing) {
        await timetableAPI.update(editing.id, payload);
      } else {
        await timetableAPI.create(payload);
      }
      setModalOpen(false);
      await loadEntries();
    } catch (err) {
      const body = err.response?.data;
      const detail = Array.isArray(body?.data?.errors) && body.data.errors[0]?.message;
      setFormError(detail || body?.message || 'Failed to save timetable entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm('Delete this timetable slot?')) return;
    try {
      await timetableAPI.remove(entry.id);
      await loadEntries();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete entry');
    }
  };

  const inputClass =
    'block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="ml-3 text-xl font-bold text-gray-900">Univora</span>
          </div>
          <nav className="hidden sm:flex items-center gap-1">
            <Link to="/dashboard" className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 flex items-center">
              <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
            </Link>
            <Link to="/timetable" className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 flex items-center">
              <CalendarClock className="w-4 h-4 mr-2" />
              Timetable
            </Link>
            <Link to="/attendance" className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 flex items-center">
              <CalendarCheck className="w-4 h-4 mr-2" />
              Attendance
            </Link>
          </nav>
          <button
            onClick={handleLogout}
            className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <CalendarClock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Timetable</h1>
              <p className="text-sm text-gray-600">Weekly schedule for classes, faculty and rooms.</p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={openCreate}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Slot
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3 text-gray-500">
            <Filter className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select value={filters.class_id} onChange={(e) => setFilters((p) => ({ ...p, class_id: e.target.value }))} className={inputClass}>
              <option value="">All classes</option>
              {(lookups.classes || []).map((row) => (
                <option key={row.id} value={row.id}>{optionLabel('classes', row)}</option>
              ))}
            </select>
            <select value={filters.faculty_id} onChange={(e) => setFilters((p) => ({ ...p, faculty_id: e.target.value }))} className={inputClass}>
              <option value="">All faculty</option>
              {(lookups.faculty || []).map((row) => (
                <option key={row.id} value={row.id}>{optionLabel('faculty', row)}</option>
              ))}
            </select>
            <select value={filters.term_id} onChange={(e) => setFilters((p) => ({ ...p, term_id: e.target.value }))} className={inputClass}>
              <option value="">All terms</option>
              {(lookups.terms || []).map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
            <button
              onClick={loadEntries}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            Loading timetable...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-200">
            <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            No timetable entries found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
            {DAYS.map((day) => (
              <div key={day.value} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <p className="text-sm font-semibold text-gray-700">{day.label}</p>
                </div>
                <div className="p-3 space-y-3 flex-1">
                  {grouped[day.value].length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No classes</p>
                  ) : (
                    grouped[day.value].map((entry) => (
                      <div
                        key={entry.id}
                        className={`rounded-lg border p-3 ${
                          entry.status === 'active'
                            ? 'border-blue-100 bg-blue-50/60'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <p className="text-xs font-semibold text-blue-700">
                          {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                        </p>
                        <p className="text-sm font-medium text-gray-900 mt-1">
                          {entry.class?.name || 'Class'}
                          {entry.class?.section ? ` (${entry.class.section})` : ''}
                        </p>
                        {entry.subject?.name && (
                          <p className="text-xs text-gray-600">{entry.subject.name}</p>
                        )}
                        {entry.faculty && (
                          <p className="text-xs text-gray-500">
                            {[entry.faculty.first_name, entry.faculty.last_name].filter(Boolean).join(' ')}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">{entry.room || 'No room'}</span>
                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEdit(entry)} title="Edit" className="p-1 rounded text-gray-500 hover:bg-white">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(entry)} title="Delete" className="p-1 rounded text-red-500 hover:bg-white">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
              {(user?.metadata?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <span>{user?.metadata?.name || user?.email}</span>
          </div>
          <button onClick={handleLogout} className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </button>
        </div>
      </footer>

      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Timetable Slot' : 'New Timetable Slot'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5">
              {formError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{formError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class <span className="text-red-500">*</span></label>
                  <select required value={form.class_id} onChange={(e) => setField('class_id', e.target.value)} className={inputClass}>
                    <option value="">Select class</option>
                    {(lookups.classes || []).map((row) => (
                      <option key={row.id} value={row.id}>{optionLabel('classes', row)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <select value={form.subject_id} onChange={(e) => setField('subject_id', e.target.value)} className={inputClass}>
                    <option value="">Select subject</option>
                    {(lookups.subjects || []).map((row) => (
                      <option key={row.id} value={row.id}>{optionLabel('subjects', row)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Faculty</label>
                  <select value={form.faculty_id} onChange={(e) => setField('faculty_id', e.target.value)} className={inputClass}>
                    <option value="">Select faculty</option>
                    {(lookups.faculty || []).map((row) => (
                      <option key={row.id} value={row.id}>{optionLabel('faculty', row)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                  <select value={form.term_id} onChange={(e) => setField('term_id', e.target.value)} className={inputClass}>
                    <option value="">Select term</option>
                    {(lookups.terms || []).map((row) => (
                      <option key={row.id} value={row.id}>{row.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                  <input type="text" value={form.room} onChange={(e) => setField('room', e.target.value)} className={inputClass} placeholder="e.g. B-204" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day <span className="text-red-500">*</span></label>
                  <select value={form.day_of_week} onChange={(e) => setField('day_of_week', e.target.value)} className={inputClass}>
                    {DAYS.map((day) => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time <span className="text-red-500">*</span></label>
                  <input type="time" required value={form.start_time} onChange={(e) => setField('start_time', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time <span className="text-red-500">*</span></label>
                  <input type="time" required value={form.end_time} onChange={(e) => setField('end_time', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setField('status', e.target.value)} className={inputClass}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea rows={2} value={form.notes} onChange={(e) => setField('notes', e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editing ? 'Save Changes' : 'Create Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timetable;
