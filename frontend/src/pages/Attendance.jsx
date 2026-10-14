import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { academicAPI, attendanceAPI } from '../services/api';
import {
  CalendarCheck,
  Loader2,
  X,
  AlertCircle,
  Users,
  Save,
  History,
  BellRing,
  Settings as SettingsIcon,
  RefreshCw,
  CheckCircle2,
  Inbox,
} from 'lucide-react';

const ADMIN_ROLES = ['owner', 'admin', 'super_admin'];
const STAFF_ROLES = [...ADMIN_ROLES, 'faculty'];

const STATUSES = [
  { value: 'present', label: 'Present', style: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'absent', label: 'Absent', style: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'late', label: 'Late', style: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'excused', label: 'Excused', style: 'bg-blue-50 text-blue-700 border-blue-200' },
];

const statusStyle = (value) => STATUSES.find((s) => s.value === value)?.style || 'bg-gray-100 text-gray-600 border-gray-200';
const today = () => new Date().toISOString().slice(0, 10);

const pctColor = (value) => {
  if (value >= 85) return 'text-green-600';
  if (value >= 75) return 'text-amber-600';
  return 'text-red-600';
};

const StatusPill = ({ value }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${statusStyle(value)}`}>
    {value}
  </span>
);

const Attendance = () => {
  const { user } = useAuth();
  const role = user?.profile?.role;
  const isAdmin = ADMIN_ROLES.includes(role);
  const isStaff = STAFF_ROLES.includes(role);

  const [tab, setTab] = useState('mark');
  const [error, setError] = useState('');
  const [lookups, setLookups] = useState({ classes: [], students: [] });

  // Mark tab
  const [markClass, setMarkClass] = useState('');
  const [markDate, setMarkDate] = useState(today());
  const [roster, setRoster] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [savingMark, setSavingMark] = useState(false);
  const [markNotice, setMarkNotice] = useState('');

  // History tab
  const [historyClass, setHistoryClass] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [detail, setDetail] = useState(null);

  // Alerts tab
  const [alertClass, setAlertClass] = useState('');
  const [alerts, setAlerts] = useState(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [summaryStudent, setSummaryStudent] = useState('');
  const [studentSummary, setStudentSummary] = useState(null);

  // Settings tab
  const [settings, setSettings] = useState({ low_attendance_threshold: 75, alerts_enabled: true });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState('');

  useEffect(() => {
    const load = async () => {
      const [classes, students] = await Promise.all([
        academicAPI.list('classes', { limit: 100 }).then((r) => r.data.data.items || []).catch(() => []),
        academicAPI.list('students', { limit: 100 }).then((r) => r.data.data.items || []).catch(() => []),
      ]);
      setLookups({ classes, students });
    };
    load();
    attendanceAPI
      .settings()
      .then((r) => setSettings(r.data.data))
      .catch(() => {});
  }, []);

  const classLabel = (row) => (row.section ? `${row.name} (${row.section})` : row.name);
  const studentLabel = (row) =>
    `${row.admission_number || ''} — ${[row.first_name, row.last_name].filter(Boolean).join(' ')}`.trim();

  // ---- Mark tab ----
  const loadRoster = async () => {
    if (!markClass) {
      setError('Select a class to load its roster.');
      return;
    }
    setError('');
    setMarkNotice('');
    setLoadingRoster(true);
    try {
      const [enrollmentsResponse, sessionsResponse] = await Promise.all([
        academicAPI.list('enrollments', { class_id: markClass, limit: 100 }),
        attendanceAPI.listSessions({ class_id: markClass, from: markDate, to: markDate, limit: 5 }),
      ]);

      const enrolledStudents = (enrollmentsResponse.data.data.items || [])
        .filter((row) => row.status === 'enrolled')
        .map((row) => row.student)
        .filter(Boolean);

      const existing = (sessionsResponse.data.data.items || [])[0];
      let existingRecords = {};
      let existingId = null;

      if (existing) {
        const detailResponse = await attendanceAPI.session(existing.id);
        existingId = existing.id;
        (detailResponse.data.data.records || []).forEach((record) => {
          existingRecords[record.student_id] = record;
        });
      }

      setSessionId(existingId);
      setRoster(
        enrolledStudents.map((student) => ({
          student,
          status: existingRecords[student.id]?.status || 'present',
          remarks: existingRecords[student.id]?.remarks || '',
        }))
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load roster');
    } finally {
      setLoadingRoster(false);
    }
  };

  const setRosterField = (studentId, key, value) =>
    setRoster((prev) => prev.map((row) => (row.student.id === studentId ? { ...row, [key]: value } : row)));

  const markAll = (status) => setRoster((prev) => prev.map((row) => ({ ...row, status })));

  const saveAttendance = async () => {
    if (!roster.length) return;
    setSavingMark(true);
    setError('');
    setMarkNotice('');
    try {
      let sid = sessionId;
      if (!sid) {
        const created = await attendanceAPI.createSession({ class_id: markClass, session_date: markDate });
        sid = created.data.data.id;
        setSessionId(sid);
      }
      await attendanceAPI.mark(
        sid,
        roster.map((row) => ({ student_id: row.student.id, status: row.status, remarks: row.remarks }))
      );
      setMarkNotice(`Attendance saved for ${roster.length} student${roster.length === 1 ? '' : 's'}.`);
    } catch (err) {
      const body = err.response?.data;
      const detail = Array.isArray(body?.data?.errors) && body.data.errors[0]?.message;
      setError(detail || body?.message || 'Failed to save attendance');
    } finally {
      setSavingMark(false);
    }
  };

  // ---- History tab ----
  const loadHistory = async () => {
    setLoadingHistory(true);
    setError('');
    try {
      const params = { limit: 50 };
      if (historyClass) params.class_id = historyClass;
      if (historyFrom) params.from = historyFrom;
      if (historyTo) params.to = historyTo;
      const response = await attendanceAPI.listSessions(params);
      setSessions(response.data.data.items || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (tab === 'history') loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const openDetail = async (id) => {
    try {
      const response = await attendanceAPI.session(id);
      setDetail(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load session');
    }
  };

  // ---- Alerts tab ----
  const loadAlerts = async () => {
    setLoadingAlerts(true);
    setError('');
    try {
      const params = {};
      if (alertClass) params.class_id = alertClass;
      const response = await attendanceAPI.alerts(params);
      setAlerts(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load alerts');
    } finally {
      setLoadingAlerts(false);
    }
  };

  useEffect(() => {
    if (tab === 'alerts' && !alerts) loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const loadStudentSummary = async () => {
    if (!summaryStudent) return;
    try {
      const response = await attendanceAPI.studentSummary(summaryStudent);
      setStudentSummary(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load student summary');
    }
  };

  // ---- Settings tab ----
  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsNotice('');
    setError('');
    try {
      const response = await attendanceAPI.updateSettings({
        low_attendance_threshold: Number(settings.low_attendance_threshold),
        alerts_enabled: Boolean(settings.alerts_enabled),
      });
      setSettings(response.data.data);
      setSettingsNotice('Settings saved.');
    } catch (err) {
      const body = err.response?.data;
      const detail = Array.isArray(body?.data?.errors) && body.data.errors[0]?.message;
      setError(detail || body?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const tabs = [
    { key: 'mark', label: 'Mark', icon: CheckCircle2 },
    { key: 'history', label: 'History', icon: History },
    { key: 'alerts', label: 'Alerts', icon: BellRing },
    { key: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const inputClass =
    'block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="bg-slate-50">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-11 h-11 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <CalendarCheck className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
            <p className="text-sm text-gray-600">Mark attendance, review history and track low attendance.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
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
        </div>

        {tab === 'mark' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select value={markClass} onChange={(e) => setMarkClass(e.target.value)} className={inputClass}>
                  <option value="">Select class</option>
                  {lookups.classes.map((row) => (
                    <option key={row.id} value={row.id}>{classLabel(row)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={markDate} onChange={(e) => setMarkDate(e.target.value)} className={inputClass} />
              </div>
              <div className="flex items-end">
                <button
                  onClick={loadRoster}
                  disabled={loadingRoster}
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingRoster ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
                  Load Roster
                </button>
              </div>
            </div>

            {markNotice && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center">
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {markNotice}
              </div>
            )}

            {roster.length > 0 && isStaff && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-sm text-gray-500 mr-1">Mark all:</span>
                {STATUSES.map((status) => (
                  <button
                    key={status.value}
                    onClick={() => markAll(status.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${status.style}`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            )}

            {roster.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                Load a class roster to mark attendance.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {roster.map((row) => (
                        <tr key={row.student.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{studentLabel(row.student)}</td>
                          <td className="px-4 py-3">
                            <select
                              value={row.status}
                              disabled={!isStaff}
                              onChange={(e) => setRosterField(row.student.id, 'status', e.target.value)}
                              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 capitalize"
                            >
                              {STATUSES.map((status) => (
                                <option key={status.value} value={status.value}>{status.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={row.remarks}
                              disabled={!isStaff}
                              onChange={(e) => setRosterField(row.student.id, 'remarks', e.target.value)}
                              placeholder="Optional"
                              className="w-full min-w-[10rem] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {isStaff && (
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={saveAttendance}
                      disabled={savingMark}
                      className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingMark ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Attendance
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
              <select value={historyClass} onChange={(e) => setHistoryClass(e.target.value)} className={inputClass}>
                <option value="">All classes</option>
                {lookups.classes.map((row) => (
                  <option key={row.id} value={row.id}>{classLabel(row)}</option>
                ))}
              </select>
              <input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} className={inputClass} />
              <input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} className={inputClass} />
              <button
                onClick={loadHistory}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Apply
              </button>
            </div>

            {loadingHistory ? (
              <div className="text-center py-12 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                Loading...
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No attendance sessions found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Faculty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sessions.map((session) => (
                      <tr key={session.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {session.session_date}
                          {session.start_time ? ` · ${String(session.start_time).slice(0, 5)}` : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {session.class?.name}
                          {session.class?.section ? ` (${session.class.section})` : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {session.faculty ? [session.faculty.first_name, session.faculty.last_name].filter(Boolean).join(' ') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill value={session.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openDetail(session.id)} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'alerts' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Low-attendance alerts</h2>
                  <p className="text-sm text-gray-600">
                    Students below the configured threshold
                    {alerts ? ` (${alerts.threshold}%)` : ''}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select value={alertClass} onChange={(e) => setAlertClass(e.target.value)} className={inputClass}>
                    <option value="">All classes</option>
                    {lookups.classes.map((row) => (
                      <option key={row.id} value={row.id}>{classLabel(row)}</option>
                    ))}
                  </select>
                  <button
                    onClick={loadAlerts}
                    className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 whitespace-nowrap"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </button>
                </div>
              </div>

              {loadingAlerts ? (
                <div className="text-center py-12 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                  Loading...
                </div>
              ) : !alerts || alerts.students.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-300" />
                  No students are below the attendance threshold.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Attendance</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Present</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Absent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {alerts.students.map((row) => (
                        <tr key={row.student_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {row.student ? studentLabel(row.student) : row.student_id}
                          </td>
                          <td className={`px-4 py-3 text-sm font-semibold ${pctColor(row.percentage)}`}>
                            {row.percentage}%
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{row.attended}/{row.total}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{row.absent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Student attendance summary</h2>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <select value={summaryStudent} onChange={(e) => setSummaryStudent(e.target.value)} className={inputClass}>
                  <option value="">Select student</option>
                  {lookups.students.map((row) => (
                    <option key={row.id} value={row.id}>{studentLabel(row)}</option>
                  ))}
                </select>
                <button
                  onClick={loadStudentSummary}
                  disabled={!summaryStudent}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                >
                  View Summary
                </button>
              </div>
              {studentSummary && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Percentage</p>
                    <p className={`text-xl font-bold ${pctColor(studentSummary.percentage)}`}>{studentSummary.percentage}%</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Present</p>
                    <p className="text-xl font-bold text-gray-900">{studentSummary.present}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Absent</p>
                    <p className="text-xl font-bold text-gray-900">{studentSummary.absent}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Sessions</p>
                    <p className="text-xl font-bold text-gray-900">{studentSummary.total}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 max-w-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Attendance settings</h2>
            <p className="text-sm text-gray-600 mb-4">Configure the low-attendance alert threshold for your institution.</p>

            {settingsNotice && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                {settingsNotice}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Low-attendance threshold (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.low_attendance_threshold}
                  disabled={!isAdmin}
                  onChange={(e) => setSettings((prev) => ({ ...prev, low_attendance_threshold: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean(settings.alerts_enabled)}
                  disabled={!isAdmin}
                  onChange={(e) => setSettings((prev) => ({ ...prev, alerts_enabled: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                Enable low-attendance alerts
              </label>
            </div>

            {isAdmin && (
              <div className="flex justify-end pt-5">
                <button
                  onClick={saveSettings}
                  disabled={savingSettings}
                  className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Settings
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {detail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setDetail(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {detail.class?.name}
                  {detail.class?.section ? ` (${detail.class.section})` : ''}
                </h3>
                <p className="text-sm text-gray-500">{detail.session_date}</p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5">
              {detail.records.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No records for this session.</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detail.records.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {record.student ? studentLabel(record.student) : record.student_id}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill value={record.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{record.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
