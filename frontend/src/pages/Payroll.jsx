import { useEffect, useState } from 'react';
import { payrollAPI } from '../services/api';
import { inputClass, apiError, money, monthName } from '../utils/helpers';
import {
  Banknote,
  Plus,
  Loader2,
  AlertCircle,
  Inbox,
  RefreshCw,
  Trash2,
  Pencil,
  Layers,
  CalendarRange,
  Wand2,
  Check,
} from 'lucide-react';

const FREQUENCIES = ['monthly', 'biweekly', 'weekly'];
const RUN_STATUSES = ['draft', 'processing', 'approved', 'paid', 'cancelled'];
const currentYear = new Date().getFullYear();

const facultyLabel = (row) =>
  `${row?.employee_id || ''} — ${[row?.first_name, row?.last_name].filter(Boolean).join(' ')}`.trim();

const staffLabel = (row) => row?.full_name || row?.email || '—';

const employeeName = (row) => {
  if (row?.faculty) return facultyLabel(row.faculty);
  if (row?.staff) return staffLabel(row.staff);
  return '—';
};

const emptyStructure = {
  employee: '',
  name: '',
  base_salary: '',
  currency: 'USD',
  pay_frequency: 'monthly',
  effective_from: '',
  status: 'active',
  notes: '',
  components: [],
};

const emptyComponent = { name: '', type: 'allowance', amount: '', is_percentage: false };

const statusPill = (status) => {
  const map = {
    active: 'bg-green-50 text-green-700 border-green-200',
    inactive: 'bg-gray-100 text-gray-600 border-gray-200',
    draft: 'bg-gray-100 text-gray-600 border-gray-200',
    processing: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-blue-50 text-blue-700 border-blue-200',
    paid: 'bg-green-50 text-green-700 border-green-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
    map[status] || 'bg-gray-100 text-gray-600 border-gray-200'
  }`;
};

const Payroll = () => {
  const [tab, setTab] = useState('structures');
  const [employees, setEmployees] = useState({ faculty: [], staff: [] });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [structures, setStructures] = useState([]);
  const [structureForm, setStructureForm] = useState(emptyStructure);
  const [componentDraft, setComponentDraft] = useState(emptyComponent);
  const [editingStructure, setEditingStructure] = useState(null);

  const [runs, setRuns] = useState([]);
  const [runForm, setRunForm] = useState({ period_month: new Date().getMonth() + 1, period_year: currentYear, name: '', notes: '' });
  const [selectedRun, setSelectedRun] = useState(null);
  const [runDetail, setRunDetail] = useState(null);

  const loadStructures = async () => {
    try {
      const response = await payrollAPI.listStructures({ limit: 100 });
      setStructures(response.data.data.items || []);
    } catch (err) {
      setError(apiError(err));
    }
  };

  const loadRuns = async () => {
    try {
      const response = await payrollAPI.listRuns({ limit: 100 });
      setRuns(response.data.data.items || []);
    } catch (err) {
      setError(apiError(err));
    }
  };

  useEffect(() => {
    payrollAPI.listEmployees()
      .then((r) => setEmployees(r.data.data || { faculty: [], staff: [] }))
      .catch(() => setEmployees({ faculty: [], staff: [] }));
    loadStructures();
    loadRuns();
  }, []);

  const run = async (fn, message) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await fn();
      if (message) setNotice(message);
      await loadStructures();
      await loadRuns();
      if (selectedRun) await openRun(selectedRun.id);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  // ---- Structures ----
  const addComponent = () => {
    if (!componentDraft.name || componentDraft.amount === '') {
      setError('Component needs a name and an amount.');
      return;
    }
    setStructureForm((prev) => ({
      ...prev,
      components: [...prev.components, { ...componentDraft, amount: Number(componentDraft.amount) }],
    }));
    setComponentDraft(emptyComponent);
    setError('');
  };

  const removeComponent = (index) => {
    setStructureForm((prev) => ({ ...prev, components: prev.components.filter((_, i) => i !== index) }));
  };

  const submitStructure = (event) => {
    event.preventDefault();
    const payload = {
      name: structureForm.name,
      base_salary: Number(structureForm.base_salary),
      currency: structureForm.currency,
      pay_frequency: structureForm.pay_frequency,
      status: structureForm.status,
      notes: structureForm.notes || null,
      components: structureForm.components,
    };
    const [employeeType, employeeId] = structureForm.employee ? structureForm.employee.split(':') : ['', ''];
    payload.faculty_id = employeeType === 'faculty' ? employeeId : null;
    payload.profile_id = employeeType === 'staff' ? employeeId : null;
    if (structureForm.effective_from) payload.effective_from = structureForm.effective_from;
    run(async () => {
      if (editingStructure) await payrollAPI.updateStructure(editingStructure, payload);
      else await payrollAPI.createStructure(payload);
      setStructureForm(emptyStructure);
      setEditingStructure(null);
    }, editingStructure ? 'Salary structure updated' : 'Salary structure created');
  };

  const startEditStructure = (row) => {
    setEditingStructure(row.id);
    setStructureForm({
      employee: row.faculty_id ? `faculty:${row.faculty_id}` : row.profile_id ? `staff:${row.profile_id}` : '',
      name: row.name || '',
      base_salary: row.base_salary ?? '',
      currency: row.currency || 'USD',
      pay_frequency: row.pay_frequency || 'monthly',
      effective_from: row.effective_from || '',
      status: row.status || 'active',
      notes: row.notes || '',
      components: (row.components || []).map((c) => ({
        name: c.name,
        type: c.type,
        amount: Number(c.amount),
        is_percentage: Boolean(c.is_percentage),
      })),
    });
    setTab('structures');
  };

  const removeStructure = (row) => run(() => payrollAPI.removeStructure(row.id), 'Salary structure deleted');

  // ---- Runs ----
  const submitRun = (event) => {
    event.preventDefault();
    run(async () => {
      await payrollAPI.createRun({
        period_month: Number(runForm.period_month),
        period_year: Number(runForm.period_year),
        name: runForm.name || undefined,
        notes: runForm.notes || null,
      });
      setRunForm({ period_month: new Date().getMonth() + 1, period_year: currentYear, name: '', notes: '' });
    }, 'Payroll run created');
  };

  const openRun = async (id) => {
    setError('');
    try {
      const response = await payrollAPI.getRun(id);
      setRunDetail(response.data.data);
      setSelectedRun(response.data.data.run);
    } catch (err) {
      setError(apiError(err));
    }
  };

  const generateRun = (row) =>
    run(async () => {
      const response = await payrollAPI.generateRun(row.id);
      setNotice(`Generated ${response.data.data.created} payslip(s)`);
    });

  const changeRunStatus = (row, status) =>
    run(() => payrollAPI.updateRun(row.id, { status }), 'Payroll run updated');

  const removeRun = (row) =>
    run(() => {
      if (selectedRun?.id === row.id) {
        setSelectedRun(null);
        setRunDetail(null);
      }
      return payrollAPI.removeRun(row.id);
    }, 'Payroll run deleted');

  const changeRecordStatus = (record, status) =>
    run(() => payrollAPI.updateRecord(record.id, { status }), 'Payslip updated');

  const removeRecord = (record) =>
    run(() => payrollAPI.removeRecord(record.id), 'Payslip deleted');

  const tabs = [
    { key: 'structures', label: 'Salary Structures', icon: Layers },
    { key: 'runs', label: 'Payroll Runs', icon: CalendarRange },
  ];

  return (
    <div className="bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-11 h-11 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Banknote className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
            <p className="text-sm text-gray-600">Manage salary structures, payroll runs and payslips.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {notice && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{notice}</div>
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
        </div>

        {/* Structures */}
        {tab === 'structures' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form onSubmit={submitStructure} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3 h-fit">
              <h2 className="text-sm font-semibold text-gray-900">{editingStructure ? 'Edit salary structure' : 'New salary structure'}</h2>
              <input className={inputClass} placeholder="Name / grade" value={structureForm.name} onChange={(e) => setStructureForm((p) => ({ ...p, name: e.target.value }))} required />
              <select className={inputClass} value={structureForm.employee} onChange={(e) => setStructureForm((p) => ({ ...p, employee: e.target.value }))} required>
                <option value="">Select employee…</option>
                {employees.faculty.length > 0 && (
                  <optgroup label="Faculty">
                    {employees.faculty.map((row) => <option key={row.id} value={`faculty:${row.id}`}>{facultyLabel(row)}</option>)}
                  </optgroup>
                )}
                {employees.staff.length > 0 && (
                  <optgroup label="Staff">
                    {employees.staff.map((row) => <option key={row.id} value={`staff:${row.id}`}>{staffLabel(row)}</option>)}
                  </optgroup>
                )}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClass} type="number" step="0.01" min="0.01" placeholder="Base salary" value={structureForm.base_salary} onChange={(e) => setStructureForm((p) => ({ ...p, base_salary: e.target.value }))} required />
                <input className={inputClass} placeholder="Currency" value={structureForm.currency} onChange={(e) => setStructureForm((p) => ({ ...p, currency: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select className={inputClass} value={structureForm.pay_frequency} onChange={(e) => setStructureForm((p) => ({ ...p, pay_frequency: e.target.value }))}>
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <input className={inputClass} type="date" value={structureForm.effective_from} onChange={(e) => setStructureForm((p) => ({ ...p, effective_from: e.target.value }))} />
              </div>
              <select className={inputClass} value={structureForm.status} onChange={(e) => setStructureForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Allowances / Deductions</p>
                {structureForm.components.length > 0 && (
                  <ul className="space-y-1.5 mb-3">
                    {structureForm.components.map((c, index) => (
                      <li key={index} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-700">
                          {c.name} <span className={c.type === 'allowance' ? 'text-green-600' : 'text-red-600'}>({c.type})</span>
                          {' '}{c.is_percentage ? `${c.amount}%` : money(c.amount)}
                        </span>
                        <button type="button" onClick={() => removeComponent(index)} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                  <input className={inputClass} placeholder="Component name" value={componentDraft.name} onChange={(e) => setComponentDraft((p) => ({ ...p, name: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <select className={inputClass} value={componentDraft.type} onChange={(e) => setComponentDraft((p) => ({ ...p, type: e.target.value }))}>
                      <option value="allowance">Allowance</option>
                      <option value="deduction">Deduction</option>
                    </select>
                    <input className={inputClass} type="number" step="0.01" min="0" placeholder="Amount" value={componentDraft.amount} onChange={(e) => setComponentDraft((p) => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <label className="flex items-center text-xs text-gray-600">
                    <input type="checkbox" className="mr-2" checked={componentDraft.is_percentage} onChange={(e) => setComponentDraft((p) => ({ ...p, is_percentage: e.target.checked }))} />
                    Percentage of base salary
                  </label>
                  <button type="button" onClick={addComponent} className="inline-flex items-center justify-center w-full px-3 py-2 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add component
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="inline-flex items-center justify-center flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  {editingStructure ? 'Save' : 'Create'}
                </button>
                {editingStructure && (
                  <button type="button" onClick={() => { setEditingStructure(null); setStructureForm(emptyStructure); }} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300">Cancel</button>
                )}
              </div>
            </form>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 lg:col-span-2">
              {structures.length === 0 ? (
                <div className="text-center py-16 text-gray-500"><Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />No salary structures yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Employee</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Base</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Components</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {structures.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{employeeName(row)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{money(row.base_salary, row.currency)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{row.components?.length || 0}</td>
                          <td className="px-4 py-3"><span className={statusPill(row.status)}>{row.status}</span></td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button onClick={() => startEditStructure(row)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => removeStructure(row)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Runs */}
        {tab === 'runs' && (
          <div className="space-y-6">
            <form onSubmit={submitRun} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
                <select className={inputClass} value={runForm.period_month} onChange={(e) => setRunForm((p) => ({ ...p, period_month: e.target.value }))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
                <input className={`${inputClass} max-w-[110px]`} type="number" min="2000" max="2100" value={runForm.period_year} onChange={(e) => setRunForm((p) => ({ ...p, period_year: e.target.value }))} />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Name (optional)</label>
                <input className={inputClass} placeholder="Auto-generated if blank" value={runForm.name} onChange={(e) => setRunForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <button type="submit" disabled={saving} className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Create run
              </button>
            </form>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Payroll runs</h2>
                <button onClick={loadRuns} className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"><RefreshCw className="w-4 h-4 mr-1.5" /> Refresh</button>
              </div>
              {runs.length === 0 ? (
                <div className="text-center py-16 text-gray-500"><Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />No payroll runs yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Period</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Gross</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Net</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {runs.map((row) => (
                        <tr key={row.id} className={`hover:bg-gray-50 cursor-pointer ${selectedRun?.id === row.id ? 'bg-blue-50' : ''}`} onClick={() => openRun(row.id)}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{monthName(row.period_month)} {row.period_year}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{money(row.total_gross)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{money(row.total_net)}</td>
                          <td className="px-4 py-3"><span className={statusPill(row.status)}>{row.status}</span></td>
                          <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => generateRun(row)} disabled={saving} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Generate payslips"><Wand2 className="w-4 h-4" /></button>
                            <select className="text-xs border border-gray-300 rounded px-1.5 py-1 ml-1" value={row.status} onChange={(e) => changeRunStatus(row, e.target.value)}>
                              {RUN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button onClick={() => removeRun(row)} className="p-1.5 rounded hover:bg-red-50 text-red-500 ml-1" title="Delete run"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {runDetail && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Payslips — {runDetail.run.name}
                  </h2>
                  <span className="text-xs text-gray-500">{runDetail.records.length} record(s)</span>
                </div>
                {runDetail.records.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-sm">No payslips yet. Use the generate action to create them.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Employee</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Base</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Allowances</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Deductions</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Net</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {runDetail.records.map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-700">{employeeName(row)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{money(row.base_salary)}</td>
                            <td className="px-4 py-3 text-sm text-green-600">{money(row.allowances)}</td>
                            <td className="px-4 py-3 text-sm text-red-600">{money(row.deductions)}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{money(row.net_salary)}</td>
                            <td className="px-4 py-3"><span className={statusPill(row.status)}>{row.status}</span></td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {row.status !== 'paid' && (
                                <button onClick={() => changeRecordStatus(row, 'paid')} className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Mark paid"><Check className="w-4 h-4" /></button>
                              )}
                              <button onClick={() => removeRecord(row)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete payslip"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Payroll;
