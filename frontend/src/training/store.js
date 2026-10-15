import { useSyncExternalStore } from 'react';
import apiClient from '../api/apiClient';

export const MAX_EXTENSIONS = 3;
export const EXTENSION_DAYS = 7;

const emptyState = () => ({
  users: [],
  fieldSpecialties: [],
  curriculums: [],
  classes: [],
  quizzes: [],
  quizQuestions: [],
  quizAttempts: [],
  assignments: [],
  classProgress: [],
});

let state = emptyState();
let currentRole = null;
let currentUserId = null;
const listeners = new Set();

const commit = (patch) => {
  state = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useTrainingState = () => useSyncExternalStore(subscribe, () => state);

// ==================== Shape normalizers ====================
// The UI (selectors.js + every page) was built against the flat mock shape in
// data/seed.js. These normalizers translate real API rows into that exact shape
// so no page component needs to change.

const dateOnly = (value) => (value ? String(value).slice(0, 10) : '');

// Route params (useParams) and persisted ids are always strings; the API returns
// numeric ids, so every id / foreign-key field is normalized to a string here —
// matching the original mock's string-id convention — so `.find(x => x.id === param)`
// comparisons across every page keep working unchanged.
const id = (value) => (value === null || value === undefined ? null : String(value));

const toUser = (row) => ({
  id: id(row.id),
  name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
  email: row.email,
  role: row.training_role || 'employee',
  reports_to: id(row.reports_to_id),
  status: row.status,
});

const toSpecialty = (row) => ({
  id: id(row.id),
  name: row.name,
  description: row.description || '',
  code: row.code || null,
  revision: row.revision ?? 1,
  created_at: row.created_at || null,
});

const toCurriculum = (row, fieldSpecialtyId) => ({
  id: id(row.id),
  name: row.name,
  description: row.description || '',
  field_specialty_id: id(fieldSpecialtyId ?? row.field_specialty_id),
  type: row.type,
  code: row.code || null,
  revision: row.revision ?? 1,
  created_at: row.created_at || null,
});

const toClass = (row) => ({
  id: id(row.id),
  title: row.title,
  description: row.description || '',
  curriculum_id: id(row.curriculum_id),
  content_type: row.content_type || 'pdf',
  training_type: row.training_type || '',
  content_url: row.content_url || '',
  content_name: row.content_name || '',
  live_class_date: row.live_class_date ? String(row.live_class_date).slice(0, 16) : '',
  live_class_link: row.live_class_link || '',
  duration_minutes: row.duration_minutes || 0,
  order: row.display_order ?? 0,
  has_quiz: Boolean(row.has_quiz),
  prerequisite_class_id: id(row.prerequisite_class_id),
  certificate_validity_months: row.certificate_validity_months ?? null,
  retraining_interval_months: row.retraining_interval_months ?? null,
  document_id: row.document_id || null,
  created_at: row.created_at || null,
  linked_document: row.linked_document
    ? { id: row.linked_document.document_id, title: row.linked_document.title, version: row.linked_document.version, updated_at: row.linked_document.updated_at }
    : null,
});

const toQuiz = (row) => ({
  id: id(row.id),
  class_id: id(row.class_id),
  title: row.title,
  passing_score: row.passing_score,
  questions_per_attempt: row.questions_per_attempt ?? null,
  max_attempts: row.max_attempts ?? null,
  attempts_used: row.attempts_used ?? 0,
  total_questions: row.total_questions,
});

const toQuestion = (row) => ({
  id: id(row.id),
  quiz_id: id(row.quiz_id),
  question_type: row.question_type,
  question: row.question,
  options: row.options || [],
  correct_index: row.correct_index,
  acceptable_answers: row.acceptable_answers || [],
  match_pairs: row.match_pairs || [],
  match_options: row.match_options || [],
  time_limit_seconds: row.time_limit_seconds ?? null,
});

const toAssignment = (row) => ({
  id: id(row.id),
  employee_id: id(row.employee_id),
  manager_id: id(row.manager_id),
  curriculum_id: id(row.curriculum_id),
  assignment_type: row.assignment_type,
  assigned_by_id: id(row.assigned_by_id),
  due_date: dateOnly(row.due_date),
  extensions_used: row.extensions_used,
  created_at: row.created_at,
});

const toClassProgress = (row, employeeId, classId) => ({
  id: `${employeeId}-${classId}`,
  employee_id: id(employeeId),
  class_id: id(classId),
  status: row.status,
  progress_percent: row.progress_percent || 0,
  completed_date: dateOnly(row.completed_date),
  quiz_score: row.quiz_score ?? null,
  quiz_passed: Boolean(row.quiz_passed),
  rating: row.rating ?? null,
  certificate: row.validation_id
    ? { validation_id: row.validation_id, issued_date: row.issued_date, expiry_date: row.expiry_date }
    : null,
});

// ==================== Hydration (load real data into the flat shape) ====================

async function hydrateAdministrator() {
  const [{ data: specialties }, { data: users }, { data: assignmentRows }] = await Promise.all([
    apiClient.get('/api/training/specialties'),
    apiClient.get('/api/training/users'),
    apiClient.get('/api/training/assignments'),
  ]);

  const curriculums = [];
  const classes = [];
  const quizzes = [];
  const quizQuestions = [];

  for (const specialty of specialties) {
    const { data: curricula } = await apiClient.get(`/api/training/specialties/${specialty.id}/curricula`);
    curricula.forEach((entry) => curriculums.push(toCurriculum(entry, specialty.id)));
    for (const curriculum of curricula) {
      const { data: classRows } = await apiClient.get(`/api/training/curricula/${curriculum.id}/classes`);
      classRows.forEach((entry) => classes.push(toClass(entry)));
      for (const classRow of classRows) {
        if (!classRow.has_quiz) continue;
        try {
          const { data: quiz } = await apiClient.get(`/api/training/classes/${classRow.id}/quiz`);
          quizzes.push(toQuiz(quiz));
          (quiz.questions || []).forEach((question) => quizQuestions.push(toQuestion(question)));
        } catch (error) {
          // No quiz created yet for this class — leave it out.
        }
      }
    }
  }

  const assignments = [];
  const classProgress = [];
  assignmentRows.forEach((row) => {
    assignments.push(toAssignment(row));
    (row.classes || []).forEach((entry) => {
      if (entry.status) classProgress.push(toClassProgress(entry, row.employee_id, entry.id));
    });
  });

  commit({
    ...emptyState(),
    users: users.map(toUser),
    fieldSpecialties: specialties.map(toSpecialty),
    curriculums,
    classes,
    quizzes,
    quizQuestions,
    assignments,
    classProgress,
  });
}

async function hydrateManager(managerId) {
  const [{ data: team }, { data: progress }, { data: specialties }] = await Promise.all([
    apiClient.get('/api/training/manager/team'),
    apiClient.get('/api/training/manager/progress'),
    apiClient.get('/api/training/specialties'),
  ]);

  const users = team.map((row) => toUser({ ...row, training_role: 'employee', reports_to_id: managerId }));

  const curriculums = [];
  for (const specialty of specialties) {
    const { data: curricula } = await apiClient.get(`/api/training/specialties/${specialty.id}/curricula`);
    curricula.forEach((entry) => curriculums.push(toCurriculum(entry, specialty.id)));
  }

  const assignments = [];
  const classes = [];
  const classProgress = [];
  progress.forEach((member) => {
    (member.assignments || []).forEach((assignment) => {
      assignments.push(toAssignment(assignment));
      (assignment.classes || []).forEach((entry) => {
        classes.push(toClass({ ...entry, curriculum_id: assignment.curriculum_id }));
        if (entry.status) classProgress.push(toClassProgress(entry, assignment.employee_id, entry.id));
      });
    });
  });

  commit({
    ...emptyState(),
    users,
    fieldSpecialties: specialties.map(toSpecialty),
    curriculums,
    classes,
    assignments,
    classProgress,
  });
}

async function hydrateEmployee(employeeId) {
  const [{ data: myTraining }, { data: electives }] = await Promise.all([
    apiClient.get('/api/training/employee/my-training'),
    apiClient.get('/api/training/electives'),
  ]);

  const assignments = [];
  const classes = [];
  const classProgress = [];
  const curriculums = [];

  [...(myTraining.required || []), ...(myTraining.elective || [])].forEach((assignment) => {
    assignments.push(toAssignment(assignment));
    curriculums.push({
      id: id(assignment.curriculum_id),
      name: assignment.curriculum_name,
      description: '',
      field_specialty_id: null,
      type: assignment.assignment_type,
    });
    (assignment.classes || []).forEach((entry) => {
      classes.push(toClass({ ...entry, curriculum_id: assignment.curriculum_id }));
      if (entry.status) classProgress.push(toClassProgress(entry, employeeId, entry.id));
    });
  });

  electives.forEach((curriculum) => {
    if (!curriculums.some((entry) => entry.id === id(curriculum.id))) {
      curriculums.push(toCurriculum(curriculum, curriculum.field_specialty_id));
    }
    (curriculum.classes || []).forEach((entry) => {
      if (!classes.some((existing) => existing.id === id(entry.id))) {
        classes.push(toClass({ ...entry, curriculum_id: curriculum.id }));
      }
    });
  });

  const quizzes = [];
  const quizQuestions = [];
  for (const classRow of classes.filter((entry) => entry.has_quiz)) {
    try {
      const { data: quiz } = await apiClient.get(`/api/training/classes/${classRow.id}/quiz`);
      quizzes.push(toQuiz(quiz));
      (quiz.questions || []).forEach((question) => quizQuestions.push(toQuestion(question)));
    } catch (error) {
      // Not enrolled, or no quiz yet — skip.
    }
  }

  commit((prev) => ({
    ...emptyState(),
    assignments,
    classes,
    classProgress,
    curriculums,
    quizzes,
    quizQuestions,
    quizAttempts: prev.quizAttempts, // keep this session's local attempt-count bumps
  }));
}

async function hydrateCurrentRole() {
  if (!currentRole || !currentUserId) return;
  if (currentRole === 'administrator') return hydrateAdministrator();
  if (currentRole === 'manager') return hydrateManager(currentUserId);
  return hydrateEmployee(currentUserId);
}

// Records a just-submitted attempt locally so the "Attempt N" counter in the UI
// stays accurate without needing a dedicated attempt-history endpoint.
const bumpLocalAttemptCount = (employeeId, quizId, classId) => {
  commit((prev) => ({
    ...prev,
    quizAttempts: [...prev.quizAttempts, { id: `local-${Date.now()}`, employee_id: employeeId, quiz_id: quizId, class_id: classId }],
  }));
};

export const defaultQuestion = (type) => {
  const base = { question_type: type, options: [], correct_index: 0, acceptable_answers: [], match_pairs: [] };
  if (type === 'multiple_choice') return { ...base, question: 'New question?', options: ['Option A', 'Option B', 'Option C', 'Option D'] };
  if (type === 'true_false') return { ...base, question: 'New statement?', options: ['True', 'False'] };
  if (type === 'fill_blank') return { ...base, question: 'The missing word is ____.', options: ['Option A', 'Option B', 'Option C', 'Option D'] };
  return {
    ...base,
    question: 'Match each item with its pair.',
    match_pairs: [
      { left: 'Item 1', right: 'Match 1' },
      { left: 'Item 2', right: 'Match 2' },
    ],
  };
};

// ==================== trainingService ====================
// Every function here calls the real Training API, then re-hydrates the local
// state so the UI (unchanged) re-renders with fresh data via useSyncExternalStore.

export const trainingService = {
  // Called once by TrainingApp.jsx whenever the resolved role/user changes.
  async hydrate(role, userId) {
    currentRole = role;
    currentUserId = id(userId);
    commit(emptyState());
    await hydrateCurrentRole();
  },

  async resetDemo() {
    await hydrateCurrentRole();
  },

  async createSpecialty(values) {
    await apiClient.post('/api/training/specialties', { name: values.name, description: values.description });
    await hydrateCurrentRole();
  },
  async updateSpecialty(id, values) {
    await apiClient.put(`/api/training/specialties/${id}`, { name: values.name, description: values.description });
    await hydrateCurrentRole();
  },
  async deleteSpecialty(id) {
    await apiClient.delete(`/api/training/specialties/${id}`);
    await hydrateCurrentRole();
  },

  async createCurriculum(specialtyId, values) {
    await apiClient.post(`/api/training/specialties/${specialtyId}/curricula`, {
      name: values.name, description: values.description, type: values.type,
    });
    await hydrateCurrentRole();
  },
  async updateCurriculum(id, values) {
    await apiClient.put(`/api/training/curricula/${id}`, {
      name: values.name, description: values.description, type: values.type,
    });
    await hydrateCurrentRole();
  },
  async deleteCurriculum(id) {
    await apiClient.delete(`/api/training/curricula/${id}`);
    await hydrateCurrentRole();
  },

  async createClass(curriculumId, values) {
    const { data } = await apiClient.post(`/api/training/curricula/${curriculumId}/classes`, {
      ...values,
      display_order: values.order,
    });
    await hydrateCurrentRole();
    return id(data.id);
  },
  async uploadClassContent(classId, file) {
    const formData = new FormData();
    formData.append('file', file);
    await apiClient.post(`/api/training/classes/${classId}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    await hydrateCurrentRole();
  },
  async updateClass(id, values) {
    await apiClient.put(`/api/training/classes/${id}`, {
      ...values,
      display_order: values.order,
    });
    await hydrateCurrentRole();
  },
  async deleteClass(id) {
    await apiClient.delete(`/api/training/classes/${id}`);
    await hydrateCurrentRole();
  },

  async setPassingScore(classId, score) {
    await apiClient.put(`/api/training/classes/${classId}/quiz`, { passing_score: score });
    await hydrateCurrentRole();
  },
  async setMaxAttempts(classId, count) {
    await apiClient.put(`/api/training/classes/${classId}/quiz`, { max_attempts: count });
    await hydrateCurrentRole();
  },
  async setQuestionsPerAttempt(classId, count) {
    await apiClient.put(`/api/training/classes/${classId}/quiz`, { questions_per_attempt: count });
    await hydrateCurrentRole();
  },
  async addQuestion(classId, type) {
    await apiClient.post(`/api/training/classes/${classId}/quiz/questions`, defaultQuestion(type));
    await hydrateCurrentRole();
  },
  async updateQuestion(id, patch) {
    await apiClient.put(`/api/training/questions/${id}`, patch);
    await hydrateCurrentRole();
  },
  async deleteQuestion(id) {
    await apiClient.delete(`/api/training/questions/${id}`);
    await hydrateCurrentRole();
  },

  async assignTraining({ employeeIds, curriculumId, dueDate }) {
    const { data } = await apiClient.post('/api/training/manager/assignments', { employeeIds, curriculumId, dueDate });
    await hydrateCurrentRole();
    return data.created;
  },
  async enroll({ curriculumId, dueDate }) {
    await apiClient.post(`/api/training/electives/${curriculumId}/enroll`, { dueDate });
    await hydrateCurrentRole();
  },
  async extendDueDate(assignmentId) {
    await apiClient.put(`/api/training/assignments/${assignmentId}/extend`);
    await hydrateCurrentRole();
  },

  async fetchPublishedDocuments() {
    const { data } = await apiClient.get('/api/training/documents/published');
    return data;
  },
  async fetchNumberingRules() {
    const { data } = await apiClient.get('/api/training/numbering-rules');
    return data;
  },
  async saveNumberingRule(rule) {
    await apiClient.post('/api/training/numbering-rules', rule);
  },
  async updateNumberingRule(id, rule) {
    await apiClient.put(`/api/training/numbering-rules/${id}`, rule);
  },
  async deleteNumberingRule(id) {
    await apiClient.delete(`/api/training/numbering-rules/${id}`);
  },
  async fetchRecords(filters = {}) {
    const params = {};
    if (filters.employeeId) params.employeeId = filters.employeeId;
    if (filters.scope) params.scope = filters.scope;
    // Records and Reports now read the Base44-style store (b44_records), same response shape as before.
    const { data } = await apiClient.get('/api/b44/records', { params });
    return data;
  },
  async fetchReport(filters = {}) {
    const params = {};
    if (filters.managerId) params.managerId = filters.managerId;
    if (filters.employeeId) params.employeeId = filters.employeeId;
    if (filters.status) params.status = filters.status;
    const { data } = await apiClient.get('/api/b44/reports', { params });
    return data;
  },
  async logClassTime(classId, seconds) {
    await apiClient.post(`/api/training/classes/${classId}/time`, { seconds });
  },
  async rateClass(classId, rating) {
    await apiClient.post(`/api/training/classes/${classId}/rating`, { rating });
    await hydrateCurrentRole();
  },
  async openClass(employeeId, classId) {
    await apiClient.get(`/api/training/classes/${classId}`);
    await hydrateCurrentRole();
  },
  async markClassComplete(employeeId, classId) {
    await apiClient.post(`/api/training/classes/${classId}/complete`);
    await hydrateCurrentRole();
  },
  async submitQuiz({ employeeId, classId, answers }) {
    const { data } = await apiClient.post(`/api/training/classes/${classId}/quiz/submit`, { answers });
    bumpLocalAttemptCount(employeeId, null, classId);
    await hydrateCurrentRole();
    return {
      attempt: { score: data.score, passed: data.passed },
      results: (data.results || []).map((entry) => ({ ...entry, id: id(entry.id) })),
      correct: data.correct,
      total: data.total,
      required: data.required,
      passingScore: data.passingScore,
    };
  },

  async setUserRole(userId, role) {
    await apiClient.put(`/api/training/users/${userId}/role`, { role });
    await hydrateCurrentRole();
  },
  async setReportsTo(userId, managerId) {
    await apiClient.put(`/api/training/users/${userId}/manager`, { managerId: managerId || null });
    await hydrateCurrentRole();
  },
  async inviteUser({ email, role }) {
    try {
      const { data } = await apiClient.post('/api/training/users/invite', { email, role });
      await hydrateCurrentRole();
      return { user: data };
    } catch (error) {
      return { error: error.response?.data?.error || 'Could not invite user. Please try again.' };
    }
  },
};
