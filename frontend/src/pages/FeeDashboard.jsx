import { useEffect, useState } from 'react';
import { academicAPI, feeAPI } from '../services/api';
import { inputClass, apiError, money } from '../utils/helpers';
import {
  LayoutDashboard,
  Loader2,
  AlertCircle,
  RefreshCw,
  Users,
  Inbox,
} from 'lucide-react';

const studentLabel = (row) =>
  `${row?.admission_number || ''} — ${[row?.first_name, row?.last_name].filter(Boolean).join(' ')}`.trim();

const methodLabel = (value) => String(value || '').replace(/_/g, ' ');

const StatCard = ({ label, value, tone }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    gray: 'bg-gray-50 text-gray-700 border-gray-100',
  };
  return (
    <div className={`rounded-xl border p-5 ${tones[tone] || tones.gray}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
};

const FeeDashboard = () => {
  const [years, setYears] = useState([]);
  const [students, setStudents] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', academic_year_id: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [studentId, setStudentId] = useState('');
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    const params = {};
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.academic_year_id) params.academic_year_id = filters.academic_year_id;
    try {
      const response = await feeAPI.dashboard(params);
      setData(response.data.data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    academicAPI.list('academic-years', { limit: 100 })
      .then((r) => setYears(r.data.data.items || []))
      .catch(() => setYears([]));
    academicAPI.list('students', { limit: 100 })
      .then((r) => setStudents(r.data.data.items || []))
      .catch(() => setStudents([]));
    loadDashboard();
  }, []);

  const loadHistory = async (id) => {
    setStudentId(id);
    setHistory(null);
    if (!id) return;
    setHistoryLoading(true);
    setError('');
    try {
      const response = await feeAPI.studentHistory(id);
      setHistory(response.data.data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setHistoryLoading(false);
    }
  };

  const methodEntries = data ? Object.entries(data.by_method || {}) : [];

  return (
    <div className="bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-11 h-11 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <LayoutDashboard className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fee Dashboard</h1>
            <p className="text-sm text-gray-600">Track collections, pending dues and overdue balances.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap items-center gap-3">
          <input className={`${inputClass} max-w-[170px]`} type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} />
          <input className={`${inputClass} max-w-[170px]`} type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} />
          <select className={`${inputClass} max-w-[220px]`} value={filters.academic_year_id} onChange={(e) => setFilters((p) => ({ ...p, academic_year_id: e.target.value }))}>
            <option value="">All academic years</option>
            {years.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <button onClick={loadDashboard} className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4 mr-2" /> Apply
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Collected" value={money(data.collected)} tone="green" />
              <StatCard label="Pending dues" value={money(data.pending)} tone="amber" />
              <StatCard label="Overdue" value={money(data.overdue)} tone="red" />
              <StatCard label="Billed" value={money(data.billed)} tone="blue" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Collections by method</h2>
                {methodEntries.length === 0 ? (
                  <p className="text-sm text-gray-500">No payments in this range.</p>
                ) : (
                  <ul className="space-y-3">
                    {methodEntries.map(([method, total]) => (
                      <li key={method} className="flex items-center justify-between text-sm">
                        <span className="capitalize text-gray-600">{methodLabel(method)}</span>
                        <span className="font-semibold text-gray-900">{money(total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Summary</h2>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center justify-between"><span className="text-gray-600">Payments recorded</span><span className="font-semibold text-gray-900">{data.payment_count}</span></li>
                  <li className="flex items-center justify-between"><span className="text-gray-600">Fee assignments</span><span className="font-semibold text-gray-900">{data.assignment_count}</span></li>
                  <li className="flex items-center justify-between"><span className="text-gray-600">Overdue accounts</span><span className="font-semibold text-gray-900">{data.overdue_count}</span></li>
                  <li className="flex items-center justify-between"><span className="text-gray-600">Generated</span><span className="text-gray-500">{new Date(data.generated_at).toLocaleString()}</span></li>
                </ul>
              </div>
            </div>
          </>
        ) : null}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="w-4 h-4 mr-2 text-gray-500" /> Student-wise history
          </h2>
          <select className={`${inputClass} max-w-md mb-4`} value={studentId} onChange={(e) => loadHistory(e.target.value)}>
            <option value="">Select a student</option>
            {students.map((row) => <option key={row.id} value={row.id}>{studentLabel(row)}</option>)}
          </select>

          {historyLoading ? (
            <div className="flex items-center py-8 text-gray-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
          ) : history ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatCard label="Billed" value={money(history.summary.billed)} tone="blue" />
                <StatCard label="Paid" value={money(history.summary.paid)} tone="green" />
                <StatCard label="Discount" value={money(history.summary.discount)} tone="gray" />
                <StatCard label="Outstanding" value={money(history.summary.outstanding)} tone="amber" />
                <StatCard label="Overdue" value={money(history.summary.overdue)} tone="red" />
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fee</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Discount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Paid</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Outstanding</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.fees.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.fee_structure?.name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{money(row.amount_due)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{money(row.discount)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{money(row.amount_paid)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{money(row.outstanding)}</td>
                        <td className="px-4 py-3 text-sm capitalize text-gray-600">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Payments</h3>
                {history.payments.length === 0 ? (
                  <p className="text-sm text-gray-500">No payments recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Receipt</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Method</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Paid at</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {history.payments.map((row) => (
                          <tr key={row.id}>
                            <td className="px-4 py-3 text-sm text-gray-700">{row.receipt_number}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{money(row.amount)}</td>
                            <td className="px-4 py-3 text-sm capitalize text-gray-600">{methodLabel(row.method)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{row.paid_at ? new Date(row.paid_at).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <Inbox className="w-7 h-7 mx-auto mb-2 text-gray-300" />
              Select a student to view their fee history.
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FeeDashboard;
