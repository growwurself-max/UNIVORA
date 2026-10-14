import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/me'),
  setupDemoUser: () => api.post('/auth/demo/setup'),
};

// Institution-scoped academic resources (students, faculty, departments, ...).
// Reads are available to every authenticated member; writes require an admin role.
export const academicAPI = {
  stats: () => api.get('/academic/stats'),
  list: (resource, params) => api.get(`/academic/${resource}`, { params }),
  get: (resource, id) => api.get(`/academic/${resource}/${id}`),
  create: (resource, data) => api.post(`/academic/${resource}`, data),
  update: (resource, id, data) => api.patch(`/academic/${resource}/${id}`, data),
  remove: (resource, id) => api.delete(`/academic/${resource}/${id}`),
};

// Weekly timetable management (class/subject/faculty/room/time-slot).
export const timetableAPI = {
  list: (params) => api.get('/timetable', { params }),
  get: (id) => api.get(`/timetable/${id}`),
  create: (data) => api.post('/timetable', data),
  update: (id, data) => api.patch(`/timetable/${id}`, data),
  remove: (id) => api.delete(`/timetable/${id}`),
};

// Attendance sessions, bulk marking, summaries and low-attendance alerts.
export const attendanceAPI = {
  settings: () => api.get('/attendance/settings'),
  updateSettings: (data) => api.patch('/attendance/settings', data),
  listSessions: (params) => api.get('/attendance/sessions', { params }),
  session: (id) => api.get(`/attendance/sessions/${id}`),
  createSession: (data) => api.post('/attendance/sessions', data),
  removeSession: (id) => api.delete(`/attendance/sessions/${id}`),
  mark: (id, records) => api.post(`/attendance/sessions/${id}/mark`, { records }),
  studentSummary: (studentId, params) => api.get(`/attendance/students/${studentId}/summary`, { params }),
  classSummary: (classId, params) => api.get(`/attendance/classes/${classId}/summary`, { params }),
  alerts: (params) => api.get('/attendance/alerts', { params }),
};

// Exams, exam types, configurable grading scales and student marks entry.
export const examAPI = {
  listTypes: (params) => api.get('/exams/types', { params }),
  createType: (data) => api.post('/exams/types', data),
  updateType: (id, data) => api.patch(`/exams/types/${id}`, data),
  removeType: (id) => api.delete(`/exams/types/${id}`),

  listGradingScales: (params) => api.get('/exams/grading-scales', { params }),
  createGradingScale: (data) => api.post('/exams/grading-scales', data),
  updateGradingScale: (id, data) => api.patch(`/exams/grading-scales/${id}`, data),
  removeGradingScale: (id) => api.delete(`/exams/grading-scales/${id}`),

  list: (params) => api.get('/exams', { params }),
  get: (id) => api.get(`/exams/${id}`),
  create: (data) => api.post('/exams', data),
  update: (id, data) => api.patch(`/exams/${id}`, data),
  remove: (id) => api.delete(`/exams/${id}`),

  listMarks: (id) => api.get(`/exams/${id}/marks`),
  saveMarks: (id, records) => api.post(`/exams/${id}/marks`, { records }),
  results: (id) => api.get(`/exams/${id}/results`),
};

// Class-wise and student-wise results plus printable report cards.
export const resultAPI = {
  list: (params) => api.get('/results', { params }),
  reportCard: (studentId, params) => api.get(`/results/report-card/${studentId}`, { params }),
};

// Super Admin institution management (all endpoints require the super_admin role)
export const adminAPI = {
  listInstitutions: (params) => api.get('/institutions', { params }),
  getStats: () => api.get('/institutions/stats'),
  getInstitution: (id) => api.get(`/institutions/${id}`),
  createInstitution: (data) => api.post('/institutions', data),
  updateInstitution: (id, data) => api.patch(`/institutions/${id}`, data),
  setInstitutionStatus: (id, status, reason) =>
    api.patch(`/institutions/${id}/status`, { status, reason }),
};

export default api;
