import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { academicAPI, examAPI, resultAPI } from '../services/api';
import {
  Loader2,
  AlertCircle,
  Inbox,
  RefreshCw,
  Printer,
  Download,
  BarChart3,
  ClipboardList,
  Trophy,
} from 'lucide-react';

const inputClass =
  'block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const pctColor = (value) => {
  if (value === null || value === undefined) return 'text-gray-400';
  if (value >= 75) return 'text-green-600';
  if (value >= 50) return 'text-amber-600';
  return 'text-red-600';
};

const apiError = (err) => {
  const body = err.response?.data;
  const detail = Array.isArray(body?.data?.errors) && body.data.errors[0]?.message;
  return detail || body?.message || err.message || 'Request failed';
};

const classLabel = (row) => (row?.section ? `${row.name} (${row.section})` : row?.name || '—');
const studentName = (row) => [row?.first_name, row?.last_name].filter(Boolean).join(' ') || 'Student';
const studentLabel = (row) =>
  `${row?.admission_number || ''} — ${studentName(row)}`.trim();

const ResultPill = ({ value }) => {
  if (value === null || value === undefined) return <span className="text-gray-400">—</span>;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        value ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
      }`}
    >
      {value ? 'Pass' : 'Fail'}
    </span>
  );
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const Results = () => {
  const { user } = useAuth();

  const [mode, setMode] = useState('class');
  const [filters, setFilters] = useState({ academic_year_id: '', term_id: '', exam_id: '' });
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [examId, setExamId] = useState('');

  const [lookups, setLookups] = useState({ classes: [], students: [], academicYears: [], terms: [], exams: [] });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const refs = [
        ['classes', 'classes'],
        ['students', 'students'],
        ['academicYears', 'academic-years'],
        ['terms', 'terms'],
      ];
      const [entries, examsResponse] = await Promise.all([
        Promise.all(
          refs.map(async ([key, resource]) => {
            try {
              const response = await academicAPI.list(resource, { limit: 100 });
              return [key, response.data.data.items || []];
            } catch {
              return [key, []];
            }
          })
        ),
        examAPI.list({ limit: 100 }).catch(() => ({ data: { data: { items: [] } } })),
      ]);
      setLookups({
        ...Object.fromEntries(entries),
        exams: examsResponse.data.data.items || [],
      });
    };
    load();
  }, []);

  const loadResults = async () => {
    setError('');
    setResult(null);
    setLoading(true);
    try {
      if (mode === 'class') {
        if (!classId) throw { response: { data: { message: 'Select a class' } } };
        const params = { class_id: classId };
        if (filters.academic_year_id) params.academic_year_id = filters.academic_year_id;
        if (filters.term_id) params.term_id = filters.term_id;
        if (filters.exam_id) params.exam_id = filters.exam_id;
        const response = await resultAPI.list(params);
        setResult(response.data.data);
      } else if (mode === 'student') {
        if (!studentId) throw { response: { data: { message: 'Select a student' } } };
        const params = {};
        if (filters.academic_year_id) params.academic_year_id = filters.academic_year_id;
        if (filters.term_id) params.term_id = filters.term_id;
        if (filters.exam_id) params.exam_id = filters.exam_id;
        const response = await resultAPI.reportCard(studentId, params);
        setResult(response.data.data);
      } else {
        if (!examId) throw { response: { data: { message: 'Select an exam' } } };
        const response = await examAPI.results(examId);
        setResult(response.data.data);
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  // ---- Report card print / download ----
  const buildReportHtml = (report, institutionName) => {
    const rows = report.exams
      .map(
        (exam) => `
        <tr>
          <td>${escapeHtml(exam.exam_name)}</td>
          <td>${escapeHtml(exam.exam_type?.name || '—')}</td>
          <td>${escapeHtml(exam.subject?.name || '—')}</td>
          <td>${escapeHtml(exam.exam_date || '—')}</td>
          <td style="text-align:center">${exam.marks_obtained ?? (exam.is_absent ? 'Absent' : '—')}</td>
          <td style="text-align:center">${exam.max_marks}</td>
          <td style="text-align:center">${exam.percentage ?? '—'}%</td>
          <td style="text-align:center">${escapeHtml(exam.grade || '—')}</td>
          <td style="text-align:center;color:${exam.is_pass === false ? '#dc2626' : '#16a34a'}">${
            exam.graded ? (exam.is_pass ? 'Pass' : 'Fail') : '—'
          }</td>
        </tr>`
      )
      .join('');

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Report Card - ${escapeHtml(studentName(report.student))}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 32px; }
  h1 { font-size: 20px; margin: 0; }
  .muted { color: #6b7280; font-size: 12px; }
  .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; }
  .grid { display: flex; gap: 24px; margin: 16px 0; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; min-width: 120px; }
  .card .label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
  .card .value { font-size: 18px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 12px; text-align: left; }
  th { background: #f3f4f6; }
  .summary { margin-top: 16px; font-size: 13px; }
</style></head>
<body>
  <div class="header">
    <h1>${escapeHtml(institutionName || 'Univora')}</h1>
    <p class="muted">Student Report Card</p>
  </div>
  <div class="grid">
    <div class="card"><div class="label">Student</div><div class="value" style="font-size:14px">${escapeHtml(studentName(report.student))}</div></div>
    <div class="card"><div class="label">Admission No.</div><div class="value" style="font-size:14px">${escapeHtml(report.student.admission_number || '—')}</div></div>
    <div class="card"><div class="label">Overall</div><div class="value">${report.summary.percentage ?? '—'}%</div></div>
    <div class="card"><div class="label">Grade</div><div class="value">${escapeHtml(report.summary.grade || '—')}</div></div>
    <div class="card"><div class="label">Result</div><div class="value" style="color:${report.summary.is_pass === false ? '#dc2626' : '#16a34a'}">${
      report.summary.is_pass === null ? '—' : report.summary.is_pass ? 'PASS' : 'FAIL'
    }</div></div>
  </div>
  <table>
    <thead><tr><th>Exam</th><th>Type</th><th>Subject</th><th>Date</th><th>Marks</th><th>Max</th><th>%</th><th>Grade</th><th>Result</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="9" style="text-align:center">No results recorded</td></tr>'}</tbody>
  </table>
  <p class="summary">
    Total obtained: <strong>${report.summary.obtained_marks}</strong> / ${report.summary.total_max_marks} ·
    Graded exams: ${report.summary.graded_exams} ·
    Failed: ${report.summary.failed_exams}
  </p>
</body></html>`;
  };

  const printReportCard = () => {
    if (!result || result.mode !== 'student') return;
    const html = buildReportHtml(result, user?.profile?.institution?.name);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const downloadReportCard = () => {
    if (!result || result.mode !== 'student') return;
    const header = ['Exam', 'Type', 'Subject', 'Date', 'Marks Obtained', 'Max Marks', 'Percentage', 'Grade', 'Result'];
    const csvRows = result.exams.map((exam) =>
      [
        exam.exam_name,
        exam.exam_type?.name || '',
        exam.subject?.name || '',
        exam.exam_date || '',
        exam.is_absent ? 'Absent' : exam.marks_obtained ?? '',
        exam.max_marks,
        exam.percentage ?? '',
        exam.grade || '',
        exam.graded ? (exam.is_pass ? 'Pass' : 'Fail') : '',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-card-${result.student.admission_number || result.student.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const modes = [
    { key: 'class', label: 'Class-wise', icon: ClipboardList },
    { key: 'student', label: 'Student-wise', icon: Trophy },
    { key: 'exam', label: 'Exam-wise', icon: BarChart3 },
  ];

  return (
    <div className="bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-11 h-11 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Results</h1>
            <p className="text-sm text-gray-600">Class-wise and student-wise results with printable report cards.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {modes.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setMode(item.key);
                  setResult(null);
                  setError('');
                }}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === item.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {mode === 'class' && (
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
                <option value="">Select class</option>
                {lookups.classes.map((row) => (
                  <option key={row.id} value={row.id}>{classLabel(row)}</option>
                ))}
              </select>
            )}
            {mode === 'student' && (
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputClass}>
                <option value="">Select student</option>
                {lookups.students.map((row) => (
                  <option key={row.id} value={row.id}>{studentLabel(row)}</option>
                ))}
              </select>
            )}
            {mode === 'exam' && (
              <select value={examId} onChange={(e) => setExamId(e.target.value)} className={inputClass}>
                <option value="">Select exam</option>
                {lookups.exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name} · {exam.class ? classLabel(exam.class) : ''}
                  </option>
                ))}
              </select>
            )}
            <select value={filters.academic_year_id} onChange={(e) => setFilters((p) => ({ ...p, academic_year_id: e.target.value }))} className={inputClass}>
              <option value="">All academic years</option>
              {lookups.academicYears.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
            <select value={filters.term_id} onChange={(e) => setFilters((p) => ({ ...p, term_id: e.target.value }))} className={inputClass}>
              <option value="">All terms</option>
              {lookups.terms.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
            {mode === 'class' && (
              <select value={filters.exam_id} onChange={(e) => setFilters((p) => ({ ...p, exam_id: e.target.value }))} className={inputClass}>
                <option value="">All exams</option>
                {lookups.exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>{exam.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={loadResults}
              disabled={loading}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Load Results
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            Loading results...
          </div>
        ) : !result ? (
          <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-200">
            <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            Choose filters and load results.
          </div>
        ) : result.mode === 'class' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{classLabel(result.class)}</h2>
                <p className="text-sm text-gray-500">
                  {result.exams.length} exam{result.exams.length === 1 ? '' : 's'} · {result.students.length} students
                </p>
              </div>
            </div>
            {result.students.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No students or results for this class yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Marks</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Percentage</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Grade</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.students.map((row) => (
                      <tr key={row.student_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{row.rank ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{studentLabel(row.student)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.obtained_marks} / {row.total_max_marks}</td>
                        <td className={`px-4 py-3 text-sm font-semibold ${pctColor(row.percentage)}`}>
                          {row.percentage === null ? '—' : `${row.percentage}%`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.grade || '—'}</td>
                        <td className="px-4 py-3"><ResultPill value={row.is_pass} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : result.mode === 'exam' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{result.exam.name}</h2>
              <p className="text-sm text-gray-500">
                {result.exam.class ? classLabel(result.exam.class) : ''} · Max {Number(result.exam.max_marks)}
              </p>
            </div>
            {result.students.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No marks recorded for this exam yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Marks</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Percentage</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Grade</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.students.map((row) => (
                      <tr key={row.student_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{row.rank}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{studentLabel(row.student)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row.is_absent ? 'Absent' : row.marks_obtained ?? '—'} / {row.max_marks}
                        </td>
                        <td className={`px-4 py-3 text-sm font-semibold ${pctColor(row.percentage)}`}>
                          {row.percentage === null ? '—' : `${row.percentage}%`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.grade || '—'}</td>
                        <td className="px-4 py-3"><ResultPill value={row.is_pass} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{studentName(result.student)}</h2>
                <p className="text-sm text-gray-500">Admission No. {result.student.admission_number || '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={printReportCard}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </button>
                <button
                  onClick={downloadReportCard}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500">Percentage</p>
                <p className={`text-xl font-bold ${pctColor(result.summary.percentage)}`}>
                  {result.summary.percentage === null ? '—' : `${result.summary.percentage}%`}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500">Grade</p>
                <p className="text-xl font-bold text-gray-900">{result.summary.grade || '—'}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500">Marks</p>
                <p className="text-xl font-bold text-gray-900">
                  {result.summary.obtained_marks}/{result.summary.total_max_marks}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500">Result</p>
                <p className={`text-xl font-bold ${
                  result.summary.is_pass === null ? 'text-gray-400' : result.summary.is_pass ? 'text-green-600' : 'text-red-600'
                }`}>
                  {result.summary.is_pass === null ? '—' : result.summary.is_pass ? 'PASS' : 'FAIL'}
                </p>
              </div>
            </div>

            {result.exams.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No results recorded for this student.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Exam</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Marks</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">%</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Grade</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.exams.map((exam) => (
                      <tr key={exam.exam_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{exam.exam_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{exam.exam_type?.name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{exam.subject?.name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{exam.exam_date || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {exam.is_absent ? 'Absent' : exam.marks_obtained ?? '—'} / {exam.max_marks}
                        </td>
                        <td className={`px-4 py-3 text-sm font-semibold ${pctColor(exam.percentage)}`}>
                          {exam.percentage === null ? '—' : `${exam.percentage}%`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{exam.grade || '—'}</td>
                        <td className="px-4 py-3"><ResultPill value={exam.is_pass} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Results;
