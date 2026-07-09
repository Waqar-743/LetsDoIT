import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  CircleOff,
  Cpu,
  Download,
  FileText,
  GraduationCap,
  KeyRound,
  LogOut,
  Plug,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Wifi,
} from 'lucide-react';
import {
  AIMode,
  ChatMessage,
  Course,
  CourseMaterial,
  FileType,
  LanguageStyle,
  LocalModelState,
  PracticeQuestion,
  PracticeSet,
  PreparationLevel,
  Quiz,
  QuizAttempt,
  QuizQuestion,
  StudentProfile,
  SystemLog,
  TeacherProfile,
  UserRole,
} from './types';
import {
  AISettings,
  AutoGemmaRouter,
  createLessonMap,
  DEFAULT_AI_SETTINGS,
  diagnoseOfflineMistake,
  DOWNLOADABLE_GEMMA_MODELS,
  generateOfflineQuiz,
  generatePracticeSet,
  hashContent,
  loadAISettings,
  processMaterialWithAI,
  pullOllamaModel,
  saveAISettings,
  testOfflineModel,
  testOllamaConnection,
  testOpenRouterConnection,
} from './services/ai';
import {
  DesktopEnvironment,
  getDesktopEnvironment,
  loadDesktopModelState,
  saveDesktopModelState,
} from './services/desktop';
import { extractTextFromFile } from './services/pdf';
import {
  INITIAL_ATTEMPTS,
  INITIAL_COURSES,
  INITIAL_MATERIALS,
  INITIAL_QUIZZES,
  INITIAL_STUDENT_PROFILE,
  INITIAL_SYSTEM_LOGS,
} from './mockData';

type Screen = 'auth' | 'student' | 'teacher';
type StudentTab = 'overview' | 'courses' | 'materials' | 'assistant' | 'quizzes' | 'practice' | 'profile' | 'model';
type TeacherTab = 'overview' | 'courses' | 'materials' | 'quizzes' | 'analytics' | 'assistant' | 'model';

const router = new AutoGemmaRouter();

const nowStamp = () => new Date().toISOString().replace('T', ' ').slice(0, 16);

const defaultModel: LocalModelState = {
  provider: 'ollama',
  modelName: 'gemma2:2b',
  downloadStatus: 'not_downloaded',
  downloadProgress: 0,
  connected: false,
  endpoint: 'http://localhost:11434',
};

const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`;

function loadStored<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => loadStored(key, fallback));
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

function prepFromPercent(percent: number): PreparationLevel {
  if (percent >= 92) return 'Outstanding Preparation';
  if (percent >= 82) return 'Excellent Preparation';
  if (percent >= 68) return 'Good Preparation';
  if (percent >= 48) return 'Average Preparation';
  return 'Needs Practice';
}

function prepPercent(level: PreparationLevel): number {
  if (level === 'Outstanding Preparation') return 96;
  if (level === 'Excellent Preparation') return 87;
  if (level === 'Good Preparation') return 74;
  if (level === 'Average Preparation') return 58;
  return 30;
}

function prepColor(level: PreparationLevel): string {
  if (level === 'Outstanding Preparation') return 'bg-emerald-500';
  if (level === 'Excellent Preparation') return 'bg-green-500';
  if (level === 'Good Preparation') return 'bg-amber-500';
  if (level === 'Average Preparation') return 'bg-orange-400';
  return 'bg-red-400';
}

function prepLabelColor(level: PreparationLevel): string {
  if (level === 'Outstanding Preparation') return 'text-emerald-700';
  if (level === 'Excellent Preparation') return 'text-green-700';
  if (level === 'Good Preparation') return 'text-amber-700';
  if (level === 'Average Preparation') return 'text-orange-700';
  return 'text-red-700';
}

function fileTypeFromName(fileName: string): FileType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) return 'image';
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'slides';
  if (lower.endsWith('.pdf')) return 'pdf';
  return 'notes';
}

function compactText(text: string, max = 400) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function extractFallbackPoints(text: string): string[] {
  return text
    .split(/[\n.]+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 40 && line.length < 220)
    .slice(0, 6);
}

function scoreShortAnswer(answer: string, correct: string) {
  const answerTokens = new Set(answer.toLowerCase().split(/\W+/).filter(Boolean));
  const correctTokens = correct.toLowerCase().split(/\W+/).filter((word) => word.length > 4);
  if (!answerTokens.size) return false;
  return correctTokens.some((word) => answerTokens.has(word)) || answer.length > 40;
}

function App() {
  const [role, setRole] = useStoredState<UserRole>('letsdoit_role_v2', null);
  const [student, setStudent] = useStoredState<StudentProfile>('letsdoit_student_v2', INITIAL_STUDENT_PROFILE);
  const [teacher, setTeacher] = useStoredState<TeacherProfile>('letsdoit_teacher_v2', {
    id: 't1',
    name: 'Prof. Dr. Tariq Shah',
    email: 'tariq.shah@nutech.edu.pk',
    isApproved: true,
    department: 'Computer Science',
  });
  const [courses, setCourses] = useStoredState<Course[]>('letsdoit_courses_v2', INITIAL_COURSES);
  const [materials, setMaterials] = useStoredState<CourseMaterial[]>('letsdoit_materials_v2', INITIAL_MATERIALS.map((m) => ({
    ...m,
    topic: m.title.split(':')[0],
    lessonMap: createLessonMap(m),
  })));
  const [quizzes, setQuizzes] = useStoredState<Quiz[]>('letsdoit_quizzes_v2', INITIAL_QUIZZES);
  const [attempts, setAttempts] = useStoredState<QuizAttempt[]>('letsdoit_attempts_v2', INITIAL_ATTEMPTS);
  const [practiceSets, setPracticeSets] = useStoredState<PracticeSet[]>('letsdoit_practice_v1', []);
  const [logs, setLogs] = useStoredState<SystemLog[]>('letsdoit_logs_v2', INITIAL_SYSTEM_LOGS);
  const [model, setModel] = useStoredState<LocalModelState>('letsdoit_model_v2', defaultModel);
  const [aiSettings, setAiSettings] = useStoredState<AISettings>('letsdoit_ai_settings_v2', DEFAULT_AI_SETTINGS);
  const [desktopEnv, setDesktopEnv] = useState<DesktopEnvironment | null>(null);
  const [desktopModelReady, setDesktopModelReady] = useState(false);

  const screen: Screen = role === 'STUDENT' ? 'student' : role === 'TEACHER' ? 'teacher' : 'auth';

  useEffect(() => {
    let mounted = true;

    const loadDesktopState = async () => {
      try {
        const environment = await getDesktopEnvironment();
        const storedModel = await loadDesktopModelState();
        const storedSettings = await loadAISettings();
        if (!mounted) return;
        setDesktopEnv(environment);
        if (storedModel) {
          setModel(storedModel);
        }
        if (storedSettings) {
          setAiSettings((prev) => ({ ...DEFAULT_AI_SETTINGS, ...prev, ...storedSettings }));
        }
      } finally {
        if (mounted) {
          setDesktopModelReady(true);
        }
      }
    };

    void loadDesktopState();
    return () => {
      mounted = false;
    };
  }, [setModel, setAiSettings]);

  useEffect(() => {
    if (!desktopModelReady) return;
    void saveDesktopModelState(model).catch(() => undefined);
  }, [desktopModelReady, model]);

  useEffect(() => {
    if (!desktopModelReady) return;
    void saveAISettings(aiSettings).catch(() => undefined);
  }, [desktopModelReady, aiSettings]);

  const addLog = (event: string, details: string, logRole: SystemLog['role']) => {
    setLogs((prev) => [{ id: uid('log'), timestamp: nowStamp(), event, details, role: logRole }, ...prev]);
  };

  const logout = () => setRole(null);

  return (
    <div className="min-h-[100dvh] bg-stone-50 text-zinc-950">
      {screen === 'auth' && (
        <Auth
          student={student}
          teacher={teacher}
          setStudent={setStudent}
          setTeacher={setTeacher}
          onLogin={(nextRole) => {
            setRole(nextRole);
            addLog('Login', `${nextRole === 'TEACHER' ? teacher.name : student.name} opened the app.`, nextRole);
          }}
        />
      )}
      {screen === 'student' && (
        <StudentWorkspace
          profile={student}
          courses={courses}
          materials={materials}
          quizzes={quizzes}
          attempts={attempts}
          practiceSets={practiceSets}
          model={model}
          aiSettings={aiSettings}
          desktopEnv={desktopEnv}
          setStudent={setStudent}
          setCourses={setCourses}
          setAttempts={setAttempts}
          setPracticeSets={setPracticeSets}
          setModel={setModel}
          setAiSettings={setAiSettings}
          addLog={addLog}
          onLogout={logout}
        />
      )}
      {screen === 'teacher' && (
        <TeacherWorkspace
          profile={teacher}
          courses={courses}
          materials={materials}
          quizzes={quizzes}
          attempts={attempts}
          logs={logs}
          model={model}
          aiSettings={aiSettings}
          desktopEnv={desktopEnv}
          setCourses={setCourses}
          setMaterials={setMaterials}
          setQuizzes={setQuizzes}
          setModel={setModel}
          setAiSettings={setAiSettings}
          addLog={addLog}
          onLogout={logout}
        />
      )}
    </div>
  );
}

function Auth({
  student,
  teacher,
  setStudent,
  setTeacher,
  onLogin,
}: {
  student: StudentProfile;
  teacher: TeacherProfile;
  setStudent: React.Dispatch<React.SetStateAction<StudentProfile>>;
  setTeacher: React.Dispatch<React.SetStateAction<TeacherProfile>>;
  onLogin: (role: Exclude<UserRole, null>) => void;
}) {
  const [mode, setMode] = useState<'student' | 'teacher'>('student');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (mode === 'teacher' && secret !== 'TEACH-2026') {
      setError('Teacher access is restricted. Use the prototype admin secret: TEACH-2026.');
      return;
    }
    onLogin(mode === 'teacher' ? 'TEACHER' : 'STUDENT');
  };

  return (
    <main className="min-h-[100dvh] grid lg:grid-cols-[1.1fr_0.9fr]">
      <section className="px-6 py-8 md:px-12 md:py-12 flex flex-col justify-between bg-zinc-950 text-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-400 text-zinc-950 grid place-items-center font-black">L</div>
          <div>
            <p className="text-sm font-black tracking-tight">LetsDoIT Classroom</p>
            <p className="text-xs text-zinc-400">Education assistant for low-connectivity classrooms</p>
          </div>
        </div>
        <div className="max-w-3xl py-16">
          <p className="mb-4 inline-flex items-center gap-2 border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
            <Cpu className="h-4 w-4" /> Offline-first prototype
          </p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">
            Teach, study, quiz, and diagnose weak areas without depending on the internet.
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-6 text-zinc-300">
            Teachers publish courses with four digit codes. Students join, study uploaded material, ask the AI assistant for help, attempt practice quizzes, and receive mistake diagnosis beyond raw marks.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          {['4 digit course codes', 'Practice and official test modes', 'Online & offline model controls'].map((item) => (
            <div key={item} className="border border-zinc-800 p-4 text-zinc-300">{item}</div>
          ))}
        </div>
      </section>
      <section className="px-6 py-10 md:px-12 flex items-center">
        <form onSubmit={submit} className="w-full max-w-md space-y-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Choose role</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Open classroom workspace</h2>
          </div>
          <div className="grid grid-cols-2 border border-zinc-300 bg-white p-1">
            <button type="button" onClick={() => setMode('student')} className={`px-4 py-3 text-sm font-bold ${mode === 'student' ? 'bg-zinc-950 text-white' : ''}`}>
              Student
            </button>
            <button type="button" onClick={() => setMode('teacher')} className={`px-4 py-3 text-sm font-bold ${mode === 'teacher' ? 'bg-zinc-950 text-white' : ''}`}>
              Teacher
            </button>
          </div>
          {mode === 'student' ? (
            <div className="space-y-4">
              <Field label="Full name" value={student.name} onChange={(value) => setStudent((prev) => ({ ...prev, name: value, avatar: value.slice(0, 2).toUpperCase() }))} />
              <Field label="Email" value={student.email} onChange={(value) => setStudent((prev) => ({ ...prev, email: value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Department" value={student.department} onChange={(value) => setStudent((prev) => ({ ...prev, department: value }))} />
                <Field label="Class or semester" value={student.semester} onChange={(value) => setStudent((prev) => ({ ...prev, semester: value }))} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Faculty name" value={teacher.name} onChange={(value) => setTeacher((prev) => ({ ...prev, name: value }))} />
              <Field label="Faculty email" value={teacher.email} onChange={(value) => setTeacher((prev) => ({ ...prev, email: value }))} />
              <Field label="Department" value={teacher.department} onChange={(value) => setTeacher((prev) => ({ ...prev, department: value }))} />
              <Field label="Admin secret" value={secret} onChange={setSecret} placeholder="TEACH-2026" />
            </div>
          )}
          {error && <p className="border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
          <button type="submit" className="w-full bg-emerald-500 px-5 py-3 text-sm font-black text-zinc-950 active:translate-y-px">
            Enter {mode === 'teacher' ? 'teacher' : 'student'} workspace
          </button>
        </form>
      </section>
    </main>
  );
}

function StudentWorkspace(props: {
  profile: StudentProfile;
  courses: Course[];
  materials: CourseMaterial[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  practiceSets: PracticeSet[];
  model: LocalModelState;
  aiSettings: AISettings;
  desktopEnv: DesktopEnvironment | null;
  setStudent: React.Dispatch<React.SetStateAction<StudentProfile>>;
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  setAttempts: React.Dispatch<React.SetStateAction<QuizAttempt[]>>;
  setPracticeSets: React.Dispatch<React.SetStateAction<PracticeSet[]>>;
  setModel: React.Dispatch<React.SetStateAction<LocalModelState>>;
  setAiSettings: React.Dispatch<React.SetStateAction<AISettings>>;
  addLog: (event: string, details: string, role: SystemLog['role']) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<StudentTab>('overview');
  const [joinCode, setJoinCode] = useState('');
  const [joinMessage, setJoinMessage] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<CourseMaterial | null>(null);
  const [aiMode, setAiMode] = useState<AIMode>('HYBRID');
  const [languageStyle, setLanguageStyle] = useState<LanguageStyle>('en');
  const [chatInput, setChatInput] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizAttempt | null>(null);
  const [activePracticeSet, setActivePracticeSet] = useState<PracticeSet | null>(null);
  const [practiceResults, setPracticeResults] = useState<Record<string, string>>({});

  const joinedCourses = useMemo(
    () => props.courses.filter((course) => props.profile.joinedCourseIds.includes(course.id)),
    [props.courses, props.profile.joinedCourseIds],
  );
  const joinedMaterials = props.materials.filter((material) => props.profile.joinedCourseIds.includes(material.courseId));
  const availableQuizzes = props.quizzes.filter((quiz) => props.profile.joinedCourseIds.includes(quiz.courseId) && quiz.isPublished);
  const hasUnlockedOfficialTest = availableQuizzes.some((quiz) => quiz.isTestMode && !props.attempts.some((attempt) => attempt.quizId === quiz.id));

  const joinCourse = (event: React.FormEvent) => {
    event.preventDefault();
    const course = props.courses.find((item) => item.code === joinCode.trim());
    if (!course) {
      setJoinMessage('No course found for this four digit code.');
      return;
    }
    if (props.profile.joinedCourseIds.includes(course.id)) {
      setJoinMessage('You are already enrolled in this course.');
      return;
    }
    props.setStudent((prev) => ({ ...prev, joinedCourseIds: [...prev.joinedCourseIds, course.id] }));
    props.setCourses((prev) => prev.map((item) => item.id === course.id ? { ...item, enrolledCount: item.enrolledCount + 1, enrolledStudentIds: [...item.enrolledStudentIds, props.profile.id] } : item));
    props.addLog('Course joined', `${props.profile.name} joined ${course.title}.`, 'STUDENT');
    setJoinCode('');
    setJoinMessage(`Joined ${course.title}.`);
  };

  const sendChat = async (event?: React.FormEvent, promptOverride?: string) => {
    event?.preventDefault();
    const prompt = promptOverride || chatInput.trim();
    if (!prompt) return;
    const materialContext = selectedMaterial
      ? [
          `Selected material: ${selectedMaterial.title}`,
          selectedMaterial.contentSummary ? `Summary: ${selectedMaterial.contentSummary}` : '',
          selectedMaterial.importantPoints?.length
            ? `Important points:\n${selectedMaterial.importantPoints.map((p) => `- ${p}`).join('\n')}`
            : '',
          selectedMaterial.contentText
            ? `Source excerpt:\n${selectedMaterial.contentText.slice(0, 8000)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      : '';
    const finalPrompt = materialContext ? `${prompt}\n\n${materialContext}` : prompt;

    setChatInput('');
    setThinking(true);
    setChat((prev) => [...prev, { id: uid('msg'), sender: 'user', text: prompt, timestamp: nowStamp() }]);
    try {
      const response = await router.complete(finalPrompt, aiMode, props.model, languageStyle, props.aiSettings);
      setChat((prev) => [
        ...prev,
        {
          id: uid('msg'),
          sender: 'ai',
          text: `${response.text}\n\nProvider: ${response.providerName}${response.fromCache ? ' · cached' : ''}`,
          timestamp: nowStamp(),
          modeUsed: response.modeUsed,
        },
      ]);
    } catch (error) {
      setChat((prev) => [...prev, {
        id: uid('msg'),
        sender: 'ai',
        text: error instanceof Error ? error.message : 'The model could not answer right now.',
        timestamp: nowStamp(),
        modeUsed: aiMode,
      }]);
    } finally {
      setThinking(false);
    }
  };

  const submitQuiz = () => {
    if (!activeQuiz) return;
    let score = 0;
    const mistakes: QuizAttempt['diagnosis']['mistakes'] = [];
    const weakTopics = new Set<string>();

    activeQuiz.questions.forEach((question) => {
      const answer = answers[question.id] || '';
      const correct = question.options
        ? answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()
        : scoreShortAnswer(answer, question.correctAnswer);
      if (correct) {
        score += 1;
        return;
      }
      const diagnosis = diagnoseOfflineMistake({ question, studentAnswer: answer });
      weakTopics.add(question.topicTag);
      mistakes.push({
        questionId: question.id,
        questionText: question.text,
        studentAnswer: answer || '[blank]',
        correctAnswer: question.correctAnswer,
        mistakeType: diagnosis.mistakeType,
        explanation: diagnosis.explanation,
      });
    });

    const percent = Math.round((score / activeQuiz.questions.length) * 100);
    const attempt: QuizAttempt = {
      id: uid('attempt'),
      studentId: props.profile.id,
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      courseId: activeQuiz.courseId,
      courseTitle: props.courses.find((course) => course.id === activeQuiz.courseId)?.title || 'Course',
      score,
      totalQuestions: activeQuiz.questions.length,
      attemptDate: nowStamp(),
      isTestMode: activeQuiz.isTestMode,
      answers,
      diagnosis: {
        mistakes,
        weakTopics: Array.from(weakTopics),
        suggestedPractice: mistakes.length
          ? `Focus next on ${Array.from(weakTopics).join(', ')}. Use mistake-type drills before retaking this quiz.`
          : 'No weak area detected in this attempt. Move to a harder practice set.',
        preparationLevel: prepFromPercent(percent),
      },
    };
    props.setAttempts((prev) => [attempt, ...prev]);
    props.setStudent((prev) => ({ ...prev, preparationLevel: prepFromPercent(percent) }));
    props.addLog('Quiz attempt', `${props.profile.name} scored ${score}/${activeQuiz.questions.length} on ${activeQuiz.title}.`, 'STUDENT');

    // Auto-generate personalized practice set if there were mistakes
    if (mistakes.length > 0) {
      const practiceSet = generatePracticeSet({
        studentId: props.profile.id,
        courseId: activeQuiz.courseId,
        courseTitle: props.courses.find((course) => course.id === activeQuiz.courseId)?.title || 'Course',
        attemptId: attempt.id,
        mistakes,
        weakTopics: Array.from(weakTopics),
      });
      props.setPracticeSets((prev) => [practiceSet, ...prev]);
    }

    setResult(attempt);
    setActiveQuiz(null);
    setAnswers({});
  };

  return (
    <WorkspaceFrame
      title="Student workspace"
      subtitle={`${props.profile.name} · ${props.profile.semester}`}
      nav={['overview', 'courses', 'materials', 'assistant', 'quizzes', 'practice', 'model', 'profile']}
      active={tab}
      setActive={(value) => setTab(value as StudentTab)}
      onLogout={props.onLogout}
    >
      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
          <Panel className="p-6">
            <p className="label">Preparation status</p>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <p className="text-xs text-emerald-700">Your privacy is protected — peers cannot see your activity</p>
            </div>
            <h2 className={`mt-2 text-3xl font-black tracking-tight ${prepLabelColor(props.profile.preparationLevel)}`}>{props.profile.preparationLevel}</h2>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                <span>Needs Practice</span>
                <span>Outstanding</span>
              </div>
              <div className="h-3 bg-stone-100 border border-zinc-200 overflow-hidden">
                <div
                  className={`h-full transition-all ${prepColor(props.profile.preparationLevel)}`}
                  style={{ width: `${prepPercent(props.profile.preparationLevel)}%` }}
                />
              </div>
            </div>
            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              <Metric label="Joined courses" value={joinedCourses.length} />
              <Metric label="Practice attempts" value={props.attempts.length} />
              <Metric label="Total enrolled visible" value={joinedCourses.reduce((sum, item) => sum + item.enrolledCount, 0)} />
            </div>
          </Panel>
          <ModelPanel model={props.model} setModel={props.setModel} aiSettings={props.aiSettings} setAiSettings={props.setAiSettings} desktopEnv={props.desktopEnv} compact />
          <Panel className="lg:col-span-2 p-6">
            <p className="label">Recent diagnosis</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {props.attempts.slice(0, 4).map((attempt) => (
                <div key={attempt.id} className="border border-zinc-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black">{attempt.quizTitle}</h3>
                      <p className="mt-1 text-xs text-zinc-500">{attempt.attemptDate}</p>
                    </div>
                    <span className="font-mono text-sm font-black">{attempt.score}/{attempt.totalQuestions}</span>
                  </div>
                  <p className="mt-3 text-xs text-zinc-600">{attempt.diagnosis.suggestedPractice}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === 'courses' && (
        <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
          <Panel className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-3 w-3 text-emerald-600" />
              <p className="text-xs text-emerald-700 font-bold">Privacy: students are anonymous to each other</p>
            </div>
            <p className="label">Join a course</p>
            <form onSubmit={joinCourse} className="mt-4 space-y-3">
              <Field label="Four digit course code" value={joinCode} onChange={setJoinCode} placeholder="1024" maxLength={4} />
              <button className="btn-primary w-full" type="submit"><Plus className="h-4 w-4" /> Join course</button>
              {joinMessage && <p className="text-xs text-zinc-600">{joinMessage}</p>}
            </form>
          </Panel>
          <Panel className="p-5">
            <p className="label">Your courses</p>
            <div className="mt-4 grid gap-3">
              {joinedCourses.map((course) => (
                <CourseRow key={course.id} course={course} actionLabel="Leave" onAction={() => {
                  props.setStudent((prev) => ({ ...prev, joinedCourseIds: prev.joinedCourseIds.filter((id) => id !== course.id) }));
                  props.setCourses((prev) => prev.map((item) => item.id === course.id ? { ...item, enrolledCount: Math.max(0, item.enrolledCount - 1), enrolledStudentIds: item.enrolledStudentIds.filter((id) => id !== props.profile.id) } : item));
                }} />
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === 'materials' && (
        <div className="grid gap-4 md:grid-cols-2">
          {joinedMaterials.map((material) => (
            <Panel key={material.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="label">{material.type} · {material.topic || 'Lesson'}</p>
                  <h3 className="mt-2 text-lg font-black">{material.title}</h3>
                </div>
                <FileText className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{material.contentSummary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => {
                  const blob = new Blob([material.contentText || material.contentSummary], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = material.fileName;
                  link.click();
                  URL.revokeObjectURL(url);
                }}><Download className="h-4 w-4" /> Download</button>
                <button className="btn-primary" onClick={() => {
                  setSelectedMaterial(material);
                  setTab('assistant');
                  void sendChat(
                    undefined,
                    `Using the uploaded material "${material.title}", provide:\n1) A clear summary\n2) Important points\n3) A short study plan with practice questions.`,
                  );
                }}><Bot className="h-4 w-4" /> Send to AI</button>
              </div>
              {material.importantPoints && material.importantPoints.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-zinc-600">
                  {material.importantPoints.slice(0, 5).map((point) => (
                    <li key={point}>• {point}</li>
                  ))}
                </ul>
              )}
            </Panel>
          ))}
        </div>
      )}

      {tab === 'assistant' && (
        <AssistantPanel
          title="Student AI assistant"
          aiMode={aiMode}
          setAiMode={setAiMode}
          languageStyle={languageStyle}
          setLanguageStyle={setLanguageStyle}
          chat={chat}
          input={chatInput}
          setInput={setChatInput}
          thinking={thinking}
          onSend={sendChat}
          locked={hasUnlockedOfficialTest}
          selectedMaterial={selectedMaterial}
        />
      )}

      {tab === 'quizzes' && (
        <QuizArea
          quizzes={availableQuizzes}
          attempts={props.attempts}
          activeQuiz={activeQuiz}
          answers={answers}
          result={result}
          setAnswers={setAnswers}
          setActiveQuiz={(quiz) => {
            setResult(null);
            setActiveQuiz(quiz);
          }}
          submitQuiz={submitQuiz}
          setResult={setResult}
        />
      )}

      {tab === 'practice' && (
        <PracticeArea
          practiceSets={props.practiceSets}
          activePracticeSet={activePracticeSet}
          practiceResults={practiceResults}
          setActivePracticeSet={setActivePracticeSet}
          setPracticeResults={setPracticeResults}
          onComplete={(set) => {
            props.setPracticeSets((prev) =>
              prev.map((s) => s.id === set.id ? { ...s, completed: true, completedAt: nowStamp() } : s)
            );
          }}
        />
      )}

      {tab === 'model' && (
        <ModelPanel
          model={props.model}
          setModel={props.setModel}
          aiSettings={props.aiSettings}
          setAiSettings={props.setAiSettings}
          desktopEnv={props.desktopEnv}
        />
      )}

      {tab === 'profile' && (
        <Panel className="max-w-2xl p-6">
          <p className="label">Student profile</p>
          <div className="mt-5 grid gap-4">
            <Field label="Name" value={props.profile.name} onChange={(value) => props.setStudent((prev) => ({ ...prev, name: value }))} />
            <Field label="Email" value={props.profile.email} onChange={(value) => props.setStudent((prev) => ({ ...prev, email: value }))} />
            <Field label="Department" value={props.profile.department} onChange={(value) => props.setStudent((prev) => ({ ...prev, department: value }))} />
            <Field label="Class or semester" value={props.profile.semester} onChange={(value) => props.setStudent((prev) => ({ ...prev, semester: value }))} />
          </div>
        </Panel>
      )}
    </WorkspaceFrame>
  );
}

function TeacherWorkspace(props: {
  profile: TeacherProfile;
  courses: Course[];
  materials: CourseMaterial[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  logs: SystemLog[];
  model: LocalModelState;
  aiSettings: AISettings;
  desktopEnv: DesktopEnvironment | null;
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  setMaterials: React.Dispatch<React.SetStateAction<CourseMaterial[]>>;
  setQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>;
  setModel: React.Dispatch<React.SetStateAction<LocalModelState>>;
  setAiSettings: React.Dispatch<React.SetStateAction<AISettings>>;
  addLog: (event: string, details: string, role: SystemLog['role']) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<TeacherTab>('overview');
  const [selectedCourseId, setSelectedCourseId] = useState(props.courses[0]?.id || '');
  const [courseDraft, setCourseDraft] = useState({ title: '', description: '', subject: '', semester: '6th Semester', code: '' });
  const [materialDraft, setMaterialDraft] = useState({ title: '', topic: 'Week 1', summary: '' });
  const [quizDraft, setQuizDraft] = useState({ title: '', materialId: '', difficulty: 'medium' as Quiz['difficulty'], type: 'MCQ' as Quiz['questionType'], mode: 'practice', timeLimit: 15 });
  const [draftQuizzes, setDraftQuizzes] = useState<Quiz[]>([]);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [teacherChat, setTeacherChat] = useState<ChatMessage[]>([]);
  const [teacherPrompt, setTeacherPrompt] = useState('');
  const [aiMode, setAiMode] = useState<AIMode>('HYBRID');
  const [thinking, setThinking] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const teacherCourses = props.courses.filter((course) => course.teacherId === props.profile.id || props.profile.id === 't1');
  const selectedCourse = props.courses.find((course) => course.id === selectedCourseId) || teacherCourses[0];
  const selectedMaterials = selectedCourse ? props.materials.filter((material) => material.courseId === selectedCourse.id) : [];
  const selectedQuizzes = selectedCourse ? props.quizzes.filter((quiz) => quiz.courseId === selectedCourse.id) : [];
  const selectedAttempts = selectedCourse ? props.attempts.filter((attempt) => attempt.courseId === selectedCourse.id) : props.attempts;
  const weakTopics = selectedAttempts.flatMap((attempt) => attempt.diagnosis.weakTopics);
  const riskCount = selectedAttempts.filter((attempt) => (attempt.score / attempt.totalQuestions) < 0.5).length;

  const createCourse = (event: React.FormEvent) => {
    event.preventDefault();
    const code = courseDraft.code || Math.floor(1000 + Math.random() * 9000).toString();
    const course: Course = {
      id: uid('course'),
      code,
      title: courseDraft.title,
      description: courseDraft.description || 'Teacher-created local course.',
      subject: courseDraft.subject || props.profile.department,
      semester: courseDraft.semester,
      status: 'active',
      teacherName: props.profile.name,
      teacherId: props.profile.id,
      enrolledCount: 0,
      enrolledStudentIds: [],
    };
    props.setCourses((prev) => [course, ...prev]);
    setSelectedCourseId(course.id);
    setCourseDraft({ title: '', description: '', subject: '', semester: '6th Semester', code: '' });
    props.addLog('Course created', `${props.profile.name} created ${course.title} with code ${code}.`, 'TEACHER');
  };

  const uploadMaterial = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCourse || uploadingMaterial) return;
    setUploadingMaterial(true);
    setUploadStatus(null);

    try {
      const file = fileInput.current?.files?.[0];
      let contentText = materialDraft.summary || '';
      let fileName = `${(materialDraft.title || 'notes').replace(/\W+/g, '_')}.txt`;
      let fileSize = 'manual note';
      let type: FileType = 'notes';
      let extractWarning: string | undefined;

      if (file) {
        fileName = file.name;
        fileSize = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
        type = fileTypeFromName(file.name);
        setUploadStatus(`Extracting text from ${file.name}...`);
        const extracted = await extractTextFromFile(file);
        if (extracted.text) {
          contentText = [materialDraft.summary, extracted.text].filter(Boolean).join('\n\n');
        }
        extractWarning = extracted.warning;
        if (!extracted.text && !materialDraft.summary) {
          setUploadStatus(
            extracted.warning ||
              'No text could be extracted. Add a summary so the AI can still use this material.',
          );
        }
      }

      if (!contentText.trim() && !materialDraft.summary.trim()) {
        setUploadStatus('Add a file with extractable text, or paste notes in the summary field.');
        return;
      }

      const title = materialDraft.title || fileName;
      let contentSummary =
        materialDraft.summary ||
        `Indexed ${fileName} for AI study help.`;
      let importantPoints: string[] = [];
      let studyHelp = '';
      let aiProcessed = false;
      let statusMessage = extractWarning || '';

      // Run AI analysis when we have content and a usable provider path
      const canRunOnline = Boolean(props.aiSettings.openRouterApiKey?.trim());
      const canRunOffline = props.model.connected;
      if (contentText.trim()) {
        if (canRunOnline || canRunOffline) {
          setUploadStatus('Generating summary and important points with AI...');
          try {
            const analysis = await processMaterialWithAI(
              title,
              contentText,
              aiMode,
              props.model,
              props.aiSettings,
            );
            contentSummary = analysis.summary || contentSummary;
            importantPoints = analysis.importantPoints;
            studyHelp = analysis.studyHelp;
            aiProcessed = true;
            statusMessage = `Stored with AI analysis via ${analysis.providerName}.`;
          } catch (aiError) {
            const msg = aiError instanceof Error ? aiError.message : String(aiError);
            contentSummary =
              materialDraft.summary ||
              compactText(contentText, 400) ||
              contentSummary;
            importantPoints = extractFallbackPoints(contentText);
            statusMessage =
              `Material saved with extracted text, but AI analysis failed:\n${msg}`;
          }
        } else {
          contentSummary = materialDraft.summary || compactText(contentText, 400);
          importantPoints = extractFallbackPoints(contentText);
          statusMessage =
            'Material saved with extracted text. Add an OpenRouter key or connect Ollama for AI summary.';
        }
      }

      const contentHash = await hashContent(`${fileName}:${contentText}:${contentSummary}`);
      const material: CourseMaterial = {
        id: uid('mat'),
        courseId: selectedCourse.id,
        title,
        type,
        fileName,
        uploadDate: new Date().toISOString().slice(0, 10),
        fileSize,
        contentSummary,
        topic: materialDraft.topic,
        contentText,
        importantPoints,
        studyHelp,
        contentHash,
        aiProcessed,
        extractWarning,
      };
      material.lessonMap = createLessonMap(material);
      props.setMaterials((prev) => [material, ...prev]);
      setMaterialDraft({ title: '', topic: 'Week 1', summary: '' });
      if (fileInput.current) fileInput.current.value = '';
      props.addLog(
        'Material uploaded',
        `${material.title} was indexed for ${selectedCourse.title}${aiProcessed ? ' with AI analysis' : ''}.`,
        'TEACHER',
      );
      setUploadStatus(
        statusMessage ||
          (aiProcessed
            ? `Stored "${material.title}" with AI summary and important points.`
            : `Stored "${material.title}".`),
      );
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploadingMaterial(false);
    }
  };

  const generateQuiz = () => {
    if (!selectedCourse) return;
    const material = props.materials.find((item) => item.id === quizDraft.materialId) || selectedMaterials[0];
    if (!material) return;
    const quiz = generateOfflineQuiz({
      courseId: selectedCourse.id,
      title: quizDraft.title || `${quizDraft.mode === 'official' ? 'Official Test' : 'Practice'}: ${material.title}`,
      material,
      difficulty: quizDraft.difficulty,
      questionType: quizDraft.type,
      isTestMode: quizDraft.mode === 'official',
      timeLimit: quizDraft.timeLimit,
    });
    quiz.isPublished = false;
    quiz.isDraft = true;
    props.setQuizzes((prev) => [quiz, ...prev]);
    setDraftQuizzes((prev) => [quiz, ...prev]);
    setEditingQuiz(quiz);
    props.addLog('Quiz drafted', `${quiz.title} was drafted from ${material.title}. Review before publishing.`, 'TEACHER');
  };

  const sendTeacherChat = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teacherPrompt.trim()) return;
    const prompt = teacherPrompt;
    setTeacherPrompt('');
    setThinking(true);
    setTeacherChat((prev) => [...prev, { id: uid('msg'), sender: 'user', text: prompt, timestamp: nowStamp() }]);
    try {
      const materialSnippets = selectedMaterials
        .slice(0, 3)
        .map((m) => `- ${m.title}: ${m.contentSummary}${m.importantPoints?.length ? ` | Points: ${m.importantPoints.slice(0, 3).join('; ')}` : ''}`)
        .join('\n');
      const context =
        `Course analytics: ${selectedCourse?.title}. Attempts: ${selectedAttempts.length}. ` +
        `Weak topics: ${weakTopics.join(', ') || 'none yet'}.\n` +
        (materialSnippets ? `Recent materials:\n${materialSnippets}\n` : '') +
        `Request: ${prompt}`;
      const response = await router.complete(context, aiMode, props.model, 'en', props.aiSettings);
      setTeacherChat((prev) => [...prev, { id: uid('msg'), sender: 'ai', text: response.text, timestamp: nowStamp(), modeUsed: response.modeUsed }]);
    } catch (error) {
      setTeacherChat((prev) => [...prev, { id: uid('msg'), sender: 'ai', text: error instanceof Error ? error.message : 'AI request failed.', timestamp: nowStamp(), modeUsed: aiMode }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <WorkspaceFrame
      title="Teacher workspace"
      subtitle={`${props.profile.name} · ${props.profile.department}`}
      nav={['overview', 'courses', 'materials', 'quizzes', 'analytics', 'assistant', 'model']}
      active={tab}
      setActive={(value) => setTab(value as TeacherTab)}
      onLogout={props.onLogout}
    >
      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr_0.8fr]">
          <MetricPanel icon={<BookOpen />} label="Courses created" value={teacherCourses.length} />
          <MetricPanel icon={<Upload />} label="Uploaded materials" value={props.materials.length} />
          <MetricPanel icon={<Users />} label="Students at risk" value={riskCount} />
          <Panel className="lg:col-span-3 p-6">
            <p className="label">Course analytics snapshot</p>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Metric label="Quiz attempts" value={props.attempts.length} />
              <Metric label="Published quizzes" value={props.quizzes.length} />
              <Metric label="Class weak topics" value={new Set(weakTopics).size} />
              <Metric label="Model connected" value={props.model.connected ? 'Yes' : 'No'} />
            </div>
          </Panel>
        </div>
      )}

      {tab === 'courses' && (
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <Panel className="p-5">
            <p className="label">Create course</p>
            <form onSubmit={createCourse} className="mt-4 grid gap-3">
              <Field label="Course title" value={courseDraft.title} onChange={(value) => setCourseDraft((prev) => ({ ...prev, title: value }))} />
              <Field label="Subject" value={courseDraft.subject} onChange={(value) => setCourseDraft((prev) => ({ ...prev, subject: value }))} />
              <Field label="Semester" value={courseDraft.semester} onChange={(value) => setCourseDraft((prev) => ({ ...prev, semester: value }))} />
              <Field label="Four digit code" value={courseDraft.code} onChange={(value) => setCourseDraft((prev) => ({ ...prev, code: value }))} placeholder="Auto if blank" maxLength={4} />
              <TextArea label="Description" value={courseDraft.description} onChange={(value) => setCourseDraft((prev) => ({ ...prev, description: value }))} />
              <button className="btn-primary" type="submit"><Plus className="h-4 w-4" /> Create course</button>
            </form>
          </Panel>
          <Panel className="p-5">
            <p className="label">Course registry</p>
            <div className="mt-4 grid gap-3">
              {teacherCourses.map((course) => (
                <CourseRow key={course.id} course={course} active={course.id === selectedCourseId} onClick={() => setSelectedCourseId(course.id)} actionLabel="Delete" onAction={() => props.setCourses((prev) => prev.filter((item) => item.id !== course.id))} />
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === 'materials' && (
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <Panel className="p-5">
            <p className="label">Upload and index material</p>
            <form onSubmit={uploadMaterial} className="mt-4 grid gap-3">
              <CourseSelect courses={teacherCourses} value={selectedCourse?.id || ''} onChange={setSelectedCourseId} />
              <Field label="Material title" value={materialDraft.title} onChange={(value) => setMaterialDraft((prev) => ({ ...prev, title: value }))} />
              <Field label="Topic, week, or lecture" value={materialDraft.topic} onChange={(value) => setMaterialDraft((prev) => ({ ...prev, topic: value }))} />
              <TextArea label="Summary or extracted notes (optional if PDF has text)" value={materialDraft.summary} onChange={(value) => setMaterialDraft((prev) => ({ ...prev, summary: value }))} />
              <input ref={fileInput} type="file" accept=".pdf,.txt,.md,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.webp" className="input" />
              <p className="text-[11px] text-zinc-500">
                PDFs are text-extracted in-app. AI then generates a summary and important points using Online or Offline mode.
              </p>
              <button className="btn-primary" type="submit" disabled={uploadingMaterial}>
                <Upload className="h-4 w-4" />
                {uploadingMaterial ? 'Processing...' : 'Upload & analyze'}
              </button>
              {uploadStatus && (
                <pre className="whitespace-pre-wrap border border-zinc-200 bg-stone-50 px-3 py-2 text-[11px] text-zinc-700">
                  {uploadStatus}
                </pre>
              )}
            </form>
          </Panel>
          <Panel className="p-5">
            <p className="label">Indexed lessons</p>
            <div className="mt-4 grid gap-3">
              {selectedMaterials.map((material) => (
                <div key={material.id} className="border border-zinc-200 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-black">{material.title}</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {material.topic} · {material.fileName} · {material.fileSize}
                        {material.aiProcessed ? ' · AI analyzed' : ''}
                      </p>
                    </div>
                    <button onClick={() => props.setMaterials((prev) => prev.filter((item) => item.id !== material.id))} className="icon-btn"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <p className="mt-3 text-sm text-zinc-600">{material.contentSummary}</p>
                  {material.importantPoints && material.importantPoints.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Important points</p>
                      <ul className="mt-1 space-y-1 text-xs text-zinc-700">
                        {material.importantPoints.slice(0, 6).map((point) => (
                          <li key={point}>• {point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {material.extractWarning && (
                    <p className="mt-2 text-[11px] text-amber-700">{material.extractWarning}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {material.lessonMap?.slice(0, 3).map((item) => <span key={item.concept} className="tag">{item.concept}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === 'quizzes' && (
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <Panel className="p-5">
            <p className="label">Gemma quiz generator</p>
            <div className="mt-4 grid gap-3">
              <CourseSelect courses={teacherCourses} value={selectedCourse?.id || ''} onChange={setSelectedCourseId} />
              <Select label="Source material" value={quizDraft.materialId} onChange={(value) => setQuizDraft((prev) => ({ ...prev, materialId: value }))} options={selectedMaterials.map((item) => ({ label: item.title, value: item.id }))} />
              <Field label="Quiz title" value={quizDraft.title} onChange={(value) => setQuizDraft((prev) => ({ ...prev, title: value }))} />
              <Select label="Difficulty" value={quizDraft.difficulty} onChange={(value) => setQuizDraft((prev) => ({ ...prev, difficulty: value as Quiz['difficulty'] }))} options={['easy', 'medium', 'hard'].map((value) => ({ label: value, value }))} />
              <Select label="Question type" value={quizDraft.type} onChange={(value) => setQuizDraft((prev) => ({ ...prev, type: value as Quiz['questionType'] }))} options={['MCQ', 'Short', 'True/False', 'Mixed'].map((value) => ({ label: value, value }))} />
              <Select label="Mode" value={quizDraft.mode} onChange={(value) => setQuizDraft((prev) => ({ ...prev, mode: value }))} options={[{ label: 'Practice quiz', value: 'practice' }, { label: 'Official test', value: 'official' }]} />
              <button className="btn-primary" onClick={generateQuiz} type="button"><Bot className="h-4 w-4" /> Generate draft quiz</button>
            </div>
          </Panel>
          <Panel className="p-5">
            <p className="label">Quiz drafts</p>
            <div className="mt-4 grid gap-3">
              {props.quizzes.filter((q) => q.isDraft && q.courseId === selectedCourse?.id).map((quiz) => (
                <div key={quiz.id} className="border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-black">{quiz.title}</h3>
                      <p className="mt-1 text-xs text-zinc-500">Draft · {quiz.questions.length} questions</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-ghost" onClick={() => setEditingQuiz(quiz)}>Edit</button>
                      <button className="icon-btn" onClick={() => {
                        props.setQuizzes((prev) => prev.filter((item) => item.id !== quiz.id));
                        if (editingQuiz?.id === quiz.id) setEditingQuiz(null);
                      }}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
              {!props.quizzes.some((q) => q.isDraft && q.courseId === selectedCourse?.id) && (
                <Empty text="No drafts. Generate a quiz to review before publishing." />
              )}
            </div>
            <p className="label mt-5">Published quizzes</p>
            <div className="mt-4 grid gap-3">
              {props.quizzes.filter((q) => !q.isDraft && q.courseId === selectedCourse?.id).map((quiz) => (
                <div key={quiz.id} className="border border-zinc-200 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-black">{quiz.title}</h3>
                      <p className="mt-1 text-xs text-zinc-500">{quiz.isTestMode ? 'Official test: AI locked' : 'Practice quiz: AI allowed'} · {quiz.questions.length} questions</p>
                    </div>
                    <button className="icon-btn" onClick={() => props.setQuizzes((prev) => prev.filter((item) => item.id !== quiz.id))}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === 'quizzes' && editingQuiz && (
        <QuizEditor
          quiz={editingQuiz}
          onSave={(updated) => {
            props.setQuizzes((prev) => prev.map((q) => q.id === updated.id ? updated : q));
            setEditingQuiz(null);
          }}
          onPublish={(quiz) => {
            const published = { ...quiz, isPublished: true, isDraft: false };
            props.setQuizzes((prev) => prev.map((q) => q.id === quiz.id ? published : q));
            setEditingQuiz(null);
            props.addLog('Quiz published', `${quiz.title} was reviewed and published.`, 'TEACHER');
          }}
          onCancel={() => setEditingQuiz(null)}
        />
      )}

      {tab === 'analytics' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Panel className="p-5">
            <p className="label">Weak topic distribution</p>
            <div className="mt-4 space-y-3">
              {Array.from(new Set(weakTopics)).map((topic) => {
                const count = weakTopics.filter((item) => item === topic).length;
                return <Bar key={topic} label={topic} value={count} max={Math.max(1, weakTopics.length)} />;
              })}
              {!weakTopics.length && <Empty text="No weak topics yet. Attempts will populate this chart." />}
            </div>
          </Panel>
          <Panel className="p-5">
            <p className="label">Activity log</p>
            <div className="mt-4 max-h-[420px] overflow-auto space-y-2">
              {props.logs.map((log) => (
                <div key={log.id} className="border border-zinc-200 bg-white p-3 text-xs">
                  <strong>{log.event}</strong>
                  <p className="mt-1 text-zinc-600">{log.details}</p>
                  <p className="mt-2 font-mono text-[10px] text-zinc-400">{log.timestamp} · {log.role}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === 'assistant' && (
        <AssistantPanel
          title="Instructor AI assistant"
          aiMode={aiMode}
          setAiMode={setAiMode}
          chat={teacherChat}
          input={teacherPrompt}
          setInput={setTeacherPrompt}
          thinking={thinking}
          onSend={sendTeacherChat}
        />
      )}

      {tab === 'model' && <ModelPanel model={props.model} setModel={props.setModel} aiSettings={props.aiSettings} setAiSettings={props.setAiSettings} desktopEnv={props.desktopEnv} />}
    </WorkspaceFrame>
  );
}

function WorkspaceFrame({
  title,
  subtitle,
  nav,
  active,
  setActive,
  onLogout,
  children,
}: {
  title: string;
  subtitle: string;
  nav: string[];
  active: string;
  setActive: (value: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-stone-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-zinc-950 text-white grid place-items-center font-black">L</div>
            <div>
              <h1 className="text-sm font-black tracking-tight">{title}</h1>
              <p className="text-xs text-zinc-500">{subtitle}</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2">
            {nav.map((item) => (
              <button key={item} onClick={() => setActive(item)} className={`nav-btn ${active === item ? 'nav-btn-active' : ''}`}>
                {item}
              </button>
            ))}
            <button onClick={onLogout} className="icon-btn" title="Log out"><LogOut className="h-4 w-4" /></button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}

function ModelPanel({
  model,
  setModel,
  aiSettings,
  setAiSettings,
  desktopEnv,
  compact = false,
}: {
  model: LocalModelState;
  setModel: React.Dispatch<React.SetStateAction<LocalModelState>>;
  aiSettings: AISettings;
  setAiSettings: React.Dispatch<React.SetStateAction<AISettings>>;
  desktopEnv?: DesktopEnvironment | null;
  compact?: boolean;
}) {
  const [testingOffline, setTestingOffline] = useState(false);
  const [testingOnline, setTestingOnline] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState<string | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<string | null>(null);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadDetail, setDownloadDetail] = useState<string | null>(null);
  const pullAbort = useRef<AbortController | null>(null);

  const refreshInstalled = async () => {
    const result = await testOllamaConnection(model.endpoint || 'http://localhost:11434');
    setOllamaOnline(result.ok);
    if (result.ok) {
      setInstalledModels(result.allModels || result.models || []);
    } else {
      setInstalledModels([]);
    }
    return result;
  };

  useEffect(() => {
    void refreshInstalled();
    return () => {
      pullAbort.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.endpoint]);

  const isInstalled = (name: string) =>
    installedModels.some((m) => m === name || m.startsWith(`${name}:`) || m.startsWith(`${name}-`) || m.startsWith(name));

  const handleTestOnline = async () => {
    setTestingOnline(true);
    setOnlineStatus('Testing OpenRouter online model...');
    await saveAISettings(aiSettings);
    const result = await testOpenRouterConnection(
      aiSettings.openRouterApiKey,
      aiSettings.openRouterBaseUrl,
      aiSettings.openRouterModelId,
      aiSettings.openRouterBackupModelId,
    );
    setOnlineStatus(result.message);
    setTestingOnline(false);
  };

  const handleTestOffline = async () => {
    setTestingOffline(true);
    setOfflineStatus('Testing offline model...');
    const result = await testOfflineModel(model.endpoint || 'http://localhost:11434', model.modelName);
    setOfflineStatus(result.message);
    if (result.ok) {
      setModel((prev) => ({
        ...prev,
        connected: true,
        downloadStatus: 'downloaded',
        downloadProgress: 100,
        lastChecked: nowStamp(),
      }));
      await refreshInstalled();
    } else {
      setModel((prev) => ({ ...prev, connected: false }));
    }
    setTestingOffline(false);
  };

  const handleSelectInstalled = (name: string) => {
    setModel((prev) => ({
      ...prev,
      modelName: name,
      downloadStatus: 'downloaded',
      downloadProgress: 100,
      connected: true,
      lastChecked: nowStamp(),
    }));
    setOfflineStatus(`Selected offline model: ${name}`);
  };

  const handleDownload = async (name: string) => {
    if (downloadingId) return;
    pullAbort.current?.abort();
    const controller = new AbortController();
    pullAbort.current = controller;
    setDownloadingId(name);
    setDownloadDetail(`Starting download of ${name}...`);
    setModel((prev) => ({
      ...prev,
      modelName: name,
      downloadStatus: 'downloading',
      downloadProgress: 0,
      connected: false,
    }));

    const result = await pullOllamaModel(
      model.endpoint || 'http://localhost:11434',
      name,
      (progress) => {
        setDownloadDetail(`${progress.status}${progress.detail ? ` · ${progress.detail}` : ''}`);
        setModel((prev) => ({
          ...prev,
          downloadStatus: 'downloading',
          downloadProgress: progress.percent,
          modelName: name,
        }));
      },
      controller.signal,
    );

    if (result.ok) {
      setModel((prev) => ({
        ...prev,
        modelName: name,
        downloadStatus: 'downloaded',
        downloadProgress: 100,
        connected: true,
        lastChecked: nowStamp(),
      }));
      setDownloadDetail(result.message);
      setOfflineStatus(result.message + '\nAuto-connected. Run Test Offline Model to verify generation.');
      await refreshInstalled();
    } else {
      setModel((prev) => ({
        ...prev,
        downloadStatus: 'not_downloaded',
        downloadProgress: 0,
        connected: false,
      }));
      setDownloadDetail(result.message);
      setOfflineStatus(result.message);
    }
    setDownloadingId(null);
  };

  const statusColor = (text: string | null) => {
    if (!text) return 'text-zinc-600';
    if (/works|success|ready|downloaded|Selected|Auto-connected/i.test(text) && !/failed|error|cannot|empty/i.test(text.split('\n')[0] || '')) {
      return 'text-emerald-700';
    }
    if (/failed|error|cannot|empty|timed out|not installed|not connected/i.test(text)) {
      return 'text-red-600';
    }
    return 'text-zinc-700';
  };

  return (
    <Panel className={compact ? 'p-5' : 'p-6'}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label">AI model setup</p>
          <h2 className="mt-2 text-xl font-black">
            {model.connected ? `Offline: ${model.modelName}` : 'Configure Online / Offline AI'}
          </h2>
          {desktopEnv && (
            <p className="mt-1 break-all font-mono text-[11px] text-zinc-500">
              Storage: {desktopEnv.app_data_dir}
            </p>
          )}
        </div>
        {model.connected ? (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <Plug className="h-4 w-4" /> Connected
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-bold text-zinc-400">
            <CircleOff className="h-4 w-4" /> Not connected
          </span>
        )}
      </div>

      {compact ? (
        <div className="mt-4 space-y-2 text-xs text-zinc-600">
          <p>Online key: {aiSettings.openRouterApiKey ? 'saved' : 'missing'}</p>
          <p>Offline model: {model.modelName} · {model.connected ? 'connected' : 'disconnected'}</p>
          <p className="text-[11px] text-zinc-500">Open the Model tab for full setup, download, and connection tests.</p>
        </div>
      ) : (
        <>
          {/* Online */}
          <div className="mt-5 border-t border-zinc-200 pt-4">
            <p className="label mb-2">1. Online Mode — OpenRouter Gemma</p>
            <div className="grid gap-2">
              <Field
                label="OpenRouter API Key"
                value={aiSettings.openRouterApiKey}
                onChange={(val) => setAiSettings((prev) => ({ ...prev, openRouterApiKey: val }))}
                placeholder="sk-or-v1-..."
              />
              <div className="grid gap-2 md:grid-cols-2">
                <Field
                  label="Default model"
                  value={aiSettings.openRouterModelId}
                  onChange={(val) => setAiSettings((prev) => ({ ...prev, openRouterModelId: val }))}
                  placeholder="google/gemma-4-26b-a4b-it:free"
                />
                <Field
                  label="Backup model"
                  value={aiSettings.openRouterBackupModelId || DEFAULT_AI_SETTINGS.openRouterBackupModelId}
                  onChange={(val) => setAiSettings((prev) => ({ ...prev, openRouterBackupModelId: val }))}
                  placeholder="google/gemma-4-31b-it:free"
                />
              </div>
              <Field
                label="Base URL"
                value={aiSettings.openRouterBaseUrl}
                onChange={(val) => setAiSettings((prev) => ({ ...prev, openRouterBaseUrl: val }))}
                placeholder="https://openrouter.ai/api/v1"
              />
              <p className="text-[11px] text-zinc-500">
                Endpoint used: <span className="font-mono">{(aiSettings.openRouterBaseUrl || DEFAULT_AI_SETTINGS.openRouterBaseUrl).replace(/\/$/, '')}/chat/completions</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="btn-primary text-xs"
                  onClick={handleTestOnline}
                  disabled={testingOnline || !aiSettings.openRouterApiKey?.trim()}
                >
                  <RefreshCw className={`h-3 w-3 ${testingOnline ? 'animate-spin' : ''}`} />
                  {testingOnline ? 'Testing...' : 'Test Online Model'}
                </button>
              </div>
              {onlineStatus && (
                <pre className={`whitespace-pre-wrap border border-zinc-200 bg-stone-50 px-3 py-2 text-[11px] ${statusColor(onlineStatus)}`}>
                  {onlineStatus}
                </pre>
              )}
            </div>
          </div>

          {/* Offline */}
          <div className="mt-5 border-t border-zinc-200 pt-4">
            <p className="label mb-2">2. Offline Mode — Local Gemma (Ollama)</p>
            <div className="grid gap-3">
              <Field
                label="Ollama endpoint"
                value={model.endpoint}
                onChange={(val) => {
                  setModel((prev) => ({ ...prev, endpoint: val }));
                  setAiSettings((prev) => ({ ...prev, localEndpoint: val }));
                }}
                placeholder="http://localhost:11434"
              />

              {ollamaOnline === false && (
                <div className="border border-amber-300 bg-amber-50 px-3 py-3 text-[11px] leading-5 text-amber-950">
                  <p className="font-bold">Ollama is not installed or not running</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4">
                    <li>Download and install Ollama from https://ollama.com</li>
                    <li>Start the Ollama app (it should appear in the system tray)</li>
                    <li>Return here and download a Gemma model below</li>
                    <li>Click Test Offline Model</li>
                  </ol>
                  <p className="mt-2 font-mono">Expected endpoint: http://localhost:11434</p>
                </div>
              )}

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Download Gemma models</p>
                <div className="grid gap-2">
                  {DOWNLOADABLE_GEMMA_MODELS.map((item) => {
                    const installed = isInstalled(item.name);
                    const selected = model.modelName === item.name || model.modelName.startsWith(item.name);
                    const downloading = downloadingId === item.name;
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-wrap items-center justify-between gap-3 border p-3 ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-200 bg-white'}`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-black">{item.label}</p>
                            <span className="font-mono text-[10px] text-zinc-500">{item.name}</span>
                            {installed && <span className="tag text-[10px]">Installed</span>}
                            {selected && model.connected && <span className="tag text-[10px]">Selected</span>}
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-600">{item.description} · {item.sizeHint}</p>
                          {downloading && (
                            <div className="mt-2">
                              <div className="h-1.5 overflow-hidden bg-zinc-200">
                                <div
                                  className="h-full bg-emerald-500 transition-all"
                                  style={{ width: `${model.downloadProgress || 0}%` }}
                                />
                              </div>
                              <p className="mt-1 text-[10px] text-zinc-500">
                                {model.downloadProgress || 0}% · {downloadDetail || 'Downloading...'}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {installed ? (
                            <button className="btn-ghost text-xs" onClick={() => handleSelectInstalled(item.name)}>
                              {selected && model.connected ? 'Selected' : 'Use'}
                            </button>
                          ) : (
                            <button
                              className="btn-primary text-xs"
                              disabled={Boolean(downloadingId) || ollamaOnline === false}
                              onClick={() => void handleDownload(item.name)}
                            >
                              <Download className="h-3 w-3" />
                              {downloading ? 'Downloading...' : 'Download'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {installedModels.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Installed models</p>
                  <div className="flex flex-wrap gap-1">
                    {installedModels.map((name) => (
                      <button
                        key={name}
                        className={`tag cursor-pointer text-[10px] ${model.modelName === name ? 'bg-emerald-100' : 'hover:bg-zinc-200'}`}
                        onClick={() => handleSelectInstalled(name)}
                      >
                        {name}{model.modelName === name ? ' · selected' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-primary text-xs" onClick={handleTestOffline} disabled={testingOffline || Boolean(downloadingId)}>
                  <RefreshCw className={`h-3 w-3 ${testingOffline ? 'animate-spin' : ''}`} />
                  {testingOffline ? 'Testing...' : 'Test Offline Model'}
                </button>
                <button
                  className="btn-ghost text-xs"
                  onClick={async () => {
                    const result = await refreshInstalled();
                    setOfflineStatus(result.message);
                  }}
                  disabled={testingOffline}
                >
                  Refresh list
                </button>
                {model.connected && (
                  <button
                    className="btn-ghost text-xs text-red-600"
                    onClick={() => setModel((prev) => ({ ...prev, connected: false }))}
                  >
                    <CircleOff className="h-3 w-3" /> Disconnect
                  </button>
                )}
              </div>

              {(offlineStatus || (downloadDetail && !downloadingId)) && (
                <pre className={`whitespace-pre-wrap border border-zinc-200 bg-stone-50 px-3 py-2 text-[11px] ${statusColor(offlineStatus || downloadDetail)}`}>
                  {offlineStatus || downloadDetail}
                </pre>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-zinc-200 pt-3">
            <p className="text-xs text-zinc-500">
              <strong>HYBRID mode</strong> tries Online first, then falls back to the local Ollama model.
              After download, the model is saved as the selected offline model and used with no extra setup.
            </p>
          </div>
        </>
      )}
    </Panel>
  );
}

function AssistantPanel(props: {
  title: string;
  aiMode: AIMode;
  setAiMode: (mode: AIMode) => void;
  languageStyle?: LanguageStyle;
  setLanguageStyle?: (style: LanguageStyle) => void;
  chat: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  thinking: boolean;
  onSend: (event: React.FormEvent) => void;
  locked?: boolean;
  selectedMaterial?: CourseMaterial | null;
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-zinc-200 p-4 md:flex md:items-center md:justify-between">
        <div>
          <p className="label">{props.title}</p>
          <p className="mt-1 text-xs text-zinc-500">{props.selectedMaterial ? `Grounded in ${props.selectedMaterial.title}` : 'Source-grounded classroom help'}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 md:mt-0">
          {(['OFFLINE', 'ONLINE', 'HYBRID'] as AIMode[]).map((mode) => (
            <button key={mode} className={`nav-btn ${props.aiMode === mode ? 'nav-btn-active' : ''}`} onClick={() => props.setAiMode(mode)}>
              {mode === 'OFFLINE' && <Cpu className="h-3 w-3" />}
              {mode === 'ONLINE' && <Wifi className="h-3 w-3" />}
              {mode === 'HYBRID' && <RefreshCw className="h-3 w-3" />}
              {mode}
            </button>
          ))}
          {props.setLanguageStyle && (
            <button
              className={`nav-btn ${props.languageStyle === 'urdu-en' ? 'nav-btn-active' : ''}`}
              onClick={() => props.setLanguageStyle?.(props.languageStyle === 'urdu-en' ? 'en' : 'urdu-en')}
            >
              {props.languageStyle === 'urdu-en' ? 'Urdu+EN' : 'EN'}
            </button>
          )}
        </div>
      </div>
      {props.locked && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          An unattempted official test is open. Student AI help is blocked for solving tests; practice explanations remain available after submission.
        </div>
      )}
      <div className="h-[460px] overflow-auto bg-white p-4">
        {props.chat.length === 0 && <Empty text="Ask for an explanation, summary, study plan, or practice questions grounded in your course material." />}
        <div className="space-y-3">
          {props.chat.map((message) => (
            <div key={message.id} className={`max-w-[86%] border p-4 text-sm leading-6 ${message.sender === 'user' ? 'ml-auto border-zinc-900 bg-zinc-950 text-white' : 'border-zinc-200 bg-stone-50 text-zinc-800'}`}>
              <p className="whitespace-pre-wrap">{message.text}</p>
              <p className="mt-3 font-mono text-[10px] opacity-60">{message.timestamp}{message.modeUsed ? ` · ${message.modeUsed}` : ''}</p>
            </div>
          ))}
          {props.thinking && <div className="w-fit border border-zinc-200 bg-stone-50 px-4 py-3 text-xs text-zinc-500">Preparing a grounded response...</div>}
        </div>
      </div>
      <form onSubmit={props.onSend} className="flex border-t border-zinc-200">
        <input value={props.input} onChange={(event) => props.setInput(event.target.value)} className="input flex-1 border-0" placeholder="Ask for an explanation, summary, quiz, or weak-area practice..." disabled={props.locked} />
        <button className="bg-zinc-950 px-5 text-white disabled:bg-zinc-300" disabled={props.locked || !props.input.trim()}><Send className="h-4 w-4" /></button>
      </form>
    </Panel>
  );
}

function QuizArea(props: {
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  activeQuiz: Quiz | null;
  answers: Record<string, string>;
  result: QuizAttempt | null;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setActiveQuiz: (quiz: Quiz | null) => void;
  submitQuiz: () => void;
  setResult: (attempt: QuizAttempt | null) => void;
}) {
  if (props.activeQuiz) {
    return (
      <Panel className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label">{props.activeQuiz.isTestMode ? 'Official test' : 'Practice quiz'}</p>
            <h2 className="mt-2 text-2xl font-black">{props.activeQuiz.title}</h2>
          </div>
          <button className="btn-primary" onClick={props.submitQuiz}><CheckCircle2 className="h-4 w-4" /> Submit</button>
        </div>
        <div className="mt-6 space-y-5">
          {props.activeQuiz.questions.map((question, index) => (
            <div key={question.id} className="border border-zinc-200 bg-white p-4">
              <p className="text-xs font-bold text-zinc-500">Question {index + 1} · {question.topicTag}</p>
              <h3 className="mt-2 font-black">{question.text}</h3>
              {question.options ? (
                <div className="mt-3 grid gap-2">
                  {question.options.map((option) => (
                    <label key={option} className="flex items-center gap-2 border border-zinc-200 p-3 text-sm">
                      <input type="radio" name={question.id} value={option} checked={props.answers[question.id] === option} onChange={() => props.setAnswers((prev) => ({ ...prev, [question.id]: option }))} />
                      {option}
                    </label>
                  ))}
                </div>
              ) : (
                <TextArea label="Your answer" value={props.answers[question.id] || ''} onChange={(value) => props.setAnswers((prev) => ({ ...prev, [question.id]: value }))} />
              )}
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  if (props.result) {
    return (
      <Panel className="p-6">
        <p className="label">Misconception diagnosis</p>
        <h2 className="mt-2 text-3xl font-black">{props.result.score}/{props.result.totalQuestions} · {props.result.diagnosis.preparationLevel}</h2>
        <p className="mt-3 text-sm text-zinc-600">{props.result.diagnosis.suggestedPractice}</p>
        <div className="mt-5 grid gap-3">
          {props.result.diagnosis.mistakes.map((mistake) => (
            <div key={mistake.questionId} className="border border-zinc-200 bg-white p-4">
              <span className="tag">{mistake.mistakeType}</span>
              <h3 className="mt-3 font-black">{mistake.questionText}</h3>
              <p className="mt-2 text-sm text-zinc-600">Your answer: {mistake.studentAnswer}</p>
              <p className="text-sm text-zinc-600">Correct answer: {mistake.correctAnswer}</p>
              <p className="mt-3 text-sm leading-6">{mistake.explanation}</p>
            </div>
          ))}
          {!props.result.diagnosis.mistakes.length && <Empty text="Perfect attempt. No misconception detected." />}
        </div>
        <button className="btn-primary mt-5" onClick={() => props.setResult(null)}>Back to quizzes</button>
      </Panel>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {props.quizzes.map((quiz) => {
        const attempt = props.attempts.find((item) => item.quizId === quiz.id);
        return (
          <Panel key={quiz.id} className="p-5">
            <p className="label">{quiz.isTestMode ? 'Official test' : 'Practice quiz'} · {quiz.difficulty}</p>
            <h3 className="mt-2 text-lg font-black">{quiz.title}</h3>
            <p className="mt-2 text-sm text-zinc-600">{quiz.questions.length} questions · {quiz.timeLimit} minutes</p>
            <div className="mt-4 flex items-center gap-2">
              {attempt ? (
                <>
                  <span className="font-mono text-sm font-black">Score {attempt.score}/{attempt.totalQuestions}</span>
                  <button className="btn-ghost" onClick={() => props.setResult(attempt)}>View diagnosis</button>
                </>
              ) : (
                <button className="btn-primary" onClick={() => props.setActiveQuiz(quiz)}>Start</button>
              )}
            </div>
          </Panel>
        );
      })}
      {!props.quizzes.length && <Empty text="No quizzes available yet. Join a course or ask your teacher to publish one." />}
    </div>
  );
}

function PracticeArea(props: {
  practiceSets: PracticeSet[];
  activePracticeSet: PracticeSet | null;
  practiceResults: Record<string, string>;
  setActivePracticeSet: (set: PracticeSet | null) => void;
  setPracticeResults: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onComplete: (set: PracticeSet) => void;
}) {
  if (props.activePracticeSet) {
    const ps = props.activePracticeSet;
    const answeredCount = Object.keys(props.practiceResults).filter((id) =>
      ps.questions.some((q) => q.id === id)
    ).length;
    const allAnswered = ps.questions.every((q) => q.id in props.practiceResults);

    return (
      <Panel className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label">Personalized practice</p>
            <h2 className="mt-2 text-2xl font-black">{ps.description}</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Focus: {ps.focusTopics.join(', ')} · Based on: {ps.courseTitle}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-black">{answeredCount}/{ps.questions.length}</p>
            <p className="text-xs text-zinc-500">answered</p>
          </div>
        </div>

        {ps.targetMistakeTypes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {ps.targetMistakeTypes.map((mt) => (
              <span key={mt} className="tag">{mt}</span>
            ))}
          </div>
        )}

        <div className="mt-6 space-y-5">
          {ps.questions.map((question, index) => {
            const answered = question.id in props.practiceResults;
            return (
              <div key={question.id} className={`border p-4 ${answered ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-200 bg-white'}`}>
                <p className="label">Practice question {index + 1} · {question.topicTag}</p>
                <h3 className="mt-2 font-black">{question.text}</h3>
                <p className="mt-2 text-xs text-zinc-600 italic">{question.hint}</p>
                {question.options ? (
                  <div className="mt-3 grid gap-2">
                    {question.options.map((option) => (
                      <label key={option} className="flex items-center gap-2 border border-zinc-200 bg-white p-3 text-sm">
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={props.practiceResults[question.id] === option}
                          onChange={() => {
                            props.setPracticeResults((prev) => ({ ...prev, [question.id]: option }));
                          }}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                ) : (
                  <TextArea
                    label="Your answer"
                    value={props.practiceResults[question.id] || ''}
                    onChange={(value) => props.setPracticeResults((prev) => ({ ...prev, [question.id]: value }))}
                  />
                )}
                {answered && (
                  <div className="mt-4 border-t border-emerald-200 pt-4">
                    <p className="text-xs font-bold text-emerald-700">Explanation</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-700">{question.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex gap-3">
          <button className="btn-primary" disabled={!allAnswered} onClick={() => props.onComplete(ps)}>
            Complete practice set
          </button>
          <button className="btn-ghost" onClick={() => { props.setActivePracticeSet(null); props.setPracticeResults({}); }}>
            Back to practice list
          </button>
        </div>
      </Panel>
    );
  }

  return (
    <div>
      <Panel className="mb-5 p-5">
        <p className="label">Personalized practice mode</p>
        <p className="mt-2 text-sm text-zinc-600">
          After each quiz, targeted practice questions are generated based on your mistake type — conceptual gap, careless mistake, misread, or partial understanding. Use AI help freely here.
        </p>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        {props.practiceSets.map((set) => (
          <Panel key={set.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label">{set.courseTitle}</p>
                <h3 className="mt-2 font-black">{set.description}</h3>
                <p className="mt-2 text-xs text-zinc-500">Generated {set.generatedAt} · {set.questions.length} questions</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {set.targetMistakeTypes.map((mt) => <span key={mt} className="tag">{mt}</span>)}
                </div>
              </div>
              {set.completed ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              ) : (
                <button className="btn-primary shrink-0" onClick={() => props.setActivePracticeSet(set)}>
                  Start practice
                </button>
              )}
            </div>
            {set.completed && (
              <p className="mt-3 text-xs text-emerald-700 font-bold">Completed {set.completedAt}</p>
            )}
          </Panel>
        ))}
        {!props.practiceSets.length && (
          <div className="md:col-span-2">
            <Empty text="No practice sets yet. Complete a quiz with mistakes to generate personalized practice." />
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <section className={`border border-zinc-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function QuizEditor(props: {
  quiz: Quiz;
  onSave: (quiz: Quiz) => void;
  onPublish: (quiz: Quiz) => void;
  onCancel: () => void;
}) {
  const [quiz, setQuiz] = useState<Quiz>(props.quiz);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const updateQuestion = (id: string, updates: Partial<QuizQuestion>) => {
    setQuiz((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => q.id === id ? { ...q, ...updates } : q),
    }));
  };

  const deleteQuestion = (id: string) => {
    setQuiz((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== id) }));
  };

  return (
    <Panel className="p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="label">Quiz editor — review before publishing</p>
          <div className="mt-3 grid grid-cols-3 gap-3 max-w-lg">
            <Field label="Quiz title" value={quiz.title} onChange={(v) => setQuiz((p) => ({ ...p, title: v }))} />
            <Select label="Difficulty" value={quiz.difficulty} onChange={(v) => setQuiz((p) => ({ ...p, difficulty: v as Quiz['difficulty'] }))} options={['easy', 'medium', 'hard'].map((d) => ({ label: d, value: d }))} />
            <Select label="Mode" value={quiz.isTestMode ? 'official' : 'practice'} onChange={(v) => setQuiz((p) => ({ ...p, isTestMode: v === 'official' }))} options={[{ label: 'Practice', value: 'practice' }, { label: 'Official test', value: 'official' }]} />
          </div>
          {quiz.isTestMode && (
            <p className="mt-2 text-xs text-amber-700 border border-amber-200 bg-amber-50 px-3 py-2 inline-block">
              Official test: AI help will be locked for students during this quiz.
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="btn-ghost" onClick={props.onCancel}>Cancel</button>
          <button className="btn-primary" onClick={() => props.onSave(quiz)}>Save draft</button>
          <button className="bg-emerald-600 text-white px-5 py-3 font-black text-sm" onClick={() => props.onPublish(quiz)}>
            Publish quiz
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {quiz.questions.map((question, index) => (
          <div key={question.id} className="border border-zinc-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="label">Question {index + 1} · {question.topicTag}</p>
              <div className="flex gap-2">
                <button className="btn-ghost text-xs" onClick={() => setEditingQuestionId(editingQuestionId === question.id ? null : question.id)}>
                  {editingQuestionId === question.id ? 'Done editing' : 'Edit'}
                </button>
                <button className="icon-btn" onClick={() => deleteQuestion(question.id)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            {editingQuestionId === question.id ? (
              <div className="mt-4 grid gap-3">
                <TextArea label="Question text" value={question.text} onChange={(v) => updateQuestion(question.id, { text: v })} />
                {question.options && (
                  <>
                    {question.options.map((opt, i) => (
                      <Field key={i} label={`Option ${String.fromCharCode(65 + i)}`} value={opt} onChange={(v) => {
                        const opts = [...question.options!];
                        opts[i] = v;
                        updateQuestion(question.id, { options: opts });
                      }} />
                    ))}
                    <Field label="Correct answer" value={question.correctAnswer} onChange={(v) => updateQuestion(question.id, { correctAnswer: v })} />
                  </>
                )}
                {question.options == null && (
                  <Field label="Correct answer" value={question.correctAnswer} onChange={(v) => updateQuestion(question.id, { correctAnswer: v })} />
                )}
                <TextArea label="Explanation" value={question.explanation} onChange={(v) => updateQuestion(question.id, { explanation: v })} />
                <Field label="Topic tag" value={question.topicTag} onChange={(v) => updateQuestion(question.id, { topicTag: v })} />
              </div>
            ) : (
              <>
                <h3 className="mt-2 font-black">{question.text}</h3>
                {question.options && (
                  <div className="mt-3 grid gap-1">
                    {question.options.map((opt, i) => (
                      <p key={i} className={`text-sm p-2 ${opt === question.correctAnswer ? 'bg-emerald-50 text-emerald-800 font-bold' : 'bg-stone-50'}`}>
                        {String.fromCharCode(65 + i)}. {opt}
                        {opt === question.correctAnswer && ' ✓'}
                      </p>
                    ))}
                  </div>
                )}
                {question.options == null && (
                  <p className="mt-2 text-sm text-zinc-600">Short answer — correct: {question.correctAnswer}</p>
                )}
                <p className="mt-3 text-xs text-zinc-500">{question.explanation}</p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-2">
        <button className="btn-ghost" onClick={props.onCancel}>Cancel</button>
        <button className="btn-primary" onClick={() => props.onSave(quiz)}>Save draft</button>
        <button className="bg-emerald-600 text-white px-5 py-3 font-black text-sm" onClick={() => props.onPublish(quiz)}>
          Publish quiz
        </button>
      </div>
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-zinc-200 bg-stone-50 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-black">{value}</p>
    </div>
  );
}

function MetricPanel({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-emerald-600">{icon}</div>
        <p className="font-mono text-3xl font-black">{value}</p>
      </div>
      <p className="mt-4 text-sm font-bold">{label}</p>
    </Panel>
  );
}

function CourseRow({ course, actionLabel, onAction, onClick, active = false }: { course: Course; actionLabel: string; onAction: () => void; onClick?: () => void; active?: boolean }) {
  return (
    <div onClick={onClick} className={`border p-4 ${active ? 'border-zinc-950 bg-emerald-50' : 'border-zinc-200 bg-white'} ${onClick ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black">{course.title}</h3>
          <p className="mt-1 text-xs text-zinc-500">{course.subject} · {course.semester} · Code {course.code}</p>
          <p className="mt-2 text-sm text-zinc-600">{course.description}</p>
        </div>
        <button className="btn-ghost shrink-0" onClick={(event) => { event.stopPropagation(); onAction(); }}>{actionLabel}</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, maxLength }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input mt-2 w-full" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={maxLength} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea className="input mt-2 min-h-24 w-full resize-y" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { label: string; value: string }[] }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input mt-2 w-full" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function CourseSelect({ courses, value, onChange }: { courses: Course[]; value: string; onChange: (value: string) => void }) {
  return <Select label="Course" value={value} onChange={onChange} options={courses.map((course) => ({ label: `${course.title} (${course.code})`, value: course.id }))} />;
}

function Empty({ text }: { text: string }) {
  return <div className="border border-dashed border-zinc-300 bg-stone-50 p-6 text-center text-sm text-zinc-500">{text}</div>;
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs"><span>{label}</span><span className="font-mono">{value}</span></div>
      <div className="h-2 bg-zinc-200"><div className="h-full bg-emerald-500" style={{ width: `${Math.max(8, (value / max) * 100)}%` }} /></div>
    </div>
  );
}

export default App;
