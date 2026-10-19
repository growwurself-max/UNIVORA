import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { feeAPI, paymentAPI } from '../services/api';
import { inputClass, apiError, money, today, escapeHtml, printHtml } from '../utils/helpers';
import {
  CreditCard,
  Plus,
  Loader2,
  AlertCircle,
  Inbox,
  RefreshCw,
  Printer,
  Search,
} from 'lucide-react';

const ADMIN_ROLES = ['owner', 'admin', 'super_admin', 'staff', 'accountant'];
const METHODS = ['cash', 'bank_transfer', 'card', 'cheque', 'online', 'other'];

const studentLabel = (row) =>
  `${row?.admission_number || ''} — ${[row?.first_name, row?.last_name].filter(Boolean).join(' ')}`.trim();

const methodLabel = (value) => String(value || '').replace(/_/g, ' ');

const emptyForm = {
  student_id: '',
  student_fee_id: '',
  amount: '',
  method: 'cash',
  reference: '',
  paid_at: today(),
  notes: '',
};

const Payments = () => {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.profile?.role);

  const [students, setStudents] = useState([]);
  const [fees, setFees] = useState([]);
  const [payments, setPayments] = useState([]);
  const [filters, setFilters] = useState({ search: '', method: '', from: '', to: '' });
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadStudents = async () => {
    try {
      const response = await feeAPI.students({ limit: 100 });
      setStudents(response.data.data.items || []);
    } catch {
      setStudents([]);
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    setError('');
    const params = { limit: 100 };
    if (filters.method) params.method = filters.method;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.search) params.search = filters.search;
    try {
      const response = await paymentAPI.list(params);
      setPayments(response.data.data.items || []);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadStudentFees = async (studentId) => {
    if (!studentId) {
      setFees([]);
      return;
    }
    try {
      const response = await feeAPI.listAssignments({ student_id: studentId, limit: 100 });
      setFees((response.data.data.items || []).filter((fee) => Number(fee.outstanding) > 0));
    } catch (err) {
      setError(apiError(err));
      setFees([]);
    }
  };

  useEffect(() => {
    loadStudents();
    loadPayments();
  }, []);

  const selectStudent = (studentId) => {
    setForm((prev) => ({ ...prev, student_id: studentId, student_fee_id: '', amount: '' }));
    loadStudentFees(studentId);
  };

  const selectFee = (feeId) => {
    const fee = fees.find((row) => row.id === feeId);
    setForm((prev) => ({
      ...prev,
      student_fee_id: feeId,
      amount: fee ? String(fee.outstanding) : '',
    }));
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    if (!form.student_id || !form.student_fee_id || !form.amount) {
      setError('Select a student, a fee and an amount.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        student_id: form.student_id,
        student_fee_id: form.student_fee_id,
        amount: Number(form.amount),
        method: form.method,
        reference: form.reference || null,
        paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : undefined,
        notes: form.notes || null,
      };
      const response = await paymentAPI.create(payload);
      setNotice(`Payment recorded — receipt ${response.data.data.receipt_number}`);
      setForm(emptyForm);
      setFees([]);
      await loadPayments();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const printReceipt = async (row) => {
    setError('');
    try {
      const response = await paymentAPI.receipt(row.id);
      const data = response.data.data;
      const student = data.student || {};
      const studentName = [student.first_name, student.last_name].filter(Boolean).join(' ');
      const body = `
        <div class="header">
          <h1>${escapeHtml(data.institution?.name || 'Univora')}</h1>
          <div class="muted">Payment receipt · ${escapeHtml(data.receipt_number)}</div>
        </div>
        <table>
          <tr><th>Receipt number</th><td>${escapeHtml(data.receipt_number)}</td></tr>
          <tr><th>Student</th><td>${escapeHtml(studentName)} (${escapeHtml(student.admission_number || '—')})</td></tr>
          <tr><th>Amount paid</th><td>${escapeHtml(money(data.payment.amount))}</td></tr>
          <tr><th>Method</th><td>${escapeHtml(methodLabel(data.payment.method))}</td></tr>
          <tr><th>Reference</th><td>${escapeHtml(data.payment.reference || '—')}</td></tr>
          <tr><th>Paid at</th><td>${escapeHtml(new Date(data.payment.paid_at).toLocaleString())}</td></tr>
          <tr><th>Receipt issued</th><td>${escapeHtml(new Date(data.issued_at).toLocaleString())}</td></tr>
        </table>
        ${
          data.student_fee
            ? `<table>
                <tr><th>Fee amount</th><td>${escapeHtml(money(data.student_fee.amount_due))}</td></tr>
                <tr><th>Discount</th><td>${escapeHtml(money(data.student_fee.discount))}</td></tr>
                <tr><th>Total paid</th><td>${escapeHtml(money(data.student_fee.amount_paid))}</td></tr>
                <tr><th>Outstanding</th><td>${escapeHtml(money(data.student_fee.outstanding))}</td></tr>
                <tr><th>Status</th><td>${escapeHtml(data.student_fee.status)}</td></tr>
              </table>`
            : ''
        }
        <p class="totals">Thank you. This is a computer-generated receipt.</p>`;
      printHtml(`Receipt ${data.receipt_number}`, body);
    } catch (err) {
      setError(apiError(err));
    }
  };

  const outstandingFees = fees;

  return (
    <div className="bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-11 h-11 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
            <p className="text-sm text-gray-600">Record full or partial payments and issue printable receipts.</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {isAdmin && (
            <form onSubmit={submitPayment} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3 lg:col-span-1 h-fit">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Record payment</h2>
              <select className={inputClass} value={form.student_id} onChange={(e) => selectStudent(e.target.value)} required>
                <option value="">Select student</option>
                {students.map((row) => <option key={row.id} value={row.id}>{studentLabel(row)}</option>)}
              </select>
              <select className={inputClass} value={form.student_fee_id} onChange={(e) => selectFee(e.target.value)} required disabled={!form.student_id}>
                <option value="">{outstandingFees.length ? 'Select fee' : 'No outstanding fees'}</option>
                {outstandingFees.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.fee_structure?.name || 'Fee'} · outstanding {money(row.outstanding)}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClass} type="number" step="0.01" min="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required />
                <select className={inputClass} value={form.method} onChange={(e) => setForm((p) => ({ ...p, method: e.target.value }))}>
                  {METHODS.map((method) => <option key={method} value={method}>{methodLabel(method)}</option>)}
                </select>
              </div>
              <input className={inputClass} type="date" value={form.paid_at ? form.paid_at.slice(0, 10) : ''} onChange={(e) => setForm((p) => ({ ...p, paid_at: e.target.value }))} />
              <input className={inputClass} placeholder="Reference (optional)" value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} />
              <textarea className={inputClass} rows={2} placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
              <button type="submit" disabled={saving} className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Record payment
              </button>
            </form>
          )}

          <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input className={`${inputClass} pl-9`} placeholder="Search receipt / reference" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
              </div>
              <select className={`${inputClass} max-w-[160px]`} value={filters.method} onChange={(e) => setFilters((p) => ({ ...p, method: e.target.value }))}>
                <option value="">All methods</option>
                {METHODS.map((method) => <option key={method} value={method}>{methodLabel(method)}</option>)}
              </select>
              <input className={`${inputClass} max-w-[150px]`} type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} />
              <input className={`${inputClass} max-w-[150px]`} type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} />
              <button onClick={loadPayments} className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">
                <RefreshCw className="w-4 h-4 mr-2" /> Apply
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading payments…
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No payments recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Receipt</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Method</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Paid at</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{row.receipt_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{studentLabel(row.student)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{money(row.amount)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 capitalize">{methodLabel(row.method)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.paid_at ? new Date(row.paid_at).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button onClick={() => printReceipt(row)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Print receipt"><Printer className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Payments;
