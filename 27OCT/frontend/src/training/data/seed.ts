import { addDays, todayStr } from '../dates';

export const buildSeed = () => {
  const today = todayStr();
  const created = new Date().toISOString();

  const users = [
    { id: 'u-admin', name: 'Admin User', email: 'admin@company.com', role: 'administrator', reports_to: null, status: 'active', created_at: created },
    { id: 'u-manager', name: 'Maya Patel', email: 'maya.patel@company.com', role: 'manager', reports_to: null, status: 'active', created_at: created },
    { id: 'u-emp1', name: 'Sara Rivera', email: 'sara.rivera@company.com', role: 'employee', reports_to: 'u-manager', status: 'active', created_at: created },
    { id: 'u-emp2', name: 'Jordan Kim', email: 'jordan.kim@company.com', role: 'employee', reports_to: 'u-manager', status: 'active', created_at: created },
    { id: 'u-emp3', name: 'Alex Chen', email: 'alex.chen@company.com', role: 'employee', reports_to: null, status: 'active', created_at: created },
  ];

  const fieldSpecialties = [
    { id: 'fs-cloud', name: 'CloudSafety', description: '' },
    { id: 'fs-work', name: 'Workplace Safety', description: 'Core safety training for all employees.' },
  ];

  const curriculums = [
    { id: 'cu-qbc', name: 'QBC', description: '', field_specialty_id: 'fs-cloud', type: 'required' },
    { id: 'cu-google', name: 'Google', description: '', field_specialty_id: 'fs-cloud', type: 'elective' },
    { id: 'cu-azur', name: 'Azur', description: '', field_specialty_id: 'fs-cloud', type: 'required' },
    { id: 'cu-cisco', name: 'CISCO', description: '', field_specialty_id: 'fs-cloud', type: 'required' },
    { id: 'cu-ergo', name: 'Ergonomics at Work', description: 'Learn proper workstation setup.', field_specialty_id: 'fs-work', type: 'elective' },
    { id: 'cu-osha', name: 'OSHA Fundamentals', description: 'Essential workplace safety protocols.', field_specialty_id: 'fs-work', type: 'required' },
  ];

  const classes = [
    { id: 'cl-bbc', title: 'BBC 101', description: '', curriculum_id: 'cu-qbc', content_type: 'pdf', training_type: 'required', content_url: '', content_name: '', live_class_date: '', live_class_link: '', duration_minutes: 0, order: 0, has_quiz: true },
    { id: 'cl-google', title: 'Google 101', description: '', curriculum_id: 'cu-google', content_type: 'pdf', training_type: 'elective', content_url: '', content_name: '', live_class_date: '', live_class_link: '', duration_minutes: 20, order: 0, has_quiz: true },
    { id: 'cl-cisco', title: 'CISCO 101', description: '', curriculum_id: 'cu-cisco', content_type: 'pdf', training_type: 'required', content_url: '', content_name: '', live_class_date: '', live_class_link: '', duration_minutes: 0, order: 0, has_quiz: false },
    { id: 'cl-handbook', title: 'Safety Handbook', description: 'Read the handbook before taking the quiz.', curriculum_id: 'cu-osha', content_type: 'pdf', training_type: 'required', content_url: '', content_name: '', live_class_date: '', live_class_link: '', duration_minutes: 15, order: 1, has_quiz: true },
    { id: 'cl-video', title: 'Safety Video Briefing', description: '', curriculum_id: 'cu-osha', content_type: 'video', training_type: 'required', content_url: '', content_name: '', live_class_date: '', live_class_link: '', duration_minutes: 10, order: 2, has_quiz: false },
    { id: 'cl-live', title: 'Live Q&A Session', description: 'Bring your safety questions.', curriculum_id: 'cu-osha', content_type: 'live', training_type: 'required', content_url: '', content_name: '', live_class_date: `${addDays(today, 5)}T10:00`, live_class_link: 'https://meet.example.com/live-qa', duration_minutes: 45, order: 3, has_quiz: false },
  ];

  const quizzes = [
    { id: 'qz-bbc', class_id: 'cl-bbc', title: 'BBC 101 Quiz', passing_score: 70 },
    { id: 'qz-google', class_id: 'cl-google', title: 'Google 101 Quiz', passing_score: 70 },
    { id: 'qz-handbook', class_id: 'cl-handbook', title: 'Safety Handbook Quiz', passing_score: 70 },
  ];

  const blank = { correct_index: 0, acceptable_answers: [], match_pairs: [], options: [] };
  const quizQuestions = [
    { ...blank, id: 'q-h1', quiz_id: 'qz-handbook', question_type: 'multiple_choice', question: 'PPE stands for?', options: ['Personal Protective Equipment', 'Private Property Entry', 'Planned Preventive Effort', 'Public Policy Enforcement'], correct_index: 0 },
    { ...blank, id: 'q-h2', quiz_id: 'qz-handbook', question_type: 'multiple_choice', question: 'How often should fire extinguishers be inspected?', options: ['Monthly', 'Yearly', 'Never', 'Only after use'], correct_index: 0 },
    { ...blank, id: 'q-h3', quiz_id: 'qz-handbook', question_type: 'multiple_choice', question: 'What is the first step in reporting a workplace hazard?', options: ['Ignore it', 'Notify your supervisor', 'Leave the area', 'Post on social media'], correct_index: 1 },
    { ...blank, id: 'q-g1', quiz_id: 'qz-google', question_type: 'multiple_choice', question: 'Which of these is a Google Cloud compute service?', options: ['Compute Engine', 'Blob Storage', 'Lambda', 'Azure VM'], correct_index: 0 },
    { ...blank, id: 'q-g2', quiz_id: 'qz-google', question_type: 'true_false', question: 'Cloud Storage buckets can hold objects of any file type.', options: ['True', 'False'], correct_index: 0 },
    { ...blank, id: 'q-g3', quiz_id: 'qz-google', question_type: 'fill_blank', question: 'The command line tool for Google Cloud is called ____.', acceptable_answers: ['gcloud', 'gcloud cli'] },
    { ...blank, id: 'q-g4', quiz_id: 'qz-google', question_type: 'matching', question: 'Match each service with what it does.', match_pairs: [{ left: 'BigQuery', right: 'Data warehouse' }, { left: 'Cloud Run', right: 'Serverless containers' }, { left: 'Pub/Sub', right: 'Messaging' }] },
  ];

  const assignments = [
    { id: 'as-1', employee_id: 'u-emp1', manager_id: 'u-manager', curriculum_id: 'cu-osha', assignment_type: 'required', assigned_by_id: 'u-manager', due_date: addDays(today, 10), extensions_used: 0, created_at: created },
    { id: 'as-2', employee_id: 'u-emp1', manager_id: 'u-manager', curriculum_id: 'cu-ergo', assignment_type: 'elective', assigned_by_id: 'u-emp1', due_date: addDays(today, 14), extensions_used: 0, created_at: created },
    { id: 'as-3', employee_id: 'u-emp2', manager_id: 'u-manager', curriculum_id: 'cu-osha', assignment_type: 'required', assigned_by_id: 'u-manager', due_date: addDays(today, -2), extensions_used: 1, created_at: created },
  ];

  const classProgress = [
    { id: 'cp-1', employee_id: 'u-emp1', class_id: 'cl-handbook', curriculum_id: 'cu-osha', status: 'in_progress', progress_percent: 50, completed_date: '', quiz_score: null, quiz_passed: false },
    { id: 'cp-2', employee_id: 'u-emp2', class_id: 'cl-handbook', curriculum_id: 'cu-osha', status: 'completed', progress_percent: 100, completed_date: addDays(today, -4), quiz_score: 100, quiz_passed: true },
  ];

  return {
    users,
    fieldSpecialties,
    curriculums,
    classes,
    quizzes,
    quizQuestions,
    quizAttempts: [],
    assignments,
    classProgress,
  };
};
