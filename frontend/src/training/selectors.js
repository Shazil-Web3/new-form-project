import { daysUntil } from './dates';

export const classesOf = (state, curriculumId) =>
  state.classes
    .filter((entry) => entry.curriculum_id === curriculumId)
    .sort((a, b) => (a.order || 0) - (b.order || 0) || a.title.localeCompare(b.title));

export const curriculaOf = (state, specialtyId) => state.curriculums.filter((entry) => entry.field_specialty_id === specialtyId);

export const quizOf = (state, classId) => state.quizzes.find((quiz) => quiz.class_id === classId) || null;

export const questionsOf = (state, quizId) => state.quizQuestions.filter((question) => question.quiz_id === quizId);

export const attemptsOf = (state, employeeId, classId) =>
  state.quizAttempts.filter((attempt) => attempt.employee_id === employeeId && attempt.class_id === classId);

export const progressOfClass = (state, employeeId, classId) =>
  state.classProgress.find((entry) => entry.employee_id === employeeId && entry.class_id === classId) || null;

export const userById = (state, id) => state.users.find((user) => user.id === id) || null;

export const curriculumProgress = (state, employeeId, curriculumId) => {
  const classes = classesOf(state, curriculumId);
  const completed = classes.filter((entry) => progressOfClass(state, employeeId, entry.id)?.status === 'completed').length;
  const started = classes.some((entry) => progressOfClass(state, employeeId, entry.id));
  return {
    total: classes.length,
    completed,
    started,
    percent: classes.length ? Math.round((completed / classes.length) * 100) : 0,
  };
};

export const assignmentStatus = (state, assignment) => {
  const progress = curriculumProgress(state, assignment.employee_id, assignment.curriculum_id);
  if (progress.total > 0 && progress.completed === progress.total) return 'completed';
  if (daysUntil(assignment.due_date) < 0) return 'overdue';
  if (progress.started) return 'in_progress';
  return 'assigned';
};

export const assignmentsOf = (state, employeeId) => state.assignments.filter((entry) => entry.employee_id === employeeId);

export const statusCounts = (state, assignments) => {
  const counts = { assigned: assignments.length, in_progress: 0, overdue: 0, completed: 0 };
  assignments.forEach((assignment) => {
    const status = assignmentStatus(state, assignment);
    if (status !== 'assigned') counts[status] += 1;
  });
  return counts;
};

export const teamOf = (state, managerId) => state.users.filter((user) => user.role === 'employee' && user.reports_to === managerId);
