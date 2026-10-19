import { useEffect, useState } from 'react';
import { academicAPI, feeAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { inputClass, apiError, money } from '../utils/helpers';
import {
  Wallet,
  Plus,
  Loader2,
  AlertCircle,
  Inbox,
  RefreshCw,
  Trash2,
  Pencil,
  Users,
  Tag,
  Layers,
} from 'lucide-react';

const ADMIN_ROLES = ['owner', 'admin', 'super_admin', 'staff', 'accountant'];

const emptyType = { name: '', code: '', description: '', status: 'active' };
const emptyStructure = {
  fee_type_id: '',
  academic_year_id: '',
  class_id: '',
  term_id: '',
  name: '',
  amount: '',
  currency: 'USD',
  frequency: 'one_time',
  due_date: '',
  status: 'active',
  description: '',
};

const classLabel = (row) => (row?.section ? `${row.name} (${row.section})` : row?.name || '—');
const studentLabel = (row) =>
  `${row?.admission_number || ''} — ${[row?.first_name, row?.last_name].filter(Boolean).join(' ')}`.trim();
const feeTypeLabel = (row) => [row?.name, row?.code].filter(Boolean).join(' · ');

const statusPill = (status) => {
  const map = {
    active: 'bg-green-50 text-green-700 border-green-200',
    inactive: 'bg-gray-100 text-gray-600 border-gray-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    partial: 'bg-blue-50 text-blue-700 border-blue-200',
    paid: 'bg-green-50 text-green-700 border-green-200',
    waived: 'bg-purple-50 text-purple-700 border-purple-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
  };
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
    map[status] || 'bg-gray-100 text-gray-600 border-gray-200'
  }`;
};

const Fees = () => {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.profile?.role);

  const [tab, setTab] = useState('structures');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [lookups, setLookups] = useState({
    types: [],
    classes: [],
    years: [],
    terms: [],
    students: [],
    structures: [],
  });

  const [types, setTypes] = useState([]);
  const [typeForm, setTypeForm] = useState(emptyType);
  const [editingType, setEditingType] = useState(null);

  const [structures, setStructures] = useState([]);
  const [structureForm, setStructureForm] = useState(emptyStructure);
  const [editingStructure, setEditingStructure] = useState(null);

  const [assignments, setAssignments] = useState([]);
  const [assignFilter, setAssignFilter] = useState({ status: '', student_id: '', fee_structure_id: '' });
  const [bulkForm, setBulkForm] = useState({ fee_structure_id: '', discount: '', due_date: '', notes: '' });
  const [singleForm, setSingleForm] = useState({ fee_structure_id: '', student_id: '', discount: '', notes: '' });
  const [editAssignment, setEditAssignment] = useState(null);

  const loadLookups = async () => {
    const [classes, years, terms, students, types, structures] = await Promise.all([
      academicAPI.list('classes', { limit: 100 }).then((r) => r.data.data.items || []).catch(() => []),
      academicAPI.list('academic-years', { limit: 100 }).then((r) => r.data.data.items || []).catch(() => []),
      academicAPI.list('terms', { limit: 100 }).then((r) => r.data.data.items || []).catch(() => []),
      feeAPI.students({ limit: 100 }).then((r) => r.data.data.items || []).catch(() => []),
      feeAPI.listTypes({ limit: 100 }).then((r) => r.data.data.items || []).catch(() => []),
      feeAPI.listStructures({ limit: 100 }).then((r) => r.data.data.items || []).catch(() => []),
    ]);
    setLookups({ classes, years, terms, students, types, structures });
    setTypes(types);
    setStructures(structures);
  };

  const loadAssignments = async () => {
    const params = { limit: 100 };
    if (assignFilter.status) params.status = assignFilter.status;
    if (assignFilter.student_id) params.student_id = assignFilter.student_id;
    if (assignFilter.fee_structure_id) params.fee_structure_id = assignFilter.fee_structure_id;
    try {
      const response = await feeAPI.listAssignments(params);
      setAssignments(response.data.data.items || []);
    } catch (err) {
      setError(apiError(err));
    }
  };

  useEffect(() => {
    loadLookups();
    loadAssignments();
  }, []);

  const run = async (fn, successMessage) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await fn();
      if (successMessage) setNotice(successMessage);
      await loadLookups();
      await loadAssignments();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  // ---- Fee types ----
  const submitType = (event) => {
    event.preventDefault();
    run(async () => {
      if (editingType) await feeAPI.updateType(editingType, typeForm);
      else await feeAPI.createType(typeForm);
      setTypeForm(emptyType);
      setEditingType(null);
    }, editingType ? 'Fee type updated' : 'Fee type created');
  };

  const startEditType = (row) => {
    setEditingType(row.id);
    setTypeForm({
      name: row.name || '',
      code: row.code || '',
      description: row.description || '',
      status: row.status || 'active',
    });
    setTab('types');
  };

  const deleteType = (row) =>
    run(() => feeAPI.removeType(row.id), 'Fee type deleted');

  // ---- Fee structures ----
  const submitStructure = (event) => {
    event.preventDefault();
    const payload = { ...structureForm };
    ['term_id'].forEach((key) => {
      if (!payload[key]) payload[key] = null;
    });
    if (!payload.due_date) payload.due_date = null;
    run(async () => {
      if (editingStructure) await feeAPI.updateStructure(editingStructure, payload);
      else await feeAPI.createStructure(payload);
      setStructureForm(emptyStructure);
      setEditingStructure(null);
    }, editingStructure ? 'Fee structure updated' : 'Fee structure created');
  };

  const startEditStructure = (row) => {
    setEditingStructure(row.id);
    setStructureForm({
      fee_type_id: row.fee_type_id || '',
      academic_year_id: row.academic_year_id || '',
      class_id: row.class_id || '',
      term_id: row.term_id || '',
      name: row.name || '',
      amount: row.amount ?? '',
      currency: row.currency || 'USD',
      frequency: row.frequency || 'one_time',
      due_date: row.due_date || '',
      status: row.status || 'active',
      description: row.description || '',
    });
    setTab('structures');
  };

  const deleteStructure = (row) =>
    run(() => feeAPI.removeStructure(row.id), 'Fee structure deleted');

  // ---- Assignments ----
  const submitBulk = (event) => {
    event.preventDefault();
    if (!bulkForm.fee_structure_id) {
      setError('Select a fee structure to assign.');
      return;
    }
    const payload = {
      fee_structure_id: bulkForm.fee_structure_id,
      notes: bulkForm.notes || null,
    };
    if (bulkForm.discount !== '') payload.discount = Number(bulkForm.discount);
    if (bulkForm.due_date) payload.due_date = bulkForm.due_date;
    run(async () => {
      await feeAPI.bulkAssign(payload);
      setBulkForm({ fee_structure_id: '', discount: '', due_date: '', notes: '' });
    }, 'Fee assigned to the class roster');
  };

  const submitSingle = (event) => {
    event.preventDefault();
    if (!singleForm.fee_structure_id || !singleForm.student_id) {
      setError('Select a fee structure and a student.');
      return;
    }
    const payload = {
      fee_structure_id: singleForm.fee_structure_id,
      student_id: singleForm.student_id,
      notes: singleForm.notes || null,
    };
    if (singleForm.discount !== '') payload.discount = Number(singleForm.discount);
    run(async () => {
      await feeAPI.createAssignment(payload);
      setSingleForm({ fee_structure_id: '', student_id: '', discount: '', notes: '' });
    }, 'Fee assigned to student');
  };

  const saveAssignmentEdit = (event) => {
    event.preventDefault();
    const payload = {
      discount: editAssignment.discount === '' ? 0 : Number(editAssignment.discount),
      status: editAssignment.status,
      due_date: editAssignment.due_date || null,
      notes: editAssignment.notes || null,
    };
    run(async () => {
      await feeAPI.updateAssignment(editAssignment.id, payload);
      setEditAssignment(null);
    }, 'Assignment updated');
  };

  const deleteAssignment = (row) =>
    run(() => feeAPI.removeAssignment(row.id), 'Assignment deleted');

  const tabs = [
    { key: 'structures', label: 'Fee Structures', icon: Layers },
    { key: 'types', label: 'Fee Types', icon: Tag },
    { key: 'assignments', label: 'Assignments', icon: Users },
  ];

  return (
    <div className="bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-11 h-11 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Wallet className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fee Management</h1>
            <p className="text-sm text-gray-600">Configure fee structures and assign them to students.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {notice && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {notice}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === item.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {item.label}
              </button>
            );
          })}
          <button
            onClick={() => {
              setNotice('');
              setError('');
              loadLookups();
              loadAssignments();
            }}
            className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Fee Structures */}
        {tab === 'structures' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {isAdmin && (
              <form onSubmit={submitStructure} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3 lg:col-span-1">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">
                  {editingStructure ? 'Edit fee structure' : 'New fee structure'}
                </h2>
                <input className={inputClass} placeholder="Name" value={structureForm.name} onChange={(e) => setStructureForm((p) => ({ ...p, name: e.target.value }))} required />
                <select className={inputClass} value={structureForm.fee_type_id} onChange={(e) => setStructureForm((p) => ({ ...p, fee_type_id: e.target.value }))} required>
                  <option value="">Fee type</option>
                  {lookups.types.map((row) => <option key={row.id} value={row.id}>{feeTypeLabel(row)}</option>)}
                </select>
                <select className={inputClass} value={structureForm.class_id} onChange={(e) => setStructureForm((p) => ({ ...p, class_id: e.target.value }))} required>
                  <option value="">Class</option>
                  {lookups.classes.map((row) => <option key={row.id} value={row.id}>{classLabel(row)}</option>)}
                </select>
                <select className={inputClass} value={structureForm.academic_year_id} onChange={(e) => setStructureForm((p) => ({ ...p, academic_year_id: e.target.value }))} required>
                  <option value="">Academic year</option>
                  {lookups.years.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
                <select className={inputClass} value={structureForm.term_id} onChange={(e) => setStructureForm((p) => ({ ...p, term_id: e.target.value }))}>
                  <option value="">Term (optional)</option>
                  {lookups.terms.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input className={inputClass} type="number" step="0.01" min="0.01" placeholder="Amount" value={structureForm.amount} onChange={(e) => setStructureForm((p) => ({ ...p, amount: e.target.value }))} required />
                  <input className={inputClass} placeholder="Currency" value={structureForm.currency} onChange={(e) => setStructureForm((p) => ({ ...p, currency: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select className={inputClass} value={structureForm.frequency} onChange={(e) => setStructureForm((p) => ({ ...p, frequency: e.target.value }))}>
                    <option value="one_time">One-time</option>
                    <option value="monthly">Monthly</option>
                    <option value="termly">Termly</option>
                    <option value="annual">Annual</option>
                  </select>
                  <input className={inputClass} type="date" value={structureForm.due_date} onChange={(e) => setStructureForm((p) => ({ ...p, due_date: e.target.value }))} />
                </div>
                <select className={inputClass} value={structureForm.status} onChange={(e) => setStructureForm((p) => ({ ...p, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <textarea className={inputClass} rows={2} placeholder="Description" value={structureForm.description} onChange={(e) => setStructureForm((p) => ({ ...p, description: e.target.value }))} />
                <div className="flex gap-2">
                  <button type="submit" disabled={saving} className="inline-flex items-center justify-center flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    {editingStructure ? 'Save' : 'Create'}
                  </button>
                  {editingStructure && (
                    <button type="button" onClick={() => { setEditingStructure(null); setStructureForm(emptyStructure); }} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}

            <div className={`bg-white rounded-xl shadow-sm border border-gray-200 lg:col-span-${isAdmin ? '2' : '3'}`}>
              {structures.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  No fee structures yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Class</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Year</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        {isAdmin && <th className="px-4 py-3" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {structures.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{classLabel(row.class)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{row.fee_type?.name || '—'}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{money(row.amount, row.currency)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{row.academic_year?.name || '—'}</td>
                          <td className="px-4 py-3"><span className={statusPill(row.status)}>{row.status}</span></td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button onClick={() => startEditStructure(row)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => deleteStructure(row)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fee Types */}
        {tab === 'types' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {isAdmin && (
              <form onSubmit={submitType} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">{editingType ? 'Edit fee type' : 'New fee type'}</h2>
                <input className={inputClass} placeholder="Name" value={typeForm.name} onChange={(e) => setTypeForm((p) => ({ ...p, name: e.target.value }))} required />
                <input className={inputClass} placeholder="Code" value={typeForm.code} onChange={(e) => setTypeForm((p) => ({ ...p, code: e.target.value }))} />
                <textarea className={inputClass} rows={2} placeholder="Description" value={typeForm.description} onChange={(e) => setTypeForm((p) => ({ ...p, description: e.target.value }))} />
                <select className={inputClass} value={typeForm.status} onChange={(e) => setTypeForm((p) => ({ ...p, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <div className="flex gap-2">
                  <button type="submit" disabled={saving} className="inline-flex items-center justify-center flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    {editingType ? 'Save' : 'Create'}
                  </button>
                  {editingType && (
                    <button type="button" onClick={() => { setEditingType(null); setTypeForm(emptyType); }} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300">Cancel</button>
                  )}
                </div>
              </form>
            )}
            <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              {types.length === 0 ? (
                <div className="text-center py-16 text-gray-500"><Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />No fee types yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        {isAdmin && <th className="px-4 py-3" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {types.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{row.code || '—'}</td>
                          <td className="px-4 py-3"><span className={statusPill(row.status)}>{row.status}</span></td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button onClick={() => startEditType(row)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => deleteType(row)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assignments */}
        {tab === 'assignments' && (
          <div className="space-y-6">
            {isAdmin && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form onSubmit={submitBulk} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
                  <h2 className="text-sm font-semibold text-gray-900">Assign to whole class roster</h2>
                  <select className={inputClass} value={bulkForm.fee_structure_id} onChange={(e) => setBulkForm((p) => ({ ...p, fee_structure_id: e.target.value }))} required>
                    <option value="">Fee structure</option>
                    {structures.map((row) => <option key={row.id} value={row.id}>{row.name} · {classLabel(row.class)}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input className={inputClass} type="number" step="0.01" min="0" placeholder="Discount" value={bulkForm.discount} onChange={(e) => setBulkForm((p) => ({ ...p, discount: e.target.value }))} />
                    <input className={inputClass} type="date" value={bulkForm.due_date} onChange={(e) => setBulkForm((p) => ({ ...p, due_date: e.target.value }))} />
                  </div>
                  <button type="submit" disabled={saving} className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
                    Assign to enrolled students
                  </button>
                </form>

                <form onSubmit={submitSingle} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
                  <h2 className="text-sm font-semibold text-gray-900">Assign to one student</h2>
                  <select className={inputClass} value={singleForm.fee_structure_id} onChange={(e) => setSingleForm((p) => ({ ...p, fee_structure_id: e.target.value }))} required>
                    <option value="">Fee structure</option>
                    {structures.map((row) => <option key={row.id} value={row.id}>{row.name} · {classLabel(row.class)}</option>)}
                  </select>
                  <select className={inputClass} value={singleForm.student_id} onChange={(e) => setSingleForm((p) => ({ ...p, student_id: e.target.value }))} required>
                    <option value="">Student</option>
                    {lookups.students.map((row) => <option key={row.id} value={row.id}>{studentLabel(row)}</option>)}
                  </select>
                  <input className={inputClass} type="number" step="0.01" min="0" placeholder="Discount" value={singleForm.discount} onChange={(e) => setSingleForm((p) => ({ ...p, discount: e.target.value }))} />
                  <button type="submit" disabled={saving} className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Assign to student
                  </button>
                </form>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
                <select className={inputClass} value={assignFilter.status} onChange={(e) => setAssignFilter((p) => ({ ...p, status: e.target.value }))}>
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="waived">Waived</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select className={`${inputClass} max-w-xs`} value={assignFilter.student_id} onChange={(e) => setAssignFilter((p) => ({ ...p, student_id: e.target.value }))}>
                  <option value="">All students</option>
                  {lookups.students.map((row) => <option key={row.id} value={row.id}>{studentLabel(row)}</option>)}
                </select>
                <button onClick={loadAssignments} className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">
                  <RefreshCw className="w-4 h-4 mr-2" /> Apply
                </button>
              </div>

              {assignments.length === 0 ? (
                <div className="text-center py-16 text-gray-500"><Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />No fee assignments yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fee</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Discount</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Paid</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Outstanding</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        {isAdmin && <th className="px-4 py-3" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {assignments.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{studentLabel(row.student)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{row.fee_structure?.name || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{money(row.amount_due)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{money(row.discount)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{money(row.amount_paid)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{money(row.outstanding)}</td>
                          <td className="px-4 py-3"><span className={statusPill(row.status)}>{row.status}</span></td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button onClick={() => setEditAssignment({ ...row, discount: row.discount ?? '', due_date: row.due_date || '' })} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => deleteAssignment(row)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {editAssignment && (
              <form onSubmit={saveAssignmentEdit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">
                  Edit assignment — {studentLabel(editAssignment.student)}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input className={inputClass} type="number" step="0.01" min="0" placeholder="Discount" value={editAssignment.discount} onChange={(e) => setEditAssignment((p) => ({ ...p, discount: e.target.value }))} />
                  <input className={inputClass} type="date" value={editAssignment.due_date} onChange={(e) => setEditAssignment((p) => ({ ...p, due_date: e.target.value }))} />
                  <select className={inputClass} value={editAssignment.status} onChange={(e) => setEditAssignment((p) => ({ ...p, status: e.target.value }))}>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="waived">Waived</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <textarea className={inputClass} rows={2} placeholder="Notes" value={editAssignment.notes || ''} onChange={(e) => setEditAssignment((p) => ({ ...p, notes: e.target.value }))} />
                <div className="flex gap-2">
                  <button type="submit" disabled={saving} className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save
                  </button>
                  <button type="button" onClick={() => setEditAssignment(null)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300">Cancel</button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Fees;
