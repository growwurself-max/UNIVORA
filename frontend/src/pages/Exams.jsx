import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { academicAPI, examAPI } from '../services/api';
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  X,
  AlertCircle,
  Inbox,
  Save,
  GraduationCap,
  Scale,
  ListChecks,
  ClipboardList,
} from 'lucide-react';

const ADMIN_ROLES = ['owner', 'admin', 'super_admin'];
const STAFF_ROLES = [...ADMIN_ROLES, 'faculty'];

const EXAM_STATUSES = ['scheduled', 'ongoing', 'completed', 'cancelled'];

const STATUS_STYLES = {
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  ongoing: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  active: 'bg-green-50 text-green-700 border-green-200',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200',
};

const StatusPill = ({ value }) => (
  <span
    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
      STATUS_STYLES[value] || 'bg-gray-100 text-gray-600 border-gray-200'
    }`}
  >
    {String(value || '').replace(/_/g, ' ')}
  </span>
);

const inputClass =
  'block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const emptyBand = () => ({
  grade_label: '',
  min_percentage: '',
  max_percentage: '',
  grade_point: '',
  is_pass: true,
});

const emptyExamForm = () => ({
  name: '',
  exam_type_id: '',
  academic_year_id: '',
  term_id: '',
  class_id: '',
  subject_id: '',
  exam_date: '',
  start_time: '',
  end_time: '',
  max_marks: '100',
  pass_marks: '',
  status: 'scheduled',
  notes: '',
});

const apiError = (err) => {
  const body = err.response?.data;
  const detail = Array.isArray(body?.data?.errors) && body.data.errors[0]?.message;
  return detail || body?.message || err.message || 'Request failed';
};

const classLabel = (row) => (row.section ? `${row.name} (${row.section})` : row.name);
const studentLabel = (row) =>
  `${row.admission_number || ''} — ${[row.first_name, row.last_name].filter(Boolean).join(' ')}`.trim();

const Exams = () => {
  const { user } = useAuth();
  const role = user?.profile?.role;
  const isAdmin = ADMIN_ROLES.includes(role);
  const isStaff = STAFF_ROLES.includes(role);

  const [tab, setTab] = useState('exams');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lookups, setLookups] = useState({
    classes: [],
    subjects: [],
    terms: [],
    academicYears: [],
  });

  // Exams tab
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [examFilters, setExamFilters] = useState({ class_id: '', exam_type_id: '', status: '' });
  const [examTypes, setExamTypes] = useState([]);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [examForm, setExamForm] = useState(emptyExamForm());
  const [savingExam, setSavingExam] = useState(false);
  const [examFormError, setExamFormError] = useState('');

  // Marks tab
  const [marksExams, setMarksExams] = useState([]);
  const [marksExamId, setMarksExamId] = useState('');
  const [marksExam, setMarksExam] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);

  // Exam types tab
  const [typeForm, setTypeForm] = useState({ name: '', code: '', weight: '', status: 'active', description: '' });
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [savingType, setSavingType] = useState(false);

  // Grading tab
  const [scales, setScales] = useState([]);
  const [loadingScales, setLoadingScales] = useState(false);
  const [scaleModalOpen, setScaleModalOpen] = useState(false);
  const [editingScale, setEditingScale] = useState(null);
  const [scaleForm, setScaleForm] = useState({ name: '', is_default: false, status: 'active', description: '', bands: [] });
  const [savingScale, setSavingScale] = useState(false);
  const [scaleFormError, setScaleFormError] = useState('');

  const loadLookups = async () => {
    const refs = [
      ['classes', 'classes'],
      ['subjects', 'subjects'],
      ['terms', 'terms'],
      ['academicYears', 'academic-years'],
    ];
    const results = await Promise.all(
      refs.map(async ([key, resource]) => {
        try {
          const response = await academicAPI.list(resource, { limit: 100 });
          return [key, response.data.data.items || []];
        } catch {
          return [key, []];
        }
      })
    );
    setLookups(Object.fromEntries(results));
  };

  const loadExamTypes = async () => {
    try {
      const response = await examAPI.listTypes({ limit: 100 });
      setExamTypes(response.data.data.items || []);
    } catch {
      setExamTypes([]);
    }
  };

  const loadExams = async () => {
    setLoadingExams(true);
    setError('');
    try {
      const params = { limit: 100 };
      Object.entries(examFilters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const response = await examAPI.list(params);
      const items = response.data.data.items || [];
      setExams(items);
      setMarksExams(items);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoadingExams(false);
    }
  };

  const loadScales = async () => {
    setLoadingScales(true);
    try {
      const response = await examAPI.listGradingScales({ limit: 100 });
      setScales(response.data.data.items || []);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoadingScales(false);
    }
  };

  useEffect(() => {
    loadLookups();
    loadExamTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examFilters]);

  useEffect(() => {
    if (tab === 'grading') loadScales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ---- Exams CRUD ----
  const openCreateExam = () => {
    setEditingExam(null);
    setExamForm(emptyExamForm());
    setExamFormError('');
    setExamModalOpen(true);
  };

  const openEditExam = (exam) => {
    setEditingExam(exam);
    setExamForm({
      name: exam.name || '',
      exam_type_id: exam.exam_type_id || '',
      academic_year_id: exam.academic_year_id || '',
      term_id: exam.term_id || '',
      class_id: exam.class_id || '',
      subject_id: exam.subject_id || '',
      exam_date: exam.exam_date || '',
      start_time: exam.start_time ? String(exam.start_time).slice(0, 5) : '',
      end_time: exam.end_time ? String(exam.end_time).slice(0, 5) : '',
      max_marks: exam.max_marks ?? '100',
      pass_marks: exam.pass_marks ?? '',
      status: exam.status || 'scheduled',
      notes: exam.notes || '',
    });
    setExamFormError('');
    setExamModalOpen(true);
  };

  const setExamField = (key, value) => setExamForm((prev) => ({ ...prev, [key]: value }));

  const submitExam = async (event) => {
    event.preventDefault();
    setSavingExam(true);
    setExamFormError('');
    try {
      const payload = {
        name: examForm.name,
        exam_type_id: examForm.exam_type_id,
        academic_year_id: examForm.academic_year_id,
        term_id: examForm.term_id || null,
        class_id: examForm.class_id,
        subject_id: examForm.subject_id || null,
        exam_date: examForm.exam_date || null,
        start_time: examForm.start_time || null,
        end_time: examForm.end_time || null,
        max_marks: Number(examForm.max_marks),
        pass_marks: examForm.pass_marks === '' ? null : Number(examForm.pass_marks),
        status: examForm.status,
        notes: examForm.notes || null,
      };

      if (editingExam) {
        await examAPI.update(editingExam.id, payload);
        setNotice('Exam updated.');
      } else {
        await examAPI.create(payload);
        setNotice('Exam created.');
      }
      setExamModalOpen(false);
      loadExams();
    } catch (err) {
      setExamFormError(apiError(err));
    } finally {
      setSavingExam(false);
    }
  };

  const deleteExam = async (exam) => {
    if (!window.confirm(`Delete exam "${exam.name}"? This also removes its marks.`)) return;
    try {
      await examAPI.remove(exam.id);
      setNotice('Exam deleted.');
      loadExams();
    } catch (err) {
      setError(apiError(err));
    }
  };

  // ---- Marks entry ----
  const loadRoster = async () => {
    if (!marksExamId) {
      setError('Select an exam to load its roster.');
      return;
    }
    setError('');
    setNotice('');
    setLoadingRoster(true);
    try {
      const examResponse = await examAPI.get(marksExamId);
      const exam = examResponse.data.data;
      setMarksExam(exam);

      const [marksResponse, enrollmentsResponse] = await Promise.all([
        examAPI.listMarks(marksExamId),
        academicAPI.list('enrollments', { class_id: exam.class_id, limit: 100 }),
      ]);

      const existing = marksResponse.data.data.marks || [];
      const existingByStudent = {};
      existing.forEach((mark) => {
        existingByStudent[mark.student_id] = mark;
      });

      const students = new Map();
      (enrollmentsResponse.data.data.items || [])
        .filter((row) => row.status === 'enrolled' && row.student)
        .forEach((row) => students.set(row.student_id, row.student));
      existing.forEach((mark) => {
        if (mark.student) students.set(mark.student_id, mark.student);
      });

      setRoster(
        Array.from(students.entries()).map(([studentId, student]) => ({
          student,
          marks_obtained:
            existingByStudent[studentId]?.marks_obtained ?? '',
          is_absent: Boolean(existingByStudent[studentId]?.is_absent),
          remarks: existingByStudent[studentId]?.remarks || '',
        }))
      );
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoadingRoster(false);
    }
  };

  const setRosterField = (studentId, key, value) =>
    setRoster((prev) =>
      prev.map((row) => (row.student.id === studentId ? { ...row, [key]: value } : row))
    );

  const saveMarks = async () => {
    if (!marksExam || !roster.length) return;
    setSavingMarks(true);
    setError('');
    setNotice('');
    try {
      const records = roster.map((row) => ({
        student_id: row.student.id,
        is_absent: Boolean(row.is_absent),
        marks_obtained: row.is_absent || row.marks_obtained === '' ? null : Number(row.marks_obtained),
        remarks: row.remarks || null,
      }));
      await examAPI.saveMarks(marksExam.id, records);
      setNotice(`Marks saved for ${records.length} student${records.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSavingMarks(false);
    }
  };

  // ---- Exam types CRUD ----
  const submitType = async (event) => {
    event.preventDefault();
    setSavingType(true);
    setError('');
    try {
      const payload = {
        name: typeForm.name,
        code: typeForm.code || null,
        weight: typeForm.weight === '' ? null : Number(typeForm.weight),
        status: typeForm.status,
        description: typeForm.description || null,
      };
      if (editingTypeId) {
        await examAPI.updateType(editingTypeId, payload);
        setNotice('Exam type updated.');
      } else {
        await examAPI.createType(payload);
        setNotice('Exam type created.');
      }
      setTypeForm({ name: '', code: '', weight: '', status: 'active', description: '' });
      setEditingTypeId(null);
      loadExamTypes();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSavingType(false);
    }
  };

  const editType = (type) => {
    setEditingTypeId(type.id);
    setTypeForm({
      name: type.name || '',
      code: type.code || '',
      weight: type.weight ?? '',
      status: type.status || 'active',
      description: type.description || '',
    });
  };

  const deleteType = async (type) => {
    if (!window.confirm(`Delete exam type "${type.name}"?`)) return;
    try {
      await examAPI.removeType(type.id);
      setNotice('Exam type deleted.');
      if (editingTypeId === type.id) {
        setEditingTypeId(null);
        setTypeForm({ name: '', code: '', weight: '', status: 'active', description: '' });
      }
      loadExamTypes();
    } catch (err) {
      setError(apiError(err));
    }
  };

  // ---- Grading scales ----
  const openCreateScale = () => {
    setEditingScale(null);
    setScaleForm({ name: '', is_default: false, status: 'active', description: '', bands: [emptyBand()] });
    setScaleFormError('');
    setScaleModalOpen(true);
  };

  const openEditScale = (scale) => {
    setEditingScale(scale);
    setScaleForm({
      name: scale.name || '',
      is_default: Boolean(scale.is_default),
      status: scale.status || 'active',
      description: scale.description || '',
      bands: (scale.bands || []).map((band) => ({
        grade_label: band.grade_label,
        min_percentage: band.min_percentage,
        max_percentage: band.max_percentage,
        grade_point: band.grade_point ?? '',
        is_pass: Boolean(band.is_pass),
      })),
    });
    setScaleFormError('');
    setScaleModalOpen(true);
  };

  const setBandField = (index, key, value) =>
    setScaleForm((prev) => ({
      ...prev,
      bands: prev.bands.map((band, i) => (i === index ? { ...band, [key]: value } : band)),
    }));

  const addBand = () => setScaleForm((prev) => ({ ...prev, bands: [...prev.bands, emptyBand()] }));
  const removeBand = (index) =>
    setScaleForm((prev) => ({ ...prev, bands: prev.bands.filter((_, i) => i !== index) }));

  const submitScale = async (event) => {
    event.preventDefault();
    setSavingScale(true);
    setScaleFormError('');
    try {
      const payload = {
        name: scaleForm.name,
        is_default: Boolean(scaleForm.is_default),
        status: scaleForm.status,
        description: scaleForm.description || null,
        bands: scaleForm.bands.map((band) => ({
          grade_label: band.grade_label,
          min_percentage: Number(band.min_percentage),
          max_percentage: Number(band.max_percentage),
          grade_point: band.grade_point === '' ? null : Number(band.grade_point),
          is_pass: Boolean(band.is_pass),
        })),
      };
      if (editingScale) {
        await examAPI.updateGradingScale(editingScale.id, payload);
        setNotice('Grading scale updated.');
      } else {
        await examAPI.createGradingScale(payload);
        setNotice('Grading scale created.');
      }
      setScaleModalOpen(false);
      loadScales();
    } catch (err) {
      setScaleFormError(apiError(err));
    } finally {
      setSavingScale(false);
    }
  };

  const deleteScale = async (scale) => {
    if (!window.confirm(`Delete grading scale "${scale.name}"?`)) return;
    try {
      await examAPI.removeGradingScale(scale.id);
      setNotice('Grading scale deleted.');
      loadScales();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const tabs = [
    { key: 'exams', label: 'Exams', icon: ClipboardList, roles: STAFF_ROLES },
    { key: 'marks', label: 'Marks Entry', icon: ListChecks, roles: STAFF_ROLES },
    { key: 'types', label: 'Exam Types', icon: GraduationCap, roles: ADMIN_ROLES },
    { key: 'grading', label: 'Grading', icon: Scale, roles: ADMIN_ROLES },
  ].filter((item) => item.roles.includes(role));

  const visibleExams = useMemo(() => exams, [exams]);

  return (
    <div className="bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Exams</h1>
              <p className="text-sm text-gray-600">Create exams, record marks and configure grading.</p>
            </div>
          </div>
          {tab === 'exams' && isStaff && (
            <button
              onClick={openCreateExam}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Exam
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
        </div>

        {tab === 'exams' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select value={examFilters.class_id} onChange={(e) => setExamFilters((p) => ({ ...p, class_id: e.target.value }))} className={inputClass}>
                  <option value="">All classes</option>
                  {lookups.classes.map((row) => (
                    <option key={row.id} value={row.id}>{classLabel(row)}</option>
                  ))}
                </select>
                <select value={examFilters.exam_type_id} onChange={(e) => setExamFilters((p) => ({ ...p, exam_type_id: e.target.value }))} className={inputClass}>
                  <option value="">All exam types</option>
                  {examTypes.map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
                <select value={examFilters.status} onChange={(e) => setExamFilters((p) => ({ ...p, status: e.target.value }))} className={inputClass}>
                  <option value="">All statuses</option>
                  {EXAM_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <button onClick={loadExams} className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </button>
              </div>
            </div>

            {loadingExams ? (
              <div className="text-center py-12 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                Loading exams...
              </div>
            ) : visibleExams.length === 0 ? (
              <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-200">
                <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No exams found.
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Exam</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Marks</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      {isStaff && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleExams.map((exam) => (
                      <tr key={exam.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{exam.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{exam.exam_type?.name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {exam.class ? classLabel(exam.class) : '—'}
                          {exam.subject?.name ? ` · ${exam.subject.name}` : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{exam.exam_date || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {Number(exam.max_marks)}
                          {exam.pass_marks !== null && exam.pass_marks !== undefined ? ` (pass ${Number(exam.pass_marks)})` : ''}
                        </td>
                        <td className="px-4 py-3"><StatusPill value={exam.status} /></td>
                        {isStaff && (
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button onClick={() => openEditExam(exam)} className="p-1.5 rounded text-gray-500 hover:bg-gray-100" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteExam(exam)} className="p-1.5 rounded text-red-500 hover:bg-red-50" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'marks' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Exam</label>
                <select value={marksExamId} onChange={(e) => setMarksExamId(e.target.value)} className={inputClass}>
                  <option value="">Select exam</option>
                  {marksExams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name} · {exam.class ? classLabel(exam.class) : ''}
                      {exam.exam_date ? ` · ${exam.exam_date}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={loadRoster}
                  disabled={loadingRoster}
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingRoster ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ListChecks className="w-4 h-4 mr-2" />}
                  Load Roster
                </button>
              </div>
            </div>

            {marksExam && (
              <p className="text-sm text-gray-600 mb-3">
                Max marks: <span className="font-semibold">{Number(marksExam.max_marks)}</span>
                {marksExam.pass_marks !== null && marksExam.pass_marks !== undefined
                  ? ` · Pass marks: ${Number(marksExam.pass_marks)}`
                  : ''}
              </p>
            )}

            {roster.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                Select an exam and load its roster to enter marks.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Marks</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Absent</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {roster.map((row) => (
                        <tr key={row.student.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{studentLabel(row.student)}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.marks_obtained}
                              disabled={row.is_absent || !isStaff}
                              onChange={(e) => setRosterField(row.student.id, 'marks_obtained', e.target.value)}
                              className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={row.is_absent}
                              disabled={!isStaff}
                              onChange={(e) => setRosterField(row.student.id, 'is_absent', e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600"
                            />
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
                      onClick={saveMarks}
                      disabled={savingMarks}
                      className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingMarks ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Marks
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'types' && isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form onSubmit={submitType} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 h-fit">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {editingTypeId ? 'Edit Exam Type' : 'New Exam Type'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input required value={typeForm.name} onChange={(e) => setTypeForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                    <input value={typeForm.code} onChange={(e) => setTypeForm((p) => ({ ...p, code: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (%)</label>
                    <input type="number" min="0" max="100" value={typeForm.weight} onChange={(e) => setTypeForm((p) => ({ ...p, weight: e.target.value }))} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={typeForm.status} onChange={(e) => setTypeForm((p) => ({ ...p, status: e.target.value }))} className={inputClass}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea rows={2} value={typeForm.description} onChange={(e) => setTypeForm((p) => ({ ...p, description: e.target.value }))} className={inputClass} />
                </div>
                <div className="flex justify-end gap-3">
                  {editingTypeId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTypeId(null);
                        setTypeForm({ name: '', code: '', weight: '', status: 'active', description: '' });
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" disabled={savingType} className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                    {savingType && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingTypeId ? 'Save' : 'Create'}
                  </button>
                </div>
              </div>
            </form>

            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Weight</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {examTypes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                        <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        No exam types yet.
                      </td>
                    </tr>
                  ) : (
                    examTypes.map((type) => (
                      <tr key={type.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{type.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{type.code || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{type.weight ?? '—'}</td>
                        <td className="px-4 py-3"><StatusPill value={type.status} /></td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button onClick={() => editType(type)} className="p-1.5 rounded text-gray-500 hover:bg-gray-100" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteType(type)} className="p-1.5 rounded text-red-500 hover:bg-red-50" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'grading' && isAdmin && (
          <div className="space-y-5">
            <div className="flex justify-end">
              <button onClick={openCreateScale} className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                New Grading Scale
              </button>
            </div>

            {loadingScales ? (
              <div className="text-center py-12 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                Loading grading scales...
              </div>
            ) : scales.length === 0 ? (
              <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-200">
                <Scale className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No grading scales yet. The built-in A+–F scheme is used until you add one.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {scales.map((scale) => (
                  <div key={scale.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          {scale.name}
                          {scale.is_default && (
                            <span className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">Default</span>
                          )}
                        </h3>
                        <p className="text-xs text-gray-500 capitalize">{scale.status}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditScale(scale)} className="p-1.5 rounded text-gray-500 hover:bg-gray-100" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteScale(scale)} className="p-1.5 rounded text-red-500 hover:bg-red-50" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {scale.bands.length === 0 ? (
                      <p className="text-sm text-gray-500">No bands configured; the built-in scheme is used.</p>
                    ) : (
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 uppercase">
                            <th className="py-1 pr-3">Grade</th>
                            <th className="py-1 pr-3">Range</th>
                            <th className="py-1 pr-3">Points</th>
                            <th className="py-1">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {scale.bands.map((band) => (
                            <tr key={band.id}>
                              <td className="py-1.5 pr-3 font-medium text-gray-900">{band.grade_label}</td>
                              <td className="py-1.5 pr-3 text-gray-600">
                                {Number(band.min_percentage)}–{Number(band.max_percentage)}%
                              </td>
                              <td className="py-1.5 pr-3 text-gray-600">{band.grade_point ?? '—'}</td>
                              <td className={`py-1.5 font-medium ${band.is_pass ? 'text-green-600' : 'text-red-600'}`}>
                                {band.is_pass ? 'Pass' : 'Fail'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {examModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setExamModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingExam ? 'Edit Exam' : 'New Exam'}</h3>
              <button onClick={() => setExamModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={submitExam} className="px-6 py-5">
              {examFormError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{examFormError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exam Name <span className="text-red-500">*</span></label>
                  <input required value={examForm.name} onChange={(e) => setExamField('name', e.target.value)} className={inputClass} placeholder="e.g. Midterm Examination" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type <span className="text-red-500">*</span></label>
                  <select required value={examForm.exam_type_id} onChange={(e) => setExamField('exam_type_id', e.target.value)} className={inputClass}>
                    <option value="">Select exam type</option>
                    {examTypes.map((row) => (
                      <option key={row.id} value={row.id}>{row.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year <span className="text-red-500">*</span></label>
                  <select required value={examForm.academic_year_id} onChange={(e) => setExamField('academic_year_id', e.target.value)} className={inputClass}>
                    <option value="">Select academic year</option>
                    {lookups.academicYears.map((row) => (
                      <option key={row.id} value={row.id}>{row.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class <span className="text-red-500">*</span></label>
                  <select required value={examForm.class_id} onChange={(e) => setExamField('class_id', e.target.value)} className={inputClass}>
                    <option value="">Select class</option>
                    {lookups.classes.map((row) => (
                      <option key={row.id} value={row.id}>{classLabel(row)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <select value={examForm.subject_id} onChange={(e) => setExamField('subject_id', e.target.value)} className={inputClass}>
                    <option value="">Select subject</option>
                    {lookups.subjects.map((row) => (
                      <option key={row.id} value={row.id}>{row.code ? `${row.name} (${row.code})` : row.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                  <select value={examForm.term_id} onChange={(e) => setExamField('term_id', e.target.value)} className={inputClass}>
                    <option value="">Select term</option>
                    {lookups.terms.map((row) => (
                      <option key={row.id} value={row.id}>{row.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={examForm.exam_date} onChange={(e) => setExamField('exam_date', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input type="time" value={examForm.start_time} onChange={(e) => setExamField('start_time', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input type="time" value={examForm.end_time} onChange={(e) => setExamField('end_time', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Marks <span className="text-red-500">*</span></label>
                  <input type="number" min="0.01" step="0.01" required value={examForm.max_marks} onChange={(e) => setExamField('max_marks', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pass Marks</label>
                  <input type="number" min="0" step="0.01" value={examForm.pass_marks} onChange={(e) => setExamField('pass_marks', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={examForm.status} onChange={(e) => setExamField('status', e.target.value)} className={inputClass}>
                    {EXAM_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea rows={2} value={examForm.notes} onChange={(e) => setExamField('notes', e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6">
                <button type="button" onClick={() => setExamModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={savingExam} className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                  {savingExam && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingExam ? 'Save Changes' : 'Create Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scaleModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setScaleModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingScale ? 'Edit Grading Scale' : 'New Grading Scale'}</h3>
              <button onClick={() => setScaleModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={submitScale} className="px-6 py-5">
              {scaleFormError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{scaleFormError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input required value={scaleForm.name} onChange={(e) => setScaleForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={scaleForm.status} onChange={(e) => setScaleForm((p) => ({ ...p, status: e.target.value }))} className={inputClass}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input value={scaleForm.description} onChange={(e) => setScaleForm((p) => ({ ...p, description: e.target.value }))} className={inputClass} />
                </div>
                <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={scaleForm.is_default}
                    onChange={(e) => setScaleForm((p) => ({ ...p, is_default: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  />
                  Use as the institution default grading scale
                </label>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">Grade Bands</h4>
                  <button type="button" onClick={addBand} className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add band
                  </button>
                </div>
                <div className="space-y-2">
                  {scaleForm.bands.map((band, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        placeholder="Grade"
                        value={band.grade_label}
                        onChange={(e) => setBandField(index, 'grade_label', e.target.value)}
                        className="col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <input
                        type="number" min="0" max="100" step="0.01" placeholder="Min"
                        value={band.min_percentage}
                        onChange={(e) => setBandField(index, 'min_percentage', e.target.value)}
                        className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <input
                        type="number" min="0" max="100" step="0.01" placeholder="Max"
                        value={band.max_percentage}
                        onChange={(e) => setBandField(index, 'max_percentage', e.target.value)}
                        className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <input
                        type="number" min="0" step="0.01" placeholder="Points"
                        value={band.grade_point}
                        onChange={(e) => setBandField(index, 'grade_point', e.target.value)}
                        className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <label className="col-span-2 inline-flex items-center gap-1 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={band.is_pass}
                          onChange={(e) => setBandField(index, 'is_pass', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600"
                        />
                        Pass
                      </label>
                      <button
                        type="button"
                        onClick={() => removeBand(index)}
                        className="col-span-1 p-1.5 rounded text-red-500 hover:bg-red-50 justify-self-end"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {scaleForm.bands.length === 0 && (
                    <p className="text-sm text-gray-500">No bands added. The built-in scheme will be used.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button type="button" onClick={() => setScaleModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={savingScale} className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                  {savingScale && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingScale ? 'Save Changes' : 'Create Scale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Exams;
