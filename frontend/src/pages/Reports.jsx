import { useEffect, useState } from 'react';
import { academicAPI, feeAPI, payrollAPI } from '../services/api';
import { inputClass, apiError, money, monthName, downloadCsv, printHtml, escapeHtml } from '../utils/helpers';
import {
  FileText,
  Loader2,
  AlertCircle,
  RefreshCw,
  Download,
  Printer,
  Inbox,
} from 'lucide-react';

const METHODS = ['cash', 'bank_transfer', 'card', 'cheque', 'online', 'other'];
const methodLabel = (value) => String(value || '').replace(/_/g, ' ');
const classLabel = (row) => (row?.section ? `${row.name} (${row.section})` : row?.name || '—');
const studentLabel = (row) =>
  `${row?.admission_number || ''} — ${[row?.first_name, row?.last_name].filter(Boolean).join(' ')}`.trim();

const Reports = () => {
  const [tab, setTab] = useState('collections');
  const [lookups, setLookups] = useState({ classes: [], types: [], years: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [collectionFilters, setCollectionFilters] = useState({ from: '', to: '', method: '', class_id: '', fee_type_id: '' });
  const [collections, setCollections] = useState(null);

  const [outstandingFilters, setOutstandingFilters] = useState({ academic_year_id: '', class_id: '', overdue: false, status: '' });
  const [outstanding, setOutstanding] = useState(null);

  const [payrollFilters, setPayrollFilters] = useState({ period_year: '', period_month: '' });
  const [payroll, setPayroll] = useState(null);

  useEffect(() => {
    Promise.all([
      academicAPI.list('classes', { limit: 100 }).then((r) => r.data.data.items || []).catch(() => []),
      academicAPI.list('academic-years', { limit: 100 }).then((r) => r.data.data.items || []).catch(() => []),
      feeAPI.listTypes({ limit: 100 }).then((r) => r.data.data.items || []).catch(() => []),
    ]).then(([classes, years, types]) => setLookups({ classes, years, types }));
  }, []);

  const load = async (type) => {
    setLoading(true);
    setError('');
    try {
      if (type === 'collections') {
        const params = {};
        Object.entries(collectionFilters).forEach(([key, value]) => { if (value) params[key] = value; });
        setCollections((await feeAPI.collectionsReport(params)).data.data);
      } else if (type === 'outstanding') {
        const params = {};
        if (outstandingFilters.academic_year_id) params.academic_year_id = outstandingFilters.academic_year_id;
        if (outstandingFilters.class_id) params.class_id = outstandingFilters.class_id;
        if (outstandingFilters.status) params.status = outstandingFilters.status;
        if (outstandingFilters.overdue) params.overdue = 'true';
        setOutstanding((await feeAPI.outstandingReport(params)).data.data);
      } else {
        const params = {};
        if (payrollFilters.period_year) params.period_year = payrollFilters.period_year;
        if (payrollFilters.period_month) params.period_month = payrollFilters.period_month;
        setPayroll((await payrollAPI.monthlyReport(params)).data.data);
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const exportCollections = () => {
    if (!collections) return;
    downloadCsv('collections-report.csv', [
      ['Date', 'Payments', 'Total'],
      ...collections.days.map((d) => [d.date, d.count, d.total]),
      ['TOTAL', collections.count, collections.total],
    ]);
  };

  const printCollections = () => {
    if (!collections) return;
    const rows = collections.days
      .map((d) => `<tr><td>${escapeHtml(d.date)}</td><td>${d.count}</td><td>${escapeHtml(money(d.total))}</td></tr>`)
      .join('');
    printHtml('Collections report', `
      <div class="header"><h1>Collections Report</h1>
      <div class="muted">${escapeHtml(collections.filters.from || 'start')} → ${escapeHtml(collections.filters.to || 'today')}</div></div>
      <table><thead><tr><th>Date</th><th>Payments</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="totals">Total collected: ${escapeHtml(money(collections.total))} (${collections.count} payments)</p>`);
  };

  const exportOutstanding = () => {
    if (!outstanding) return;
    downloadCsv('outstanding-report.csv', [
      ['Student', 'Admission', 'Fee', 'Due', 'Outstanding', 'Overdue'],
      ...outstanding.students.map((s) => [
        [s.student?.first_name, s.student?.last_name].filter(Boolean).join(' '),
        s.student?.admission_number || '',
        s.fee_structure?.name || '',
        s.amount_due,
        s.outstanding,
        s.is_overdue ? 'yes' : 'no',
      ]),
      ['TOTAL', '', '', '', outstanding.total_outstanding, ''],
    ]);
  };

  const printOutstanding = () => {
    if (!outstanding) return;
    const rows = outstanding.students
      .map((s) => `<tr><td>${escapeHtml(studentLabel(s.student))}</td><td>${escapeHtml(s.fee_structure?.name || '')}</td><td>${escapeHtml(money(s.amount_due))}</td><td>${escapeHtml(money(s.outstanding))}</td><td>${s.is_overdue ? 'Yes' : 'No'}</td></tr>`)
      .join('');
    printHtml('Outstanding report', `
      <div class="header"><h1>Outstanding Fees Report</h1>
      <div class="muted">Generated ${escapeHtml(new Date(outstanding.generated_at).toLocaleString())}</div></div>
      <table><thead><tr><th>Student</th><th>Fee</th><th>Due</th><th>Outstanding</th><th>Overdue</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="totals">Total outstanding: ${escapeHtml(money(outstanding.total_outstanding))} (${outstanding.count} accounts)</p>`);
  };

  const exportPayroll = () => {
    if (!payroll) return;
    downloadCsv('payroll-report.csv', [
      ['Period', 'Run', 'Headcount', 'Gross', 'Deductions', 'Net', 'Paid', 'Pending'],
      ...payroll.months.map((m) => [
        `${monthName(m.run.period_month)} ${m.run.period_year}`,
        m.run.name,
        m.totals.headcount,
        m.totals.gross,
        m.totals.deductions,
        m.totals.net,
        m.totals.paid,
        m.totals.pending,
      ]),
      ['TOTAL', '', payroll.totals.headcount, payroll.totals.gross, payroll.totals.deductions, payroll.totals.net, payroll.totals.paid, payroll.totals.pending],
    ]);
  };

  const printPayroll = () => {
    if (!payroll) return;
    const rows = payroll.months
      .map((m) => `<tr><td>${escapeHtml(monthName(m.run.period_month))} ${m.run.period_year}</td><td>${escapeHtml(m.run.name)}</td><td>${m.totals.headcount}</td><td>${escapeHtml(money(m.totals.gross))}</td><td>${escapeHtml(money(m.totals.net))}</td><td>${escapeHtml(money(m.totals.paid))}</td><td>${escapeHtml(money(m.totals.pending))}</td></tr>`)
      .join('');
    printHtml('Monthly payroll report', `
      <div class="header"><h1>Monthly Payroll Report</h1></div>
      <table><thead><tr><th>Period</th><th>Run</th><th>Staff</th><th>Gross</th><th>Net</th><th>Paid</th><th>Pending</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="totals">Total net: ${escapeHtml(money(payroll.totals.net))} · Paid: ${escapeHtml(money(payroll.totals.paid))} · Pending: ${escapeHtml(money(payroll.totals.pending))}</p>`);
  };

  const tabs = [
    { key: 'collections', label: 'Collections' },
    { key: 'outstanding', label: 'Outstanding Fees' },
    { key: 'payroll', label: 'Payroll' },
  ];

  return (
    <div className="bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-11 h-11 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-600">Date-wise collections, outstanding fees and monthly payroll — export or print.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === item.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center py-4 text-gray-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
        )}

        {/* Collections */}
        {tab === 'collections' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-end gap-3">
              <div><label className="block text-xs font-medium text-gray-500 mb-1">From</label><input className={inputClass} type="date" value={collectionFilters.from} onChange={(e) => setCollectionFilters((p) => ({ ...p, from: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">To</label><input className={inputClass} type="date" value={collectionFilters.to} onChange={(e) => setCollectionFilters((p) => ({ ...p, to: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Method</label><select className={inputClass} value={collectionFilters.method} onChange={(e) => setCollectionFilters((p) => ({ ...p, method: e.target.value }))}><option value="">All</option>{METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Class</label><select className={inputClass} value={collectionFilters.class_id} onChange={(e) => setCollectionFilters((p) => ({ ...p, class_id: e.target.value }))}><option value="">All</option>{lookups.classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Fee type</label><select className={inputClass} value={collectionFilters.fee_type_id} onChange={(e) => setCollectionFilters((p) => ({ ...p, fee_type_id: e.target.value }))}><option value="">All</option>{lookups.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <button onClick={() => load('collections')} className="inline-flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"><RefreshCw className="w-4 h-4 mr-2" /> Generate</button>
              <button onClick={exportCollections} disabled={!collections} className="inline-flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"><Download className="w-4 h-4 mr-2" /> CSV</button>
              <button onClick={printCollections} disabled={!collections} className="inline-flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"><Printer className="w-4 h-4 mr-2" /> Print</button>
            </div>

            {collections && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">Daily collections</h2>
                  <span className="text-sm font-semibold text-gray-900">Total {money(collections.total)}</span>
                </div>
                {collections.days.length === 0 ? (
                  <div className="text-center py-16 text-gray-500"><Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />No collections in this range.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Payments</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {collections.days.map((d) => (
                          <tr key={d.date}><td className="px-4 py-3 text-sm text-gray-700">{d.date}</td><td className="px-4 py-3 text-sm text-gray-600">{d.count}</td><td className="px-4 py-3 text-sm font-semibold text-gray-900">{money(d.total)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Outstanding */}
        {tab === 'outstanding' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-end gap-3">
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Academic year</label><select className={inputClass} value={outstandingFilters.academic_year_id} onChange={(e) => setOutstandingFilters((p) => ({ ...p, academic_year_id: e.target.value }))}><option value="">All</option>{lookups.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Class</label><select className={inputClass} value={outstandingFilters.class_id} onChange={(e) => setOutstandingFilters((p) => ({ ...p, class_id: e.target.value }))}><option value="">All</option>{lookups.classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Status</label><select className={inputClass} value={outstandingFilters.status} onChange={(e) => setOutstandingFilters((p) => ({ ...p, status: e.target.value }))}><option value="">Any</option><option value="pending">Pending</option><option value="partial">Partial</option></select></div>
              <label className="flex items-center text-sm text-gray-600 mb-2.5"><input type="checkbox" className="mr-2" checked={outstandingFilters.overdue} onChange={(e) => setOutstandingFilters((p) => ({ ...p, overdue: e.target.checked }))} /> Overdue only</label>
              <button onClick={() => load('outstanding')} className="inline-flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"><RefreshCw className="w-4 h-4 mr-2" /> Generate</button>
              <button onClick={exportOutstanding} disabled={!outstanding} className="inline-flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"><Download className="w-4 h-4 mr-2" /> CSV</button>
              <button onClick={printOutstanding} disabled={!outstanding} className="inline-flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"><Printer className="w-4 h-4 mr-2" /> Print</button>
            </div>

            {outstanding && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">Outstanding accounts ({outstanding.count})</h2>
                  <span className="text-sm font-semibold text-gray-900">Total {money(outstanding.total_outstanding)}</span>
                </div>
                {outstanding.students.length === 0 ? (
                  <div className="text-center py-16 text-gray-500"><Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />No outstanding fees.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fee</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Outstanding</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due date</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Overdue</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {outstanding.students.map((s) => (
                          <tr key={s.id}>
                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{studentLabel(s.student)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{s.fee_structure?.name || '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{money(s.amount_due)}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{money(s.outstanding)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{s.due_date || '—'}</td>
                            <td className="px-4 py-3 text-sm">{s.is_overdue ? <span className="text-red-600 font-medium">Yes</span> : <span className="text-gray-400">No</span>}</td>
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

        {/* Payroll */}
        {tab === 'payroll' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-end gap-3">
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Year</label><input className={`${inputClass} max-w-[120px]`} type="number" min="2000" max="2100" value={payrollFilters.period_year} onChange={(e) => setPayrollFilters((p) => ({ ...p, period_year: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Month</label><select className={inputClass} value={payrollFilters.period_month} onChange={(e) => setPayrollFilters((p) => ({ ...p, period_month: e.target.value }))}><option value="">All</option>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{monthName(m)}</option>)}</select></div>
              <button onClick={() => load('payroll')} className="inline-flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"><RefreshCw className="w-4 h-4 mr-2" /> Generate</button>
              <button onClick={exportPayroll} disabled={!payroll} className="inline-flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"><Download className="w-4 h-4 mr-2" /> CSV</button>
              <button onClick={printPayroll} disabled={!payroll} className="inline-flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"><Printer className="w-4 h-4 mr-2" /> Print</button>
            </div>

            {payroll && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-200"><h2 className="text-sm font-semibold text-gray-900">Monthly payroll</h2></div>
                {payroll.months.length === 0 ? (
                  <div className="text-center py-16 text-gray-500"><Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />No payroll runs found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Period</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Staff</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Gross</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Deductions</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Net</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Paid</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pending</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {payroll.months.map((m) => (
                          <tr key={m.run.id}>
                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{monthName(m.run.period_month)} {m.run.period_year}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{m.totals.headcount}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{money(m.totals.gross)}</td>
                            <td className="px-4 py-3 text-sm text-red-600">{money(m.totals.deductions)}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{money(m.totals.net)}</td>
                            <td className="px-4 py-3 text-sm text-green-600">{money(m.totals.paid)}</td>
                            <td className="px-4 py-3 text-sm text-amber-600">{money(m.totals.pending)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-700">{payroll.totals.headcount}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-700">{money(payroll.totals.gross)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-700">{money(payroll.totals.deductions)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{money(payroll.totals.net)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-700">{money(payroll.totals.paid)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-700">{money(payroll.totals.pending)}</td>
                        </tr>
                      </tfoot>
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

export default Reports;
