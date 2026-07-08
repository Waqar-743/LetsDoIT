/* ==========================================================================
   LetsDOiT — Mock data
   Pakistani curriculum, realistic names. Privacy-enforced accessors below.
   NEVER expose student names from student-side renderers.
   ========================================================================== */

window.LD = window.LD || {};

// ---------- Teachers ----------
LD.teachers = [
  { id: 't1', name: 'Ms. Ayesha Khan',     email: 'ayesha@letsdoit.edu',  subjects: ['Mathematics','Calculus'],          avatar: 'AK', verified: true,  accessKey: 'TEACH-2024-AK' },
  { id: 't2', name: 'Mr. Hassan Raza',     email: 'hassan@letsdoit.edu',  subjects: ['Computer Science','AI'],           avatar: 'HR', verified: true,  accessKey: 'TEACH-2024-HR' },
  { id: 't3', name: 'Ms. Sana Malik',      email: 'sana@letsdoit.edu',    subjects: ['English Literature','Urdu'],        avatar: 'SM', verified: true,  accessKey: 'TEACH-2024-SM' },
  { id: 't4', name: 'Mr. Bilal Ahmed',     email: 'bilal@letsdoit.edu',   subjects: ['Physics','Applied Mathematics'],    avatar: 'BA', verified: true,  accessKey: 'TEACH-2024-BA' },
  { id: 't5', name: 'Dr. Hina Aslam',      email: 'hina@letsdoit.edu',    subjects: ['Pakistan Studies','History'],       avatar: 'HA', verified: true,  accessKey: 'TEACH-2024-HA' },
];

// ---------- Students ----------
LD.students = [
  { id: 's1', name: 'Ali Hassan',     email: 'ali@student.letsdoit.edu',     dept: 'Pre-Engineering',    semester: '12th',     avatar: 'AH', joinedCourses: ['c1','c2','c5'], prepLevel: 'good',         risk: 'low'    },
  { id: 's2', name: 'Fatima Zahra',   email: 'fatima@student.letsdoit.edu',  dept: 'Pre-Medical',         semester: '12th',     avatar: 'FZ', joinedCourses: ['c1','c3'],       prepLevel: 'excellent',    risk: 'low'    },
  { id: 's3', name: 'Bilal Iqbal',    email: 'bilal@student.letsdoit.edu',   dept: 'ICS',                 semester: '11th',     avatar: 'BI', joinedCourses: ['c2'],             prepLevel: 'average',      risk: 'medium' },
  { id: 's4', name: 'Ayesha Tariq',   email: 'ayesha@student.letsdoit.edu',  dept: 'Pre-Engineering',     semester: '11th',     avatar: 'AT', joinedCourses: ['c1','c4'],       prepLevel: 'good',         risk: 'low'    },
  { id: 's5', name: 'Hamza Sheikh',   email: 'hamza@student.letsdoit.edu',   dept: 'ICOM',                semester: '12th',     avatar: 'HS', joinedCourses: ['c5'],             prepLevel: 'needs_practice', risk: 'high' },
  { id: 's6', name: 'Zainab Bibi',    email: 'zainab@student.letsdoit.edu',  dept: 'FA (Humanities)',     semester: '11th',     avatar: 'ZB', joinedCourses: ['c3','c5'],       prepLevel: 'good',         risk: 'low'    },
  { id: 's7', name: 'Usman Khalid',   email: 'usman@student.letsdoit.edu',   dept: 'Pre-Engineering',     semester: '12th',     avatar: 'UK', joinedCourses: ['c2','c4'],       prepLevel: 'average',      risk: 'medium' },
  { id: 's8', name: 'Iqra Yousaf',    email: 'iqra@student.letsdoit.edu',    dept: 'Pre-Medical',         semester: '12th',     avatar: 'IY', joinedCourses: ['c1'],             prepLevel: 'good',         risk: 'low'    },
  { id: 's9', name: 'Saad Nawaz',     email: 'saad@student.letsdoit.edu',    dept: 'ICS',                 semester: '12th',     avatar: 'SN', joinedCourses: ['c2','c3'],       prepLevel: 'excellent',    risk: 'low'    },
  { id: 's10',name: 'Mahnoor Fatima', email: 'mahnoor@student.letsdoit.edu', dept: 'Pre-Engineering',     semester: '11th',     avatar: 'MF', joinedCourses: ['c4'],             prepLevel: 'average',      risk: 'medium' },
  { id: 's11',name: 'Talha Imran',    email: 'talha@student.letsdoit.edu',   dept: 'FA (Humanities)',     semester: '12th',     avatar: 'TI', joinedCourses: ['c5'],             prepLevel: 'good',         risk: 'low'    },
  { id: 's12',name: 'Saba Javed',     email: 'saba@student.letsdoit.edu',    dept: 'Pre-Medical',         semester: '11th',     avatar: 'SJ', joinedCourses: ['c1','c3'],       prepLevel: 'good',         risk: 'low'    },
];

// Currently signed-in student (for student-side demo) — Ali Hassan (s1)
LD.currentStudentId = 's1';
// Currently signed-in teacher — Ms. Ayesha Khan (t1)
LD.currentTeacherId = 't1';

// ---------- Courses ----------
// subjects drive cover gradients: math, science, lang, cs, human, business
LD.courses = [
  { id: 'c1', code: '4827', title: 'Calculus & Analytical Geometry', subject: 'Mathematics',
    subjectClass: 'math', description: 'Functions, limits, derivatives, integration and their applications. Designed for Pre-Engineering 12th class.',
    teacherId: 't1', studentIds: ['s1','s2','s4','s8','s12'], status: 'active', semester: '12th', createdAt: '2024-09-01' },
  { id: 'c2', code: '7193', title: 'Introduction to Programming',    subject: 'Computer Science',
    subjectClass: 'cs', description: 'Python fundamentals, control flow, functions, data structures and introductory algorithms.',
    teacherId: 't2', studentIds: ['s1','s3','s7','s9'], status: 'active', semester: '12th', createdAt: '2024-09-05' },
  { id: 'c3', code: '2360', title: 'English Literature — Modern',    subject: 'English',
    subjectClass: 'lang', description: 'Poetry, prose, drama from 1900 to present. Includes Pakistani English writers.',
    teacherId: 't3', studentIds: ['s2','s6','s9','s12'], status: 'active', semester: '11th', createdAt: '2024-09-10' },
  { id: 'c4', code: '9158', title: 'Physics — Mechanics & Waves',    subject: 'Physics',
    subjectClass: 'science', description: 'Kinematics, dynamics, work-energy, oscillations, wave motion. Board exam preparation.',
    teacherId: 't4', studentIds: ['s4','s7','s10'], status: 'active', semester: '11th', createdAt: '2024-09-12' },
  { id: 'c5', code: '5412', title: 'Pakistan Studies',                subject: 'Humanities',
    subjectClass: 'human', description: 'History of Pakistan from 1857 to present, culture, economy, and contemporary issues.',
    teacherId: 't5', studentIds: ['s1','s5','s6','s11'], status: 'active', semester: '12th', createdAt: '2024-09-15' },
  { id: 'c6', code: '3402', title: 'Business Mathematics',           subject: 'Business',
    subjectClass: 'business', description: 'Matrices, financial math, statistics for ICOM students.',
    teacherId: 't1', studentIds: [], status: 'inactive', semester: '12th', createdAt: '2024-08-20' },
];

// ---------- Materials ----------
LD.materials = [
  // c1 - Calculus
  { id: 'm1',  courseId: 'c1', type: 'pdf',   title: 'Lecture 1 — Functions & Limits',                  size: '2.4 MB', uploadDate: '2024-10-02', week: 1, topic: 'Limits' },
  { id: 'm2',  courseId: 'c1', type: 'ppt',   title: 'Lecture 2 — Introduction to Derivatives',        size: '5.1 MB', uploadDate: '2024-10-09', week: 2, topic: 'Derivatives' },
  { id: 'm3',  courseId: 'c1', type: 'pdf',   title: 'Lecture 3 — Rules of Differentiation',           size: '1.8 MB', uploadDate: '2024-10-16', week: 3, topic: 'Derivatives' },
  { id: 'm4',  courseId: 'c1', type: 'doc',   title: 'Lecture 4 — Chain Rule (Notes)',                  size: '420 KB', uploadDate: '2024-10-23', week: 4, topic: 'Derivatives' },
  { id: 'm5',  courseId: 'c1', type: 'img',   title: 'Handwritten Examples — Chain Rule',              size: '780 KB', uploadDate: '2024-10-23', week: 4, topic: 'Derivatives' },
  { id: 'm6',  courseId: 'c1', type: 'pdf',   title: 'Lecture 5 — Applications of Derivatives',        size: '3.2 MB', uploadDate: '2024-10-30', week: 5, topic: 'Applications' },
  { id: 'm7',  courseId: 'c1', type: 'pdf',   title: 'Practice Set — Chapter 3',                       size: '1.1 MB', uploadDate: '2024-11-04', week: 5, topic: 'Applications' },
  // c2 - Programming
  { id: 'm8',  courseId: 'c2', type: 'ppt',   title: 'Week 1 — Python Setup & Hello World',            size: '3.4 MB', uploadDate: '2024-10-03', week: 1, topic: 'Basics' },
  { id: 'm9',  courseId: 'c2', type: 'doc',   title: 'Variables, Types & Operators',                   size: '210 KB', uploadDate: '2024-10-10', week: 2, topic: 'Basics' },
  { id: 'm10', courseId: 'c2', type: 'pdf',   title: 'Control Flow — if/else/loops',                   size: '1.6 MB', uploadDate: '2024-10-17', week: 3, topic: 'Control Flow' },
  { id: 'm11', courseId: 'c2', type: 'pdf',   title: 'Functions & Modules',                            size: '2.0 MB', uploadDate: '2024-10-24', week: 4, topic: 'Functions' },
  { id: 'm12', courseId: 'c2', type: 'video', title: 'Live coding: writing a calculator',              size: '78 MB',  uploadDate: '2024-10-31', week: 5, topic: 'Functions' },
  // c3 - English
  { id: 'm13', courseId: 'c3', type: 'pdf',   title: 'Module 1 — Modern Poetry',                       size: '1.4 MB', uploadDate: '2024-10-04', week: 1, topic: 'Poetry' },
  { id: 'm14', courseId: 'c3', type: 'doc',   title: 'Bhabani Bhattacharya — Setting Sun notes',       size: '380 KB', uploadDate: '2024-10-11', week: 2, topic: 'Prose' },
  { id: 'm15', courseId: 'c3', type: 'pdf',   title: 'Essay Writing Template',                         size: '450 KB', uploadDate: '2024-10-25', week: 4, topic: 'Writing' },
  // c4 - Physics
  { id: 'm16', courseId: 'c4', type: 'ppt',   title: 'Chapter 2 — Vectors & Equilibrium',              size: '4.2 MB', uploadDate: '2024-10-07', week: 2, topic: 'Vectors' },
  { id: 'm17', courseId: 'c4', type: 'pdf',   title: 'Newton\'s Laws — Problem Set',                   size: '900 KB', uploadDate: '2024-10-21', week: 3, topic: 'Forces' },
  { id: 'm18', courseId: 'c4', type: 'pdf',   title: 'Work, Energy, Power — Summary',                  size: '1.3 MB', uploadDate: '2024-11-04', week: 5, topic: 'Energy' },
  // c5 - Pak Studies
  { id: 'm19', courseId: 'c5', type: 'pdf',   title: 'Chapter 1 — Pakistan Movement',                  size: '2.8 MB', uploadDate: '2024-10-08', week: 2, topic: 'History' },
  { id: 'm20', courseId: 'c5', type: 'ppt',   title: 'Major Events 1940-1947',                         size: '6.0 MB', uploadDate: '2024-10-22', week: 4, topic: 'History' },
];

// ---------- Quizzes ----------
LD.quizzes = [
  { id: 'q1', courseId: 'c1', title: 'Practice — Derivatives Basics',     mode: 'practice', difficulty: 'easy',   published: true,  timeLimit: 15, dueDate: '2024-11-15',
    sourceMaterials: ['m2','m3'],
    questions: [
      { id: 'q1-1', type: 'mcq', stem: 'What is the derivative of f(x) = x²?',
        options: ['x','2x','2','x²'], correct: 1, explanation: 'Power rule: d/dx(xⁿ) = n·xⁿ⁻¹. Here n=2, so derivative is 2x.', mistakeTypes: ['conceptual_gap','careless'] },
      { id: 'q1-2', type: 'mcq', stem: 'd/dx(sin x) = ?',
        options: ['-cos x','cos x','-sin x','tan x'], correct: 1, explanation: 'The derivative of sin x is cos x.', mistakeTypes: ['misread','conceptual_gap'] },
      { id: 'q1-3', type: 'truefalse', stem: 'The derivative of a constant is always zero.', correct: true,
        explanation: 'Constants have no rate of change, so derivative is 0.', mistakeTypes: ['careless'] },
      { id: 'q1-4', type: 'mcq', stem: 'Find d/dx(3x³ + 2x).',
        options: ['9x² + 2','3x² + 2','9x² + 2x','3x³ + 2'], correct: 0, explanation: 'Apply power rule term by term.', mistakeTypes: ['conceptual_gap'] },
      { id: 'q1-5', type: 'short', stem: 'State the chain rule in your own words.', correct: 'derivative of composite is outer derivative times inner derivative',
        explanation: 'd/dx[f(g(x))] = f\'(g(x))·g\'(x).', mistakeTypes: ['partial_understanding'] },
    ],
    scores: [
      { studentId: 's1',  score: 80, mistakes: [{qid:'q1-2',type:'misread'}] },
      { studentId: 's2',  score: 100, mistakes: [] },
      { studentId: 's4',  score: 60, mistakes: [{qid:'q1-1',type:'conceptual_gap'},{qid:'q1-5',type:'partial_understanding'}] },
      { studentId: 's8',  score: 80, mistakes: [{qid:'q1-4',type:'conceptual_gap'}] },
      { studentId: 's12', score: 100, mistakes: [] },
    ] },
  { id: 'q2', courseId: 'c1', title: 'Test — Chapter 3 (Official)',       mode: 'test',     difficulty: 'medium', published: true,  timeLimit: 30, dueDate: '2024-11-25',
    sourceMaterials: ['m6','m7'],
    questions: [
      { id: 'q2-1', type: 'mcq', stem: 'The rate of change of displacement is called:', options:['Speed','Velocity','Acceleration','Force'], correct: 1, explanation:'Velocity is rate of change of displacement.', mistakeTypes:['misread'] },
      { id: 'q2-2', type: 'mcq', stem: 'If f(x) = x³-3x+2, find f\'(2).', options:['8','6','9','12'], correct: 2, explanation:'f\'(x)=3x²-3, so f\'(2)=9.', mistakeTypes:['conceptual_gap','careless'] },
      { id: 'q2-3', type: 'short', stem: 'Find critical points of f(x)=x³-3x.', correct:'x = ±1', explanation: 'f\'(x)=3x²-3=0 → x=±1.', mistakeTypes:['partial_understanding'] },
      { id: 'q2-4', type: 'mcq', stem: 'The second derivative test is used to check:', options:['Continuity','Concavity','Discontinuity','Integrability'], correct: 1, explanation:'It determines concavity and classifies critical points.', mistakeTypes:['conceptual_gap'] },
      { id: 'q2-5', type: 'mcq', stem: 'd/dx(eˣ) = ?', options:['eˣ·x','eˣ','eˣ·ln e','1/eˣ'], correct: 1, explanation:'The exponential function is its own derivative.', mistakeTypes:['careless'] },
      { id: 'q2-6', type: 'truefalse', stem: 'Every differentiable function is continuous.', correct: true, explanation:'Differentiability implies continuity.', mistakeTypes:['conceptual_gap'] },
      { id: 'q2-7', type: 'mcq', stem: 'lim(x→0) (sin x)/x = ?', options:['0','1','∞','undefined'], correct: 1, explanation:'This is a fundamental limit equal to 1.', mistakeTypes:['conceptual_gap'] },
      { id: 'q2-8', type: 'short', stem: 'Differentiate f(x) = ln(x²+1).', correct:'2x/(x²+1)', explanation:'Chain rule: (1/(x²+1))·2x.', mistakeTypes:['partial_understanding'] },
      { id: 'q2-9', type: 'mcq', stem: 'Local maximum occurs where:', options:['f\' > 0','f\' < 0','f\' = 0 and f\'\' < 0','f\'\' > 0'], correct: 2, explanation:'Second derivative negative confirms local max.', mistakeTypes:['conceptual_gap'] },
      { id: 'q2-10', type: 'mcq', stem: '∫ 2x dx = ?', options:['x² + C','2x² + C','x + C','2 + C'], correct: 0, explanation:'Power rule for integration.', mistakeTypes:['careless','conceptual_gap'] },
    ],
    scores: [
      { studentId: 's1',  score: 70, mistakes: [{qid:'q2-2',type:'careless'},{qid:'q2-7',type:'conceptual_gap'},{qid:'q2-9',type:'conceptual_gap'}] },
      { studentId: 's2',  score: 90, mistakes: [{qid:'q2-3',type:'partial_understanding'}] },
      { studentId: 's4',  score: 50, mistakes: [{qid:'q2-2',type:'conceptual_gap'},{qid:'q2-4',type:'conceptual_gap'},{qid:'q2-8',type:'partial_understanding'},{qid:'q2-9',type:'conceptual_gap'},{qid:'q2-10',type:'careless'}] },
      { studentId: 's8',  score: 80, mistakes: [{qid:'q2-7',type:'conceptual_gap'},{qid:'q2-10',type:'careless'}] },
      { studentId: 's12', score: 100, mistakes: [] },
    ] },
  { id: 'q3', courseId: 'c2', title: 'Practice — Python Basics',           mode: 'practice', difficulty: 'easy',   published: true,  timeLimit: 20, dueDate: '2024-11-20',
    sourceMaterials: ['m8','m9'],
    questions: [
      { id: 'q3-1', type: 'mcq', stem: 'Which of these is a valid Python variable name?', options:['2var','my-var','my_var','class'], correct: 2, explanation:'Variables can\'t start with a digit, no hyphens, and class is reserved.', mistakeTypes:['careless'] },
      { id: 'q3-2', type: 'mcq', stem: 'Output of print(2 + 3 * 4)?', options:['20','14','24','9'], correct: 1, explanation:'Multiplication binds tighter than addition: 2+12=14.', mistakeTypes:['careless','misread'] },
      { id: 'q3-3', type: 'truefalse', stem: 'Python lists are mutable.', correct: true, explanation:'Lists can be modified after creation.', mistakeTypes:['conceptual_gap'] },
    ],
    scores: [
      { studentId: 's1',  score: 100, mistakes: [] },
      { studentId: 's3',  score: 67, mistakes: [{qid:'q3-2',type:'careless'}] },
      { studentId: 's7',  score: 33, mistakes: [{qid:'q3-1',type:'careless'},{qid:'q3-3',type:'conceptual_gap'}] },
      { studentId: 's9',  score: 100, mistakes: [] },
    ] },
  { id: 'q4', courseId: 'c1', title: 'Practice — Hard: Limits & Continuity', mode: 'practice', difficulty: 'hard',   published: false, timeLimit: 45, dueDate: '2024-12-05',
    sourceMaterials: ['m1'],
    questions: [], scores: [] },
  { id: 'q5', courseId: 'c4', title: 'Test — Vectors (Official)',          mode: 'test',     difficulty: 'medium', published: true,  timeLimit: 40, dueDate: '2024-11-28',
    sourceMaterials: ['m16'],
    questions: [], scores: [] },
  { id: 'q6', courseId: 'c5', title: 'Practice — Pakistan Movement',       mode: 'practice', difficulty: 'medium', published: true,  timeLimit: 25, dueDate: '2024-11-30',
    sourceMaterials: ['m19','m20'],
    questions: [], scores: [] },
];

// ---------- Activity (sessions per day for last 14 days) ----------
LD.activity = {
  's1':  { minutes: [25,40,15,55,30,10,5,45,60,35,20,50,40,30], sessions: [2,3,1,4,2,1,0,3,4,2,1,3,3,2], aiPrompts: [3,5,2,8,4,1,0,6,9,5,3,7,5,4] },
  's2':  { minutes: [45,55,40,60,50,30,15,55,70,60,40,65,55,45], sessions: [3,4,3,5,4,2,1,4,5,4,3,5,4,3], aiPrompts: [6,8,5,10,7,4,2,9,12,8,5,11,9,7] },
  's3':  { minutes: [10,15,20,25,15,5,0,20,25,30,20,15,25,20], sessions: [1,1,2,2,1,0,0,2,2,2,1,1,2,2], aiPrompts: [1,2,2,3,2,0,0,3,4,3,2,2,3,3] },
};

// Prep levels defined in data for consistency
LD.prepLevels = [
  { id: 'needs_practice', label: 'Needs Practice',     pct: 25, cls: 'prep-needs',     advice: 'Spend 20 minutes a day reviewing weak topics. Start with material marked as high-priority.' },
  { id: 'average',        label: 'Average Preparation', pct: 50, cls: 'prep-average',   advice: 'You\'re on the right track. Focus on consistent practice and review mistakes.' },
  { id: 'good',           label: 'Good Preparation',   pct: 72, cls: 'prep-good',      advice: 'Strong work! Push into harder practice and start timed quizzes.' },
  { id: 'excellent',      label: 'Excellent Preparation', pct: 88, cls: 'prep-excellent', advice: 'You\'re ready for any test. Try challenge problems and help classmates.' },
  { id: 'outstanding',    label: 'Outstanding Preparation', pct: 96, cls: 'prep-outstanding', advice: 'Top-tier performance. Consider peer tutoring or extension material.' },
];
LD.prepLevelById = (id) => LD.prepLevels.find(p => p.id === id) || LD.prepLevels[1];

// Mistake type labels
LD.mistakeTypes = {
  conceptual_gap:      { label: 'Conceptual gap',      cls: 'chip--danger',  desc: 'You\'re missing a foundational idea. Revisit the relevant lecture before retrying.' },
  careless:            { label: 'Careless mistake',    cls: 'chip--warning', desc: 'You know this — slow down and double-check work next time.' },
  misread:             { label: 'Misread question',    cls: 'chip--primary', desc: 'Read the question twice before answering. Underline the keywords.' },
  partial_understanding: { label: 'Partial understanding', cls: 'chip--warning', desc: 'You\'ve got part of it. Review the full concept to fill the gap.' },
};

// ---------- Privacy-enforced accessors ----------
// CRITICAL: Student-side renderers MUST go through these. Never access LD.students directly
// when rendering peer/course data.
LD.api = {
  // ----- Authenticated user -----
  currentStudent() { return LD.students.find(s => s.id === LD.currentStudentId); },
  currentTeacher() { return LD.teachers.find(t => t.id === LD.currentTeacherId); },

  // ----- Courses -----
  courseById(id) { return LD.courses.find(c => c.id === id); },
  myCourses() { return LD.courses.filter(c => c.studentIds.includes(LD.currentStudentId)); },
  myCoursesAsTeacher() { return LD.courses.filter(c => c.teacherId === LD.currentTeacherId); },
  allCourses() { return LD.courses; },

  // Returns only aggregated info — NEVER individual student identities.
  courseEnrollmentSummary(courseId) {
    const c = LD.courseById(courseId); if (!c) return null;
    return { count: c.studentIds.length, status: c.status, code: c.code };
  },

  // ----- Materials -----
  materialsByCourse(courseId) { return LD.materials.filter(m => m.courseId === courseId); },
  materialById(id) { return LD.materials.find(m => m.id === id); },

  // ----- Quizzes -----
  quizzesByCourse(courseId) { return LD.quizzes.filter(q => q.courseId === courseId); },
  quizById(id) { return LD.quizzes.find(q => q.id === id); },

  // Returns aggregate score info for a quiz (used by student-side).
  // No individual student identities leak here.
  quizAggregate(quizId) {
    const q = LD.quizById(quizId); if (!q) return null;
    if (!q.scores || !q.scores.length) return { attempted: 0, avg: 0, max: 0, distribution: [] };
    const scores = q.scores.map(s => s.score);
    const sum = scores.reduce((a, b) => a + b, 0);
    const buckets = [0,0,0,0,0]; // 0-20, 21-40, 41-60, 61-80, 81-100
    scores.forEach(s => { const b = Math.min(4, Math.floor(s / 20.0001)); buckets[b]++; });
    return { attempted: scores.length, avg: Math.round(sum / scores.length), max: Math.max(...scores), distribution: buckets };
  },

  myScoreForQuiz(quizId) {
    const q = LD.quizById(quizId); if (!q) return null;
    return q.scores?.find(s => s.studentId === LD.currentStudentId) || null;
  },

  // ----- Student activity (own only) -----
  myActivity() { return LD.activity[LD.currentStudentId] || { minutes: [], sessions: [], aiPrompts: [] }; },

  // ----- Class-wide weak topics (for student own course) -----
  myClassWeakTopics(courseId) {
    const quizzes = LD.api.quizzesByCourse(courseId).filter(q => q.published && q.scores?.length);
    const freq = {};
    quizzes.forEach(q => {
      q.scores.forEach(s => s.mistakes.forEach(m => {
        const mt = LD.mistakeTypes[m.type];
        if (!mt) return;
        freq[mt.label] = (freq[mt.label] || 0) + 1;
      }));
    });
    return Object.entries(freq).map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count).slice(0, 6);
  },

  // ----- Teacher-only accessors -----
  // These expose individual student identities. NEVER call them from student-side renderers.
  teacherStudents(teacherId) {
    const courseIds = LD.courses.filter(c => c.teacherId === teacherId).map(c => c.id);
    const studentIds = new Set();
    LD.courses.filter(c => c.teacherId === teacherId).forEach(c => c.studentIds.forEach(s => studentIds.add(s)));
    return LD.students.filter(s => studentIds.has(s.id));
  },
  studentsInCourse(courseId) {
    const c = LD.courseById(courseId); if (!c) return [];
    return c.studentIds.map(id => LD.students.find(s => s.id === id)).filter(Boolean);
  },
  studentById(id) { return LD.students.find(s => s.id === id); },

  // ----- AI suggestions (mocked) -----
  aiSuggestions(role) {
    if (role === 'student') {
      return [
        'Explain last lecture in simple words',
        'Generate 5 MCQs from my notes',
        'Find my weak areas',
        'Make a study plan for the week',
        'Summarize chapter 3 in bullets',
        'Translate to Urdu',
      ];
    }
    return [
      'Summarize last lecture',
      'Generate 10 MCQs from notes',
      'Find class-wide weak areas',
      'Create Urdu-English explanation',
      'Draft an answer key',
      'Suggest practice problems',
    ];
  },

  // Mock AI chat history (one per role)
  aiChatHistory(role) {
    if (role === 'student') {
      return [
        { role: 'user', content: 'Can you explain derivatives in simple words?' },
        { role: 'ai', content:
`<h2>Derivatives — explained simply</h2>
<p>Think of a derivative as the <strong>instantaneous speed</strong> of something that's changing.</p>
<h3>Real-life examples</h3>
<ul>
  <li>If <code>distance</code> is how far a car has travelled, the <strong>derivative of distance is speed</strong> (how fast the distance is changing right now).</li>
  <li>If <code>temperature</code> changes through the day, the <strong>derivative of temperature is how fast it's warming up or cooling down</strong>.</li>
</ul>
<h3>Mathematically</h3>
<p>If <code>f(x) = x²</code>, then <code>f'(x) = 2x</code>. At <code>x = 3</code>, the rate of change is <code>6</code>.</p>
<div class="quiz-block">
<strong>Quick check:</strong> What is d/dx(x³)?
<details><summary>Answer</summary>3x²</details>
</div>` },
      ];
    }
    return [
      { role: 'user', content: 'Generate 10 MCQs from the uploaded Calculus notes for the upcoming test.' },
      { role: 'ai', content:
`<p>I generated 10 questions based on <strong>4 uploaded documents</strong> covering derivatives, chain rule, and applications.</p>
<h3>Question 1</h3>
<p><strong>Q:</strong> Find d/dx(5x⁴ − 3x² + 7).</p>
<ul>
  <li>A) 20x³ − 6x</li>
  <li>B) 5x³ − 3x</li>
  <li>C) 20x³ − 6x + 7</li>
  <li>D) 20x⁴ − 6x²</li>
</ul>
<p><em>Correct: A. Apply the power rule term by term; constants differentiate to 0.</em></p>
<p>Want me to continue with questions 2-10, or also generate an answer key + rubric?</p>` },
    ];
  },

  // Build a teacher-side dashboard summary
  teacherDashboardSummary() {
    const myCourses = LD.api.myCoursesAsTeacher();
    const studentIds = new Set();
    myCourses.forEach(c => c.studentIds.forEach(s => studentIds.add(s)));
    const totalStudents = studentIds.size;

    // Active this week: count students with session > 0 on day 13 (last entry)
    const lastDayActivity = Object.values(LD.activity).map(a => a.sessions?.[13] || 0);
    const activeThisWeek = lastDayActivity.filter(s => s > 0).length;

    // Avg class score: average across all published quizzes of teacher
    const myQuizzes = LD.quizzes.filter(q => {
      const course = LD.courseById(q.courseId);
      return course && course.teacherId === LD.currentTeacherId && q.published && q.scores?.length;
    });
    const allScores = myQuizzes.flatMap(q => q.scores.map(s => s.score));
    const avgScore = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;

    return {
      activeCourses: myCourses.filter(c => c.status === 'active').length,
      totalStudents,
      activeThisWeek,
      avgScore,
      courses: myCourses,
      quizzes: myQuizzes,
    };
  },

  // Generate a fake but consistent 14-day heatmap
  generateHeatmap() {
    const grid = [];
    for (let w = 0; w < 7; w++) {
      const row = [];
      for (let d = 0; d < 14; d++) {
        const seed = (w * 14 + d + LD.currentTeacherId.charCodeAt(1)) % 7;
        row.push(seed > 5 ? 5 : seed > 4 ? 4 : seed > 3 ? 3 : seed > 2 ? 2 : seed > 1 ? 1 : 0);
      }
      grid.push(row);
    }
    return grid;
  },

  // Class-wide weak topics for the teacher's classes
  classWideWeakTopics() {
    const teacherCourses = LD.api.myCoursesAsTeacher().map(c => c.id);
    const teacherQuizzes = LD.quizzes.filter(q => teacherCourses.includes(q.courseId) && q.scores?.length);
    const freq = {};
    teacherQuizzes.forEach(q => {
      q.scores.forEach(s => s.mistakes.forEach(m => {
        const mt = LD.mistakeTypes[m.type];
        if (!mt) return;
        freq[mt.label] = (freq[mt.label] || 0) + 1;
      }));
    });
    return Object.entries(freq).map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count).slice(0, 8);
  },
};
