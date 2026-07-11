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
  answerWithRag,
  createLessonMap,
  DEFAULT_AI_SETTINGS,
  diagnoseOfflineMistake,
  generatePracticeSetWithAI,
  generateQuizWithAI,
  hashContent,
  loadAISettings,
  processMaterialWithAI,
  saveAISettings,
  testGoogleAiConnection,
  testOpenRouterConnection,
} from './services/ai';
import {
  loadClassroomSnapshot,
  persistAttempts,
  persistCourses,
  persistLogs,
  persistMaterials,
  persistPracticeSets,
  persistQuizzes,
  persistStudent,
  persistTeacher,
  reloadSharedClassroom,
  stableEqual,
} from './services/classroomStore';
import {
  DesktopEnvironment,
  getDesktopEnvironment,
  isDesktopRuntime,
  loadDesktopModelState,
  saveDesktopModelState,
} from './services/desktop';
import {
  downloadHfModel,
  formatBytes,
  HF_GEMMA_PRESETS,
  importLocalGguf,
  listLocalGgufModels,
  openModelsFolder,
  registerExternalGguf,
  stopOfflineRuntime,
  testOfflineHfModel,
  type LocalGgufModel,
} from './services/localModel';
import { chunkDocumentText, extractTextFromFile } from './services/pdf';
import {
  INITIAL_ATTEMPTS,
  INITIAL_COURSES,
  INITIAL_MATERIALS,
  INITIAL_PRACTICE_SETS,
  INITIAL_STUDENT_PROFILE,
  INITIAL_SYSTEM_LOGS,
  INITIAL_TEACHER_PROFILE,
} from './mockData';

type Screen = 'auth' | 'student' | 'teacher';
type StudentTab = 'overview' | 'courses' | 'materials' | 'assistant' | 'quizzes' | 'practice' | 'profile' | 'model';
type TeacherTab = 'overview' | 'courses' | 'materials' | 'quizzes' | 'analytics' | 'assistant' | 'model';

const nowStamp = () => new Date().toISOString().replace('T', ' ').slice(0, 16);

const defaultModel: LocalModelState = {
  provider: 'huggingface',
  modelName: 'gemma-2-2b-it-Q4_K_M.gguf',
  hfUrl: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF',
  localPath: '',
  hfToken: '',
  downloadStatus: 'not_downloaded',
  downloadProgress: 0,
  connected: false,
  endpoint: 'http://127.0.0.1:3928',
};

/** Migrate older Ollama-based saved state to Hugging Face offline */
function normalizeModelState(raw: LocalModelState | null | undefined): LocalModelState {
  if (!raw) return { ...defaultModel };
  const legacy = raw as LocalModelState & { provider?: string };
  const providerName = String(legacy.provider || '');
  const isLegacyOllama =
    providerName === 'ollama' ||
    (legacy.endpoint || '').includes('11434') ||
    (legacy.modelName || '').includes(':');
  return {
    ...defaultModel,
    ...legacy,
    provider: 'huggingface',
    endpoint:
      isLegacyOllama || !legacy.endpoint || legacy.endpoint.includes('11434')
        ? 'http://127.0.0.1:3928'
        : legacy.endpoint,
    // Force re-connect after migration
    connected: isLegacyOllama ? false : Boolean(legacy.connected && legacy.localPath),
    localPath: legacy.localPath || '',
    hfUrl: legacy.hfUrl || defaultModel.hfUrl,
    hfToken: legacy.hfToken || '',
  };
}

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

const defaultTeacher: TeacherProfile = { ...INITIAL_TEACHER_PROFILE };

/** Normalize user-entered course join codes to 4 digits. */
function normalizeCourseCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4);
}

function isValidCourseCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}

function App() {
  const [role, setRole] = useStoredState<UserRole>('letsdoit_role_v4', null);
  const [student, setStudent] = useState<StudentProfile>(INITIAL_STUDENT_PROFILE);
  const [teacher, setTeacher] = useState<TeacherProfile>(defaultTeacher);
  const [courses, setCourses] = useState<Course[]>(INITIAL_COURSES);
  const [materials, setMaterials] = useState<CourseMaterial[]>(INITIAL_MATERIALS);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>(INITIAL_ATTEMPTS);
  const [practiceSets, setPracticeSets] = useState<PracticeSet[]>(INITIAL_PRACTICE_SETS);
  const [logs, setLogs] = useState<SystemLog[]>(INITIAL_SYSTEM_LOGS);
  const [model, setModel] = useStoredState<LocalModelState>('letsdoit_model_v4', defaultModel);
  const [aiSettings, setAiSettings] = useStoredState<AISettings>('letsdoit_ai_settings_v3', DEFAULT_AI_SETTINGS);
  const [desktopEnv, setDesktopEnv] = useState<DesktopEnvironment | null>(null);
  const [desktopModelReady, setDesktopModelReady] = useState(false);
  const [classroomReady, setClassroomReady] = useState(false);
  const [classroomNotice, setClassroomNotice] = useState<string | null>(null);
  const lastMaterialCountRef = useRef(0);
  const lastRevisionRef = useRef(0);

  const screen: Screen = role === 'STUDENT' ? 'student' : role === 'TEACHER' ? 'teacher' : 'auth';

  // Boot: shared classroom store (disk + localStorage) so teacher uploads reach students
  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      try {
        const environment = await getDesktopEnvironment();
        const storedModel = await loadDesktopModelState();
        const storedSettings = await loadAISettings();
        const snap = await loadClassroomSnapshot({
          courses: INITIAL_COURSES,
          materials: INITIAL_MATERIALS,
          // Quizzes/attempts start empty — only real AI generation + student work
          quizzes: [],
          attempts: INITIAL_ATTEMPTS,
          practiceSets: INITIAL_PRACTICE_SETS,
          logs: INITIAL_SYSTEM_LOGS,
          student: INITIAL_STUDENT_PROFILE,
          teacher: defaultTeacher,
        });
        if (!mounted) return;
        setDesktopEnv(environment);
        if (storedModel) {
          const restoredModel = normalizeModelState(storedModel);
          setModel(restoredModel);
          // Reconnect downloaded models automatically on desktop startup.
          if (restoredModel.localPath && isDesktopRuntime()) {
            void testOfflineHfModel(restoredModel.localPath).then((result) => {
              if (!mounted) return;
              setModel((prev) => ({
                ...prev,
                connected: result.ok,
                downloadStatus: 'downloaded',
                downloadProgress: 100,
                lastChecked: nowStamp(),
              }));
            });
          }
        }
        if (storedSettings) {
          setAiSettings((prev) => ({ ...DEFAULT_AI_SETTINGS, ...prev, ...storedSettings }));
        }
        setCourses(snap.courses);
        setMaterials(snap.materials);
        setQuizzes(snap.quizzes);
        setAttempts(snap.attempts);
        setPracticeSets(snap.practiceSets);
        setLogs(snap.logs);
        if (snap.student) setStudent(snap.student);
        if (snap.teacher) setTeacher(snap.teacher);
        lastRevisionRef.current = snap.revision;
        lastMaterialCountRef.current = snap.materials.length;
      } finally {
        if (mounted) {
          setDesktopModelReady(true);
          setClassroomReady(true);
        }
      }
    };
    void boot();
    return () => {
      mounted = false;
    };
  }, [setModel, setAiSettings]);

  // Persist shared classroom slices whenever they change (after boot)
  useEffect(() => {
    if (!classroomReady) return;
    void persistCourses(courses);
  }, [classroomReady, courses]);

  useEffect(() => {
    if (!classroomReady) return;
    void persistMaterials(materials);
  }, [classroomReady, materials]);

  useEffect(() => {
    if (!classroomReady) return;
    void persistQuizzes(quizzes);
  }, [classroomReady, quizzes]);

  useEffect(() => {
    if (!classroomReady) return;
    void persistAttempts(attempts);
  }, [classroomReady, attempts]);

  useEffect(() => {
    if (!classroomReady) return;
    void persistPracticeSets(practiceSets);
  }, [classroomReady, practiceSets]);

  useEffect(() => {
    if (!classroomReady) return;
    void persistLogs(logs);
  }, [classroomReady, logs]);

  useEffect(() => {
    if (!classroomReady) return;
    void persistStudent(student);
  }, [classroomReady, student]);

  useEffect(() => {
    if (!classroomReady) return;
    void persistTeacher(teacher);
  }, [classroomReady, teacher]);

  useEffect(() => {
    if (!desktopModelReady) return;
    void saveDesktopModelState(model).catch(() => undefined);
  }, [desktopModelReady, model]);

  useEffect(() => {
    if (!desktopModelReady) return;
    void saveAISettings(aiSettings).catch(() => undefined);
  }, [desktopModelReady, aiSettings]);

  // Live sync: poll shared store so students see teacher uploads without re-login
  useEffect(() => {
    if (!classroomReady) return;

    const pull = async () => {
      const shared = await reloadSharedClassroom();
      const revisionAdvanced = shared.revision > lastRevisionRef.current;
      lastRevisionRef.current = Math.max(lastRevisionRef.current, shared.revision);

      if (shared.courses) {
        setCourses((prev) => (stableEqual(prev, shared.courses) ? prev : shared.courses!));
      }
      if (shared.quizzes) {
        setQuizzes((prev) => (stableEqual(prev, shared.quizzes) ? prev : shared.quizzes!));
      }
      if (shared.attempts) {
        setAttempts((prev) => (stableEqual(prev, shared.attempts) ? prev : shared.attempts!));
      }
      if (shared.practiceSets) {
        setPracticeSets((prev) => (stableEqual(prev, shared.practiceSets) ? prev : shared.practiceSets!));
      }
      if (shared.logs) {
        setLogs((prev) => (stableEqual(prev, shared.logs) ? prev : shared.logs!));
      }
      if (shared.materials) {
        setMaterials((prev) => {
          if (stableEqual(prev, shared.materials)) return prev;
          const prevJoined = prev.filter((m) => student.joinedCourseIds.includes(m.courseId));
          const nextJoined = shared.materials!.filter((m) => student.joinedCourseIds.includes(m.courseId));
          if (role === 'STUDENT' && nextJoined.length > prevJoined.length) {
            const newest = nextJoined[0];
            const delta = nextJoined.length - prevJoined.length;
            setClassroomNotice(
              `New course update: ${delta} material(s) for your courses` +
                (newest ? ` — latest: "${newest.title}"` : '') +
                `. Open Materials to study.`,
            );
          } else if (role === 'STUDENT' && revisionAdvanced && nextJoined.length > 0) {
            // Updated existing materials (e.g. AI summary refreshed)
            const changed = nextJoined.find(
              (n) => !prevJoined.some((p) => p.id === n.id && p.contentHash === n.contentHash),
            );
            if (changed) {
              setClassroomNotice(
                `Course material updated: "${changed.title}". Open Materials for the latest summary/chunks.`,
              );
            }
          } else if (role === 'TEACHER' && revisionAdvanced) {
            setClassroomNotice('Classroom data refreshed (materials / enrollments / activity).');
          }
          lastMaterialCountRef.current = shared.materials!.length;
          return shared.materials!;
        });
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === 'letsdoit_materials_v4' ||
        event.key === 'letsdoit_courses_v4' ||
        event.key === 'letsdoit_quizzes_v4' ||
        event.key === 'letsdoit_attempts_v4' ||
        event.key === 'letsdoit_classroom_revision_v4'
      ) {
        void pull();
      }
    };
    const onCustom = () => {
      void pull();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('letsdoit-classroom-updated', onCustom as EventListener);
    const timer = window.setInterval(() => {
      void pull();
    }, 2500);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('letsdoit-classroom-updated', onCustom as EventListener);
      window.clearInterval(timer);
    };
  }, [classroomReady, role, student.joinedCourseIds]);

  const addLog = (event: string, details: string, logRole: SystemLog['role']) => {
    setLogs((prev) => [{ id: uid('log'), timestamp: nowStamp(), event, details, role: logRole }, ...prev]);
  };

  const logout = () => setRole(null);

  return (
    <div className="min-h-[100dvh] bg-stone-50 text-zinc-950">
      {classroomNotice && (
        <div className="sticky top-0 z-50 border-b border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-950 flex items-center justify-between gap-3">
          <span className="font-medium">{classroomNotice}</span>
          <button type="button" className="btn-ghost text-xs shrink-0" onClick={() => setClassroomNotice(null)}>
            Dismiss
          </button>
        </div>
      )}
      {!classroomReady && (
        <div className="px-4 py-2 text-xs text-zinc-500">Loading shared classroom data…</div>
      )}
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
          classroomNotice={classroomNotice}
          setStudent={setStudent}
          setCourses={setCourses}
          setMaterials={setMaterials}
          setQuizzes={setQuizzes}
          setAttempts={setAttempts}
          setPracticeSets={setPracticeSets}
          setModel={setModel}
          setAiSettings={setAiSettings}
          addLog={addLog}
          onLogout={logout}
          onDismissNotice={() => setClassroomNotice(null)}
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
    if (mode === 'student') {
      if (!student.name.trim() || !student.email.trim()) {
        setError('Enter your name and email to open the student workspace.');
        return;
      }
    } else {
      if (!teacher.name.trim() || !teacher.email.trim()) {
        setError('Enter faculty name and email to open the teacher workspace.');
        return;
      }
      if (secret !== 'TEACH-2026') {
        setError('Teacher access is restricted. Use the admin secret: TEACH-2026.');
        return;
      }
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
            <Cpu className="h-4 w-4" /> Offline-first hybrid classroom
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
  classroomNotice?: string | null;
  setStudent: React.Dispatch<React.SetStateAction<StudentProfile>>;
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  setMaterials: React.Dispatch<React.SetStateAction<CourseMaterial[]>>;
  setQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>;
  setAttempts: React.Dispatch<React.SetStateAction<QuizAttempt[]>>;
  setPracticeSets: React.Dispatch<React.SetStateAction<PracticeSet[]>>;
  setModel: React.Dispatch<React.SetStateAction<LocalModelState>>;
  setAiSettings: React.Dispatch<React.SetStateAction<AISettings>>;
  addLog: (event: string, details: string, role: SystemLog['role']) => void;
  onLogout: () => void;
  onDismissNotice?: () => void;
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
  const [materialBusyId, setMaterialBusyId] = useState<string | null>(null);
  const [materialActionMsg, setMaterialActionMsg] = useState<string | null>(null);
  const [quizDifficulty, setQuizDifficulty] = useState<'easy' | 'moderate' | 'hard'>('moderate');
  const [summaryPanel, setSummaryPanel] = useState<{
    materialId: string;
    title: string;
    summary: string;
    points: string[];
    studyHelp: string;
    provider: string;
  } | null>(null);

  const joinedCourses = useMemo(
    () => props.courses.filter((course) => props.profile.joinedCourseIds.includes(course.id)),
    [props.courses, props.profile.joinedCourseIds],
  );
  const joinedMaterials = props.materials.filter((material) => props.profile.joinedCourseIds.includes(material.courseId));
  const availableQuizzes = props.quizzes.filter((quiz) => props.profile.joinedCourseIds.includes(quiz.courseId) && quiz.isPublished);
  const hasUnlockedOfficialTest = availableQuizzes.some((quiz) => quiz.isTestMode && !props.attempts.some((attempt) => attempt.quizId === quiz.id));

  const joinCourse = (event: React.FormEvent) => {
    event.preventDefault();
    const code = normalizeCourseCode(joinCode);
    if (!isValidCourseCode(code)) {
      setJoinMessage('Enter a valid 4-digit course code (e.g. 4821).');
      return;
    }
    const course = props.courses.find((item) => item.code === code && item.status === 'active');
    if (!course) {
      setJoinMessage(`No active course found for code ${code}. Ask your teacher for the join code.`);
      return;
    }
    if (props.profile.joinedCourseIds.includes(course.id)) {
      setJoinMessage('You are already enrolled in this course.');
      return;
    }
    const studentId = props.profile.id || `s_${Date.now()}`;
    props.setStudent((prev) => ({
      ...prev,
      id: prev.id || studentId,
      joinedCourseIds: [...prev.joinedCourseIds, course.id],
    }));
    props.setCourses((prev) =>
      prev.map((item) =>
        item.id === course.id
          ? {
              ...item,
              enrolledCount: item.enrolledCount + 1,
              enrolledStudentIds: item.enrolledStudentIds.includes(studentId)
                ? item.enrolledStudentIds
                : [...item.enrolledStudentIds, studentId],
            }
          : item,
      ),
    );
    props.addLog('Course joined', `${props.profile.name || 'Student'} joined ${course.title} (${code}).`, 'STUDENT');
    setJoinCode('');
    setJoinMessage(`Joined ${course.title}. Materials for this course will appear under Materials.`);
  };

  const sendChat = async (event?: React.FormEvent, promptOverride?: string) => {
    event?.preventDefault();
    const prompt = promptOverride || chatInput.trim();
    if (!prompt) return;

    setChatInput('');
    setThinking(true);
    setChat((prev) => [...prev, { id: uid('msg'), sender: 'user', text: prompt, timestamp: nowStamp() }]);
    try {
      // RAG: retrieve relevant chunks from selected material or all enrolled courses
      const history = chat.slice(-6).map((m) => ({
        role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.text,
      }));
      const response = await answerWithRag({
        question: prompt,
        mode: aiMode,
        model: props.model,
        settings: props.aiSettings,
        style: languageStyle,
        selectedMaterial,
        courseMaterials: joinedMaterials,
        courseIds: props.profile.joinedCourseIds,
        history,
      });
      setChat((prev) => [
        ...prev,
        {
          id: uid('msg'),
          sender: 'ai',
          text:
            `${response.text}\n\n` +
            `Provider: ${response.providerName}${response.fromCache ? ' · cached' : ''}` +
            ` · RAG: ${response.ragChunks} passage(s) (${response.ragMode})`,
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

    setResult(attempt);
    setActiveQuiz(null);
    setAnswers({});

    // Real AI practice set for self-improvement (no dummy templates)
    if (mistakes.length > 0) {
      setMaterialActionMsg('Generating real AI practice set from your mistakes + document chunks…');
      const sourceMaterial =
        props.materials.find((m) => m.id === activeQuiz.sourceMaterialId) ||
        props.materials.find((m) => m.courseId === activeQuiz.courseId && (m.chunks?.length || m.contentText));
      void (async () => {
        try {
          const practiceSet = await generatePracticeSetWithAI({
            studentId: props.profile.id,
            courseId: activeQuiz.courseId,
            courseTitle:
              props.courses.find((course) => course.id === activeQuiz.courseId)?.title || 'Course',
            attemptId: attempt.id,
            mistakes,
            weakTopics: Array.from(weakTopics),
            material: sourceMaterial || null,
            mode: aiMode,
            model: props.model,
            settings: props.aiSettings,
            style: languageStyle,
          });
          props.setPracticeSets((prev) => [practiceSet, ...prev]);
          setMaterialActionMsg(
            `Practice set ready: ${practiceSet.questions.length} real questions for self-improvement. Open Practice tab.`,
          );
          props.addLog(
            'Practice set generated',
            `AI practice (${practiceSet.questions.length} Qs) for ${activeQuiz.title}.`,
            'STUDENT',
          );
        } catch (error) {
          setMaterialActionMsg(
            error instanceof Error
              ? `Could not generate AI practice set:\n${error.message}`
              : 'Could not generate AI practice set.',
          );
        }
      })();
    }
  };

  const runDocumentSummary = async (material: CourseMaterial) => {
    if (materialBusyId) return;
    setMaterialBusyId(material.id);
    setMaterialActionMsg(`Generating document summary for "${material.title}" with ${aiMode} model...`);
    setSummaryPanel(null);
    try {
      const chunks =
        material.chunks?.length
          ? material.chunks
          : chunkDocumentText(material.contentText || material.contentSummary || '');
      if (!chunks.length && !(material.contentText || material.contentSummary)) {
        throw new Error('This material has no extracted text yet. Ask your teacher to re-upload a searchable PDF.');
      }
      const analysis = await processMaterialWithAI(
        material.title,
        material.contentText || material.contentSummary || '',
        aiMode,
        props.model,
        props.aiSettings,
        languageStyle,
        chunks,
      );
      // Persist improved summary on the shared material record
      props.setMaterials((prev) =>
        prev.map((m) =>
          m.id === material.id
            ? {
                ...m,
                contentSummary: analysis.summary,
                importantPoints: analysis.importantPoints,
                studyHelp: analysis.studyHelp,
                aiProcessed: true,
                chunks: m.chunks?.length ? m.chunks : chunks,
              }
            : m,
        ),
      );
      setSummaryPanel({
        materialId: material.id,
        title: material.title,
        summary: analysis.summary,
        points: analysis.importantPoints,
        studyHelp: analysis.studyHelp,
        provider: analysis.providerName,
      });
      setMaterialActionMsg(`Document summary ready via ${analysis.providerName}.`);
      props.addLog(
        'Document summary',
        `${props.profile.name} generated AI summary for ${material.title}.`,
        'STUDENT',
      );
    } catch (error) {
      setMaterialActionMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setMaterialBusyId(null);
    }
  };

  const runPracticeQuizFromMaterial = async (material: CourseMaterial) => {
    if (materialBusyId) return;
    setMaterialBusyId(material.id);
    setMaterialActionMsg(
      `Generating ${quizDifficulty} practice quiz from document chunks for "${material.title}"...`,
    );
    try {
      const chunks =
        material.chunks?.length
          ? material.chunks
          : chunkDocumentText(material.contentText || material.contentSummary || '');
      const materialWithChunks: CourseMaterial = {
        ...material,
        chunks: chunks.length ? chunks : material.chunks,
      };
      if (!chunks.length && !material.contentText?.trim()) {
        throw new Error(
          'Cannot build a quiz: no document chunks available. Ask the teacher to re-upload the PDF with extractable text.',
        );
      }
      const quiz = await generateQuizWithAI(
        {
          courseId: material.courseId,
          title: `Practice: ${material.title} (${quizDifficulty})`,
          material: materialWithChunks,
          difficulty: quizDifficulty,
          questionType: 'Mixed',
          isTestMode: false,
          timeLimit: quizDifficulty === 'hard' ? 20 : quizDifficulty === 'moderate' ? 15 : 10,
        },
        aiMode,
        props.model,
        props.aiSettings,
        languageStyle,
      );
      quiz.isPublished = true;
      quiz.isDraft = false;
      props.setQuizzes((prev) => [quiz, ...prev]);
      if (!material.chunks?.length && chunks.length) {
        props.setMaterials((prev) =>
          prev.map((m) => (m.id === material.id ? { ...m, chunks } : m)),
        );
      }
      setActiveQuiz(quiz);
      setResult(null);
      setAnswers({});
      setTab('quizzes');
      setMaterialActionMsg(
        `Quiz ready: ${quiz.questions.length} questions from document chunks (${quizDifficulty}).`,
      );
      props.addLog(
        'Practice quiz generated',
        `${props.profile.name} generated a ${quizDifficulty} quiz from ${material.title} (${quiz.questions.length} Qs).`,
        'STUDENT',
      );
    } catch (error) {
      setMaterialActionMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setMaterialBusyId(null);
    }
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
          {props.classroomNotice && (
            <Panel className="lg:col-span-2 border-emerald-300 bg-emerald-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="label text-emerald-800">Course update</p>
                  <p className="mt-1 text-sm text-emerald-950">{props.classroomNotice}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" className="btn-primary text-xs" onClick={() => setTab('materials')}>
                    Open materials
                  </button>
                  <button type="button" className="btn-ghost text-xs" onClick={() => props.onDismissNotice?.()}>
                    Dismiss
                  </button>
                </div>
              </div>
            </Panel>
          )}
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
              <Metric label="Course materials" value={joinedMaterials.length} />
              <Metric label="Practice attempts" value={props.attempts.length} />
            </div>
            <p className="mt-3 text-[11px] text-zinc-500">
              Materials sync automatically when your teacher uploads to a joined course (shared classroom store).
            </p>
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
              <Field
                label="Four digit course code"
                value={joinCode}
                onChange={(v) => setJoinCode(normalizeCourseCode(v))}
                placeholder="e.g. 4821"
                maxLength={4}
              />
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
        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[160px]">
                <Select
                  label="Practice quiz difficulty"
                  value={quizDifficulty}
                  onChange={(v) => setQuizDifficulty(v as 'easy' | 'moderate' | 'hard')}
                  options={[
                    { label: 'Easy', value: 'easy' },
                    { label: 'Moderate', value: 'moderate' },
                    { label: 'Hard', value: 'hard' },
                  ]}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(['OFFLINE', 'ONLINE', 'HYBRID'] as AIMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`nav-btn ${aiMode === mode ? 'nav-btn-active' : ''}`}
                    onClick={() => setAiMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              Materials uploaded by your teacher appear here. Document Summary and Practice Quiz use real model inference on extracted document chunks — not dummy text.
            </p>
            {materialActionMsg && (
              <pre className="mt-3 whitespace-pre-wrap border border-zinc-200 bg-stone-50 px-3 py-2 text-[11px] text-zinc-700">
                {materialActionMsg}
              </pre>
            )}
          </Panel>

          {summaryPanel && (
            <Panel className="p-5 border-emerald-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="label">Document summary</p>
                  <h3 className="mt-1 text-lg font-black">{summaryPanel.title}</h3>
                  <p className="mt-1 text-[11px] text-zinc-500">{summaryPanel.provider}</p>
                </div>
                <button className="btn-ghost text-xs" type="button" onClick={() => setSummaryPanel(null)}>
                  Close
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-700 whitespace-pre-wrap">{summaryPanel.summary}</p>
              {summaryPanel.points.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Important points</p>
                  <ul className="mt-1 space-y-1 text-sm text-zinc-700">
                    {summaryPanel.points.map((point) => (
                      <li key={point}>• {point}</li>
                    ))}
                  </ul>
                </div>
              )}
              {summaryPanel.studyHelp && (
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Study help</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-700 whitespace-pre-wrap">{summaryPanel.studyHelp}</p>
                </div>
              )}
            </Panel>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {joinedMaterials.map((material) => (
              <Panel key={material.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="label">
                      {material.type} · {material.topic || 'Lesson'}
                      {material.chunks?.length ? ` · ${material.chunks.length} chunks` : ''}
                    </p>
                    <h3 className="mt-2 text-lg font-black">{material.title}</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {material.fileName} · {material.fileSize}
                      {material.aiProcessed ? ' · AI analyzed' : ''}
                    </p>
                  </div>
                  <FileText className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{material.contentSummary}</p>
                {material.importantPoints && material.importantPoints.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-zinc-600">
                    {material.importantPoints.slice(0, 5).map((point) => (
                      <li key={point}>• {point}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="btn-primary"
                    type="button"
                    disabled={materialBusyId === material.id}
                    onClick={() => void runDocumentSummary(material)}
                  >
                    <Bot className="h-4 w-4" />
                    {materialBusyId === material.id ? 'Working...' : 'Document Summary'}
                  </button>
                  <button
                    className="btn-primary"
                    type="button"
                    disabled={materialBusyId === material.id}
                    onClick={() => void runPracticeQuizFromMaterial(material)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Practice Quiz
                  </button>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => {
                      setSelectedMaterial(material);
                      setTab('assistant');
                    }}
                  >
                    <Bot className="h-4 w-4" /> Chat
                  </button>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => {
                      const blob = new Blob([material.contentText || material.contentSummary], {
                        type: 'text/plain',
                      });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = material.fileName.endsWith('.pdf')
                        ? material.fileName.replace(/\.pdf$/i, '.txt')
                        : material.fileName;
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="h-4 w-4" /> Download text
                  </button>
                </div>
              </Panel>
            ))}
            {!joinedMaterials.length && (
              <div className="md:col-span-2">
                <Empty text="No course materials yet. Join a course with a 4-digit code — teacher uploads will appear here." />
              </div>
            )}
          </div>
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
  const [quizDraft, setQuizDraft] = useState({ title: '', materialId: '', difficulty: 'moderate' as Quiz['difficulty'], type: 'MCQ' as Quiz['questionType'], mode: 'practice', timeLimit: 15 });
  const [draftQuizzes, setDraftQuizzes] = useState<Quiz[]>([]);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [teacherChat, setTeacherChat] = useState<ChatMessage[]>([]);
  const [teacherPrompt, setTeacherPrompt] = useState('');
  const [aiMode, setAiMode] = useState<AIMode>('HYBRID');
  const [thinking, setThinking] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [courseStatus, setCourseStatus] = useState<string | null>(null);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const teacherCourses = props.courses.filter(
    (course) => course.teacherId === props.profile.id || (!course.teacherId && props.profile.id === 't1'),
  );
  const selectedCourse = teacherCourses.find((course) => course.id === selectedCourseId) || teacherCourses[0];
  const selectedMaterials = selectedCourse ? props.materials.filter((material) => material.courseId === selectedCourse.id) : [];
  const selectedQuizzes = selectedCourse ? props.quizzes.filter((quiz) => quiz.courseId === selectedCourse.id) : [];
  const selectedAttempts = selectedCourse
    ? props.attempts.filter((attempt) => attempt.courseId === selectedCourse.id)
    : props.attempts.filter((attempt) => teacherCourses.some((c) => c.id === attempt.courseId));
  const weakTopics = selectedAttempts.flatMap((attempt) => attempt.diagnosis.weakTopics);
  const riskCount = selectedAttempts.filter(
    (attempt) => attempt.totalQuestions > 0 && attempt.score / attempt.totalQuestions < 0.5,
  ).length;
  const enrolledIds = selectedCourse?.enrolledStudentIds || [];
  const teacherMaterialCount = props.materials.filter((m) =>
    teacherCourses.some((c) => c.id === m.courseId),
  ).length;

  const createCourse = (event: React.FormEvent) => {
    event.preventDefault();
    const title = courseDraft.title.trim();
    if (!title) {
      setCourseStatus('Course title is required.');
      return;
    }
    let code = normalizeCourseCode(courseDraft.code);
    if (code && !isValidCourseCode(code)) {
      setCourseStatus('Course code must be exactly 4 digits.');
      return;
    }
    if (!code) {
      // Generate a unique 4-digit code
      let attemptsGen = 0;
      do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
        attemptsGen += 1;
      } while (props.courses.some((c) => c.code === code) && attemptsGen < 40);
    }
    if (props.courses.some((c) => c.code === code)) {
      setCourseStatus(`Code ${code} is already in use. Pick another 4-digit code.`);
      return;
    }
    const course: Course = {
      id: uid('course'),
      code,
      title,
      description: courseDraft.description.trim() || 'Teacher-created local course.',
      subject: courseDraft.subject.trim() || props.profile.department || 'General',
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
    setCourseStatus(`Course created. Share join code ${code} with students.`);
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
      let pageCount: number | undefined;
      let chunks = chunkDocumentText(contentText);

      if (file) {
        fileName = file.name;
        fileSize = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
        type = fileTypeFromName(file.name);
        setUploadStatus(`Extracting & chunking text from ${file.name}...`);
        const extracted = await extractTextFromFile(file);
        if (extracted.text) {
          contentText = [materialDraft.summary, extracted.text].filter(Boolean).join('\n\n');
        }
        chunks = extracted.chunks?.length
          ? extracted.chunks
          : chunkDocumentText(contentText);
        pageCount = extracted.pageCount || undefined;
        extractWarning = extracted.warning;
        if (!extracted.text && !materialDraft.summary) {
          setUploadStatus(
            extracted.warning ||
              'No text could be extracted. Add a summary so the AI can still use this material.',
          );
        }
      } else if (contentText.trim()) {
        chunks = chunkDocumentText(contentText);
      }

      if (!contentText.trim() && !materialDraft.summary.trim()) {
        setUploadStatus('Add a file with extractable text, or paste notes in the summary field.');
        return;
      }

      const title = materialDraft.title || fileName;
      let contentSummary =
        materialDraft.summary ||
        `Indexed ${fileName} into ${chunks.length || 0} chunk(s) for AI study help.`;
      let importantPoints: string[] = [];
      let studyHelp = '';
      let aiProcessed = false;
      let statusMessage = extractWarning || '';

      // Auto-run AI analysis when a provider is available
      const canRunOnline = Boolean(
        props.aiSettings.openRouterApiKey?.trim() || props.aiSettings.googleAiApiKey?.trim(),
      );
      const canRunOffline = props.model.connected;
      if (contentText.trim()) {
        if (canRunOnline || canRunOffline) {
          setUploadStatus(
            `Generating summary from ${chunks.length || 1} chunk(s) with ${aiMode} model...`,
          );
          try {
            const analysis = await processMaterialWithAI(
              title,
              contentText,
              aiMode,
              props.model,
              props.aiSettings,
              'en',
              chunks,
            );
            contentSummary = analysis.summary || contentSummary;
            importantPoints = analysis.importantPoints;
            studyHelp = analysis.studyHelp;
            aiProcessed = true;
            statusMessage = `Stored with ${chunks.length} chunk(s). AI analysis via ${analysis.providerName}.`;
          } catch (aiError) {
            const msg = aiError instanceof Error ? aiError.message : String(aiError);
            contentSummary =
              materialDraft.summary ||
              compactText(contentText, 400) ||
              contentSummary;
            importantPoints = extractFallbackPoints(contentText);
            statusMessage =
              `Material saved with ${chunks.length} extracted chunk(s), but AI analysis failed:\n${msg}\n\n` +
              `Use "Summarize with Model" after fixing Online/Offline settings.`;
          }
        } else {
          contentSummary = materialDraft.summary || compactText(contentText, 400);
          importantPoints = extractFallbackPoints(contentText);
          statusMessage =
            `Material saved with ${chunks.length} chunk(s). Add an OpenRouter or Google AI key (or connect offline model), then click Summarize with Model.`;
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
        chunks,
        importantPoints,
        studyHelp,
        contentHash,
        aiProcessed,
        extractWarning,
        pageCount,
      };
      material.lessonMap = createLessonMap(material);
      props.setMaterials((prev) => [material, ...prev]);
      setMaterialDraft({ title: '', topic: 'Week 1', summary: '' });
      if (fileInput.current) fileInput.current.value = '';
      props.addLog(
        'Material uploaded',
        `${material.title} was indexed for ${selectedCourse.title} (${chunks.length} chunks)${aiProcessed ? ' with AI analysis' : ''}.`,
        'TEACHER',
      );
      setUploadStatus(
        statusMessage ||
          (aiProcessed
            ? `Stored "${material.title}" with AI summary and important points.`
            : `Stored "${material.title}" with ${chunks.length} chunks.`),
      );
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploadingMaterial(false);
    }
  };

  const summarizeMaterialWithModel = async (material: CourseMaterial) => {
    if (summarizingId) return;
    setSummarizingId(material.id);
    setUploadStatus(`Summarizing "${material.title}" with ${aiMode} model...`);
    try {
      const chunks =
        material.chunks?.length
          ? material.chunks
          : chunkDocumentText(material.contentText || material.contentSummary || '');
      if (!chunks.length && !(material.contentText || '').trim()) {
        throw new Error('No extractable text on this material. Re-upload a searchable PDF.');
      }
      const analysis = await processMaterialWithAI(
        material.title,
        material.contentText || material.contentSummary || '',
        aiMode,
        props.model,
        props.aiSettings,
        'en',
        chunks,
      );
      props.setMaterials((prev) =>
        prev.map((m) =>
          m.id === material.id
            ? {
                ...m,
                contentSummary: analysis.summary,
                importantPoints: analysis.importantPoints,
                studyHelp: analysis.studyHelp,
                aiProcessed: true,
                chunks: m.chunks?.length ? m.chunks : chunks,
                lessonMap: createLessonMap({
                  ...m,
                  contentSummary: analysis.summary,
                  contentText: m.contentText,
                }),
              }
            : m,
        ),
      );
      setUploadStatus(
        `Summary updated via ${analysis.providerName}.\n${analysis.importantPoints.length} important points generated.`,
      );
      props.addLog(
        'Material summarized',
        `${material.title} summarized with ${analysis.providerName}.`,
        'TEACHER',
      );
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSummarizingId(null);
    }
  };

  const generateQuiz = async () => {
    if (!selectedCourse || generatingQuiz) return;
    const material =
      props.materials.find((item) => item.id === quizDraft.materialId) || selectedMaterials[0];
    if (!material) {
      setUploadStatus('Select a source material with extracted document chunks first.');
      return;
    }
    setGeneratingQuiz(true);
    setUploadStatus(`Generating quiz from "${material.title}" chunks with ${aiMode} model...`);
    try {
      const chunks =
        material.chunks?.length
          ? material.chunks
          : chunkDocumentText(material.contentText || material.contentSummary || '');
      const materialWithChunks = { ...material, chunks };
      const quiz = await generateQuizWithAI(
        {
          courseId: selectedCourse.id,
          title:
            quizDraft.title ||
            `${quizDraft.mode === 'official' ? 'Official Test' : 'Practice'}: ${material.title}`,
          material: materialWithChunks,
          difficulty: quizDraft.difficulty === 'medium' ? 'moderate' : quizDraft.difficulty,
          questionType: quizDraft.type,
          isTestMode: quizDraft.mode === 'official',
          timeLimit: quizDraft.timeLimit,
        },
        aiMode,
        props.model,
        props.aiSettings,
      );
      quiz.isPublished = false;
      quiz.isDraft = true;
      if (!material.chunks?.length && chunks.length) {
        props.setMaterials((prev) =>
          prev.map((m) => (m.id === material.id ? { ...m, chunks } : m)),
        );
      }
      props.setQuizzes((prev) => [quiz, ...prev]);
      setDraftQuizzes((prev) => [quiz, ...prev]);
      setEditingQuiz(quiz);
      setUploadStatus(
        `Draft quiz ready: ${quiz.questions.length} real questions from document chunks. Review before publishing.`,
      );
      props.addLog(
        'Quiz drafted',
        `${quiz.title} drafted from ${material.title} via AI (${quiz.questions.length} Qs).`,
        'TEACHER',
      );
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const sendTeacherChat = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teacherPrompt.trim()) return;
    const prompt = teacherPrompt;
    setTeacherPrompt('');
    setThinking(true);
    setTeacherChat((prev) => [...prev, { id: uid('msg'), sender: 'user', text: prompt, timestamp: nowStamp() }]);
    try {
      const history = teacherChat.slice(-6).map((m) => ({
        role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.text,
      }));
      const analyticsHint =
        `Course analytics: ${selectedCourse?.title || 'n/a'}. Attempts: ${selectedAttempts.length}. ` +
        `Weak topics: ${weakTopics.join(', ') || 'none yet'}.`;
      const response = await answerWithRag({
        question: `${prompt}\n\n(${analyticsHint})`,
        mode: aiMode,
        model: props.model,
        settings: props.aiSettings,
        style: 'en',
        courseMaterials: selectedMaterials,
        courseIds: selectedCourse ? [selectedCourse.id] : teacherCourses.map((c) => c.id),
        history,
      });
      setTeacherChat((prev) => [
        ...prev,
        {
          id: uid('msg'),
          sender: 'ai',
          text:
            `${response.text}\n\nProvider: ${response.providerName}` +
            ` · RAG: ${response.ragChunks} passage(s)`,
          timestamp: nowStamp(),
          modeUsed: response.modeUsed,
        },
      ]);
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
          <MetricPanel icon={<Upload />} label="Uploaded materials" value={teacherMaterialCount} />
          <MetricPanel icon={<Users />} label="Students at risk" value={riskCount} />
          <Panel className="lg:col-span-3 p-6">
            <p className="label">Course analytics snapshot</p>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Metric label="Quiz attempts" value={selectedAttempts.length} />
              <Metric label="Published quizzes" value={selectedQuizzes.filter((q) => q.isPublished).length} />
              <Metric label="Class weak topics" value={new Set(weakTopics).size} />
              <Metric label="Enrolled students" value={enrolledIds.length} />
            </div>
            {selectedCourse && (
              <p className="mt-4 text-xs text-zinc-500">
                Selected course: <strong>{selectedCourse.title}</strong> · join code{' '}
                <span className="font-mono font-bold">{selectedCourse.code}</span>
              </p>
            )}
          </Panel>
          <Panel className="lg:col-span-3 p-6">
            <p className="label">Recent student activity</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {selectedAttempts.slice(0, 6).map((attempt) => (
                <div key={attempt.id} className="border border-zinc-200 bg-white p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{attempt.quizTitle}</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {attempt.courseTitle} · {attempt.attemptDate}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-black">
                      {attempt.score}/{attempt.totalQuestions}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-600">
                    {attempt.diagnosis.preparationLevel}
                    {attempt.diagnosis.weakTopics.length
                      ? ` · Weak: ${attempt.diagnosis.weakTopics.join(', ')}`
                      : ' · No weak topics'}
                  </p>
                </div>
              ))}
              {!selectedAttempts.length && (
                <Empty text="No student quiz attempts yet. When students practice, scores appear here." />
              )}
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
              <Field
                label="Four digit code"
                value={courseDraft.code}
                onChange={(value) => setCourseDraft((prev) => ({ ...prev, code: normalizeCourseCode(value) }))}
                placeholder="Auto if blank"
                maxLength={4}
              />
              <TextArea label="Description" value={courseDraft.description} onChange={(value) => setCourseDraft((prev) => ({ ...prev, description: value }))} />
              <button className="btn-primary" type="submit"><Plus className="h-4 w-4" /> Create course</button>
              {courseStatus && (
                <pre className="whitespace-pre-wrap border border-zinc-200 bg-stone-50 px-3 py-2 text-[11px] text-zinc-700">
                  {courseStatus}
                </pre>
              )}
            </form>
          </Panel>
          <Panel className="p-5">
            <p className="label">Course registry</p>
            <div className="mt-4 grid gap-3">
              {teacherCourses.map((course) => (
                <CourseRow
                  key={course.id}
                  course={course}
                  active={course.id === selectedCourseId}
                  onClick={() => setSelectedCourseId(course.id)}
                  actionLabel="Delete"
                  onAction={() => {
                    props.setCourses((prev) => prev.filter((item) => item.id !== course.id));
                    props.setMaterials((prev) => prev.filter((m) => m.courseId !== course.id));
                    props.setQuizzes((prev) => prev.filter((q) => q.courseId !== course.id));
                  }}
                />
              ))}
              {!teacherCourses.length && <Empty text="No courses yet. Create one and share the 4-digit code." />}
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
                        {material.chunks?.length ? ` · ${material.chunks.length} chunks` : ''}
                        {material.pageCount ? ` · ${material.pageCount} pages` : ''}
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
                    <button
                      className="btn-primary text-xs"
                      type="button"
                      disabled={summarizingId === material.id}
                      onClick={() => void summarizeMaterialWithModel(material)}
                    >
                      <Bot className="h-3 w-3" />
                      {summarizingId === material.id ? 'Summarizing...' : 'Summarize with Model'}
                    </button>
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
              <Select
                label="Difficulty"
                value={quizDraft.difficulty === 'medium' ? 'moderate' : quizDraft.difficulty}
                onChange={(value) =>
                  setQuizDraft((prev) => ({
                    ...prev,
                    difficulty: value as Quiz['difficulty'],
                  }))
                }
                options={[
                  { label: 'easy', value: 'easy' },
                  { label: 'moderate', value: 'moderate' },
                  { label: 'hard', value: 'hard' },
                ]}
              />
              <Select label="Question type" value={quizDraft.type} onChange={(value) => setQuizDraft((prev) => ({ ...prev, type: value as Quiz['questionType'] }))} options={['MCQ', 'Short', 'True/False', 'Mixed'].map((value) => ({ label: value, value }))} />
              <Select label="Mode" value={quizDraft.mode} onChange={(value) => setQuizDraft((prev) => ({ ...prev, mode: value }))} options={[{ label: 'Practice quiz', value: 'practice' }, { label: 'Official test', value: 'official' }]} />
              <div className="flex flex-wrap gap-2">
                {(['OFFLINE', 'ONLINE', 'HYBRID'] as AIMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`nav-btn ${aiMode === mode ? 'nav-btn-active' : ''}`}
                    onClick={() => setAiMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <button className="btn-primary" onClick={() => void generateQuiz()} type="button" disabled={generatingQuiz}>
                <Bot className="h-4 w-4" />
                {generatingQuiz ? 'Generating with AI...' : 'Generate draft quiz from document'}
              </button>
              <p className="text-[11px] text-zinc-500">
                Questions are generated by the selected AI mode from real document chunks — not templates.
              </p>
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
            <div className="flex flex-wrap items-end gap-3">
              <CourseSelect courses={teacherCourses} value={selectedCourse?.id || ''} onChange={setSelectedCourseId} />
            </div>
            <p className="label mt-4">Enrollment</p>
            <div className="mt-3 space-y-2">
              {enrolledIds.length === 0 && (
                <Empty text="No students enrolled yet. Share the 4-digit course code." />
              )}
              {enrolledIds.map((studentId) => {
                const studentAttempts = selectedAttempts.filter((a) => a.studentId === studentId);
                const latest = studentAttempts[0];
                const avg =
                  studentAttempts.length > 0
                    ? Math.round(
                        (studentAttempts.reduce(
                          (sum, a) => sum + (a.totalQuestions ? a.score / a.totalQuestions : 0),
                          0,
                        ) /
                          studentAttempts.length) *
                          100,
                      )
                    : null;
                return (
                  <div key={studentId} className="border border-zinc-200 bg-white p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="font-mono">{studentId}</strong>
                      <span className="text-zinc-500">{studentAttempts.length} attempt(s)</span>
                    </div>
                    <p className="mt-1 text-zinc-600">
                      {latest
                        ? `Latest: ${latest.quizTitle} · ${latest.score}/${latest.totalQuestions} · ${latest.diagnosis.preparationLevel}`
                        : 'No quiz attempts yet'}
                      {avg !== null ? ` · Avg ${avg}%` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="label mt-5">Weak topic distribution</p>
            <div className="mt-4 space-y-3">
              {Array.from(new Set(weakTopics)).map((topic) => {
                const count = weakTopics.filter((item) => item === topic).length;
                return <Bar key={topic} label={topic} value={count} max={Math.max(1, weakTopics.length)} />;
              })}
              {!weakTopics.length && <Empty text="No weak topics yet. Attempts will populate this chart." />}
            </div>
          </Panel>
          <Panel className="p-5">
            <p className="label">Quiz attempts (selected course)</p>
            <div className="mt-4 max-h-[280px] overflow-auto space-y-2">
              {selectedAttempts.map((attempt) => (
                <div key={attempt.id} className="border border-zinc-200 bg-white p-3 text-xs">
                  <div className="flex justify-between gap-2">
                    <strong>{attempt.quizTitle}</strong>
                    <span className="font-mono font-black">
                      {attempt.score}/{attempt.totalQuestions}
                    </span>
                  </div>
                  <p className="mt-1 text-zinc-600">
                    Student {attempt.studentId} · {attempt.attemptDate}
                    {attempt.isTestMode ? ' · Official test' : ' · Practice'}
                  </p>
                  {attempt.diagnosis.weakTopics.length > 0 && (
                    <p className="mt-1 text-amber-800">Weak: {attempt.diagnosis.weakTopics.join(', ')}</p>
                  )}
                </div>
              ))}
              {!selectedAttempts.length && (
                <Empty text="No attempts for this course yet." />
              )}
            </div>
            <p className="label mt-5">Activity log</p>
            <div className="mt-4 max-h-[220px] overflow-auto space-y-2">
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
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState<string | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<string | null>(null);
  const [localModels, setLocalModels] = useState<LocalGgufModel[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadDetail, setDownloadDetail] = useState<string | null>(null);
  const [hfUrlDraft, setHfUrlDraft] = useState(model.hfUrl || HF_GEMMA_PRESETS[0]?.hfUrl || '');
  const [hfTokenDraft, setHfTokenDraft] = useState(model.hfToken || '');
  const [manualPathDraft, setManualPathDraft] = useState('');
  const manualFileInput = useRef<HTMLInputElement>(null);

  const refreshInstalled = async () => {
    if (!isDesktopRuntime()) {
      setLocalModels([]);
      return { ok: false as const, message: 'Desktop app required for offline Hugging Face models.' };
    }
    try {
      const models = await listLocalGgufModels();
      setLocalModels(models);
      return {
        ok: true as const,
        message:
          models.length > 0
            ? `Found ${models.length} local GGUF model(s) on this computer.`
            : 'No local models yet. Paste a Hugging Face link and download one.',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setLocalModels([]);
      return { ok: false as const, message: msg };
    }
  };

  useEffect(() => {
    void refreshInstalled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isInstalled = (filename: string) =>
    localModels.some((m) => m.name === filename || m.path.endsWith(filename));

  const handleTestOnline = async () => {
    setTestingOnline(true);
    setOnlineStatus('Testing OpenRouter online models (primary → backup → free Gemma failover)...');
    await saveAISettings(aiSettings);
    const result = await testOpenRouterConnection(
      aiSettings.openRouterApiKey,
      aiSettings.openRouterBaseUrl,
      aiSettings.openRouterModelId,
      aiSettings.openRouterBackupModelId,
      aiSettings.openRouterTertiaryModelId,
    );
    setOnlineStatus(result.message);
    setTestingOnline(false);
  };

  const handleTestGoogle = async () => {
    setTestingGoogle(true);
    setGoogleStatus('Testing Google AI Studio free Gemma path...');
    await saveAISettings(aiSettings);
    const result = await testGoogleAiConnection(
      aiSettings.googleAiApiKey,
      aiSettings.googleAiModelId,
    );
    setGoogleStatus(result.message);
    setTestingGoogle(false);
  };

  const handleTestOffline = async () => {
    setTestingOffline(true);
    setOfflineStatus('Starting local offline runtime (no Ollama)...');
    if (!isDesktopRuntime()) {
      setOfflineStatus('Offline Hugging Face mode works in the desktop installer / LetsDoIT.exe only.');
      setTestingOffline(false);
      return;
    }
    if (!model.localPath) {
      setOfflineStatus('No local model path selected.\nDownload a GGUF from Hugging Face first, then test again.');
      setModel((prev) => ({ ...prev, connected: false }));
      setTestingOffline(false);
      return;
    }
    const result = await testOfflineHfModel(model.localPath);
    setOfflineStatus(result.message);
    if (result.ok) {
      setModel((prev) => ({
        ...prev,
        provider: 'huggingface',
        connected: true,
        downloadStatus: 'downloaded',
        downloadProgress: 100,
        endpoint: 'http://127.0.0.1:3928',
        lastChecked: nowStamp(),
      }));
      await refreshInstalled();
    } else {
      setModel((prev) => ({ ...prev, connected: false }));
    }
    setTestingOffline(false);
  };

  const handleSelectInstalled = async (item: LocalGgufModel) => {
    setModel((prev) => ({
      ...prev,
      provider: 'huggingface',
      modelName: item.name,
      localPath: item.path,
      downloadStatus: 'downloaded',
      downloadProgress: 100,
      connected: false,
      endpoint: 'http://127.0.0.1:3928',
      lastChecked: nowStamp(),
    }));
    setOfflineStatus(`Selected local model:\n${item.name}\n${item.path}\n\nStarting and testing it now...`);
    setTestingOffline(true);
    const result = await testOfflineHfModel(item.path);
    setOfflineStatus(result.message);
    setModel((prev) => ({
      ...prev,
      modelName: item.name,
      localPath: item.path,
      connected: result.ok,
      lastChecked: nowStamp(),
    }));
    setTestingOffline(false);
  };

  const runHfDownload = async (urlOrRepo: string, filename?: string, label?: string) => {
    if (downloadingId) return;
    if (!isDesktopRuntime()) {
      setOfflineStatus('Install / open the desktop app to download Hugging Face models onto this PC.');
      return;
    }
    const id = label || filename || urlOrRepo;
    setDownloadingId(id);
    setDownloadDetail(`Resolving ${urlOrRepo}...`);
    setModel((prev) => ({
      ...prev,
      provider: 'huggingface',
      hfUrl: urlOrRepo,
      hfToken: hfTokenDraft,
      modelName: filename || prev.modelName,
      downloadStatus: 'downloading',
      downloadProgress: 0,
      connected: false,
    }));

    const result = await downloadHfModel({
      urlOrRepo,
      filename,
      hfToken: hfTokenDraft,
      onProgress: (progress) => {
        setDownloadDetail(
          `${progress.status}${progress.detail ? ` · ${progress.detail}` : ''}${
            progress.totalBytes
              ? ` · ${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.totalBytes)}`
              : ''
          }`,
        );
        setModel((prev) => ({
          ...prev,
          downloadStatus: 'downloading',
          downloadProgress: progress.percent,
        }));
      },
    });

    if (result.ok && result.path) {
      setModel((prev) => ({
        ...prev,
        provider: 'huggingface',
        modelName: result.name || filename || prev.modelName,
        localPath: result.path,
        hfUrl: urlOrRepo,
        hfToken: hfTokenDraft,
        downloadStatus: 'downloaded',
        downloadProgress: 100,
        connected: false,
        endpoint: 'http://127.0.0.1:3928',
        lastChecked: nowStamp(),
      }));
      setDownloadDetail(result.message);
      setOfflineStatus(`${result.message}\n\nInstalling the local engine and connecting automatically...`);
      await refreshInstalled();
      const connection = await testOfflineHfModel(result.path);
      setModel((prev) => ({
        ...prev,
        modelName: result.name || filename || prev.modelName,
        localPath: result.path || prev.localPath,
        connected: connection.ok,
        downloadStatus: 'downloaded',
        downloadProgress: 100,
        lastChecked: nowStamp(),
      }));
      setOfflineStatus(
        connection.ok
          ? `${result.message}\n\nAuto-connected successfully. Offline chat is ready.`
          : `${result.message}\n\nThe file is installed, but automatic connection failed:\n${connection.message}`,
      );
    } else {
      setModel((prev) => ({
        ...prev,
        downloadStatus: prev.localPath ? 'downloaded' : 'not_downloaded',
        downloadProgress: prev.localPath ? 100 : 0,
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
            <p className="label mb-2">1. Online Mode — OpenRouter Gemma (+ free failover)</p>
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
                label="General free router (used on 429 / provider error)"
                value={aiSettings.openRouterTertiaryModelId || DEFAULT_AI_SETTINGS.openRouterTertiaryModelId}
                onChange={(val) => setAiSettings((prev) => ({ ...prev, openRouterTertiaryModelId: val }))}
                placeholder="openrouter/free"
              />
              <Field
                label="Base URL"
                value={aiSettings.openRouterBaseUrl}
                onChange={(val) => setAiSettings((prev) => ({ ...prev, openRouterBaseUrl: val }))}
                placeholder="https://openrouter.ai/api/v1"
              />
              <p className="text-[11px] text-zinc-500">
                Endpoint: <span className="font-mono">{(aiSettings.openRouterBaseUrl || DEFAULT_AI_SETTINGS.openRouterBaseUrl).replace(/\/$/, '')}/chat/completions</span>
                . On HTTP 429 / “Provider returned error”, the app retries with backoff, shows the full raw error body, then fails over across free Gemma models.
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
                <pre className={`max-h-64 overflow-auto whitespace-pre-wrap border border-zinc-200 bg-stone-50 px-3 py-2 text-[11px] ${statusColor(onlineStatus)}`}>
                  {onlineStatus}
                </pre>
              )}
            </div>
          </div>

          {/* Google AI Studio free alternative */}
          <div className="mt-5 border-t border-zinc-200 pt-4">
            <p className="label mb-2">1b. Free alternate online provider — Google AI Studio (Gemma)</p>
            <div className="grid gap-2">
              <p className="text-[11px] text-zinc-500">
                When OpenRouter free models are rate-limited, ONLINE/HYBRID automatically tries this free Google AI Studio path.
                Create a key at <span className="font-mono">https://aistudio.google.com/apikey</span>
              </p>
              <Field
                label="Google AI Studio API Key"
                value={aiSettings.googleAiApiKey || ''}
                onChange={(val) => setAiSettings((prev) => ({ ...prev, googleAiApiKey: val }))}
                placeholder="AIza..."
              />
              <Field
                label="Google model ID"
                value={aiSettings.googleAiModelId || DEFAULT_AI_SETTINGS.googleAiModelId}
                onChange={(val) => setAiSettings((prev) => ({ ...prev, googleAiModelId: val }))}
                placeholder="gemma-3-27b-it"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="btn-primary text-xs"
                  onClick={handleTestGoogle}
                  disabled={testingGoogle || !aiSettings.googleAiApiKey?.trim()}
                >
                  <RefreshCw className={`h-3 w-3 ${testingGoogle ? 'animate-spin' : ''}`} />
                  {testingGoogle ? 'Testing...' : 'Test Google AI'}
                </button>
              </div>
              {googleStatus && (
                <pre className={`max-h-64 overflow-auto whitespace-pre-wrap border border-zinc-200 bg-stone-50 px-3 py-2 text-[11px] ${statusColor(googleStatus)}`}>
                  {googleStatus}
                </pre>
              )}
            </div>
          </div>

          {/* Offline — Hugging Face direct download (no Ollama) */}
          <div className="mt-5 border-t border-zinc-200 pt-4">
            <p className="label mb-2">2. Offline Mode — Hugging Face model on this PC</p>
            <div className="grid gap-3">
              <div className="border border-emerald-200 bg-emerald-50 px-3 py-3 text-[11px] leading-5 text-emerald-950">
                <p className="font-bold">No Ollama install required</p>
                <p className="mt-1">
                  Paste a Hugging Face GGUF model link → download it to your computer → LetsDoIT connects it automatically → chat fully offline.
                  LetsDoIT stores the file under your app data folder and starts a local engine automatically.
                </p>
                <p className="mt-2">
                  <strong>Manual install:</strong> if download fails, download a .gguf in your browser, then Import GGUF below
                  or paste the full path and click Register path. Use “Open models folder” to verify files on disk.
                </p>
              </div>

              {!isDesktopRuntime() && (
                <div className="border border-amber-300 bg-amber-50 px-3 py-3 text-[11px] leading-5 text-amber-950">
                  <p className="font-bold">Desktop app required for offline models</p>
                  <p className="mt-1">
                    Use the Windows installer (LetsDoIT_0.1.0_x64-setup.exe) or MSI under{' '}
                    <span className="font-mono">src-tauri/target/release/bundle/</span> so models can be downloaded or imported onto disk.
                  </p>
                </div>
              )}

              <Field
                label="Hugging Face model link or repo"
                value={hfUrlDraft}
                onChange={setHfUrlDraft}
                placeholder="https://huggingface.co/bartowski/gemma-2-2b-it-GGUF"
              />
              <Field
                label="Hugging Face token (optional — only for gated models)"
                value={hfTokenDraft}
                onChange={setHfTokenDraft}
                placeholder="hf_... (leave empty for public GGUF repos)"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-primary text-xs"
                  disabled={Boolean(downloadingId) || !hfUrlDraft.trim()}
                  onClick={() => void runHfDownload(hfUrlDraft.trim())}
                >
                  <Download className="h-3 w-3" />
                  {downloadingId === hfUrlDraft.trim() ? 'Downloading...' : 'Download from Hugging Face'}
                </button>
                <button
                  className="btn-ghost text-xs"
                  type="button"
                  disabled={!isDesktopRuntime()}
                  onClick={async () => {
                    try {
                      const path = await openModelsFolder();
                      setOfflineStatus(`Opened models folder:\n${path}`);
                    } catch (error) {
                      setOfflineStatus(error instanceof Error ? error.message : String(error));
                    }
                  }}
                >
                  Open models folder
                </button>
              </div>

              <div className="border border-zinc-200 bg-stone-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Manual GGUF import</p>
                <p className="mt-1 text-[11px] text-zinc-600">
                  Download e.g. <span className="font-mono">gemma-2-2b-it-Q4_K_M.gguf</span> from Hugging Face in your browser,
                  then import the file here (works when in-app download fails).
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    ref={manualFileInput}
                    type="file"
                    accept=".gguf"
                    className="input text-xs"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      // Browser File has no path in web; desktop WebView may expose path via webkitRelative or name only.
                      // Prefer path draft: user can also paste absolute path.
                      const maybePath = (file as File & { path?: string }).path;
                      if (maybePath) {
                        setManualPathDraft(maybePath);
                        setTestingOffline(true);
                        const result = await importLocalGguf(maybePath);
                        setOfflineStatus(result.message);
                        if (result.ok && result.path) {
                          setModel((prev) => ({
                            ...prev,
                            provider: 'huggingface',
                            modelName: result.name || file.name,
                            localPath: result.path,
                            downloadStatus: 'downloaded',
                            downloadProgress: 100,
                            connected: false,
                            endpoint: 'http://127.0.0.1:3928',
                          }));
                          await refreshInstalled();
                          const connection = await testOfflineHfModel(result.path);
                          setModel((prev) => ({
                            ...prev,
                            connected: connection.ok,
                            lastChecked: nowStamp(),
                          }));
                          setOfflineStatus(
                            connection.ok
                              ? `${result.message}\n\nAuto-connected. Offline chat is ready.`
                              : `${result.message}\n\nImport OK, connection failed:\n${connection.message}`,
                          );
                        }
                        setTestingOffline(false);
                      } else {
                        setOfflineStatus(
                          `Selected file: ${file.name}\n\n` +
                            `This environment did not expose the full disk path.\n` +
                            `Paste the absolute path to the .gguf below and click Register / Import.`,
                        );
                        setManualPathDraft(file.name);
                      }
                      event.target.value = '';
                    }}
                  />
                </div>
                <Field
                  label="Absolute path to .gguf on this PC"
                  value={manualPathDraft}
                  onChange={setManualPathDraft}
                  placeholder="D:\\models\\gemma-2-2b-it-Q4_K_M.gguf"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="btn-primary text-xs"
                    type="button"
                    disabled={!isDesktopRuntime() || !manualPathDraft.trim() || testingOffline}
                    onClick={async () => {
                      setTestingOffline(true);
                      const result = await importLocalGguf(manualPathDraft.trim());
                      setOfflineStatus(result.message);
                      if (result.ok && result.path) {
                        setModel((prev) => ({
                          ...prev,
                          provider: 'huggingface',
                          modelName: result.name || prev.modelName,
                          localPath: result.path,
                          downloadStatus: 'downloaded',
                          downloadProgress: 100,
                          connected: false,
                          endpoint: 'http://127.0.0.1:3928',
                        }));
                        await refreshInstalled();
                        setOfflineStatus(`${result.message}\n\nConnecting offline runtime...`);
                        const connection = await testOfflineHfModel(result.path);
                        setModel((prev) => ({
                          ...prev,
                          modelName: result.name || prev.modelName,
                          localPath: result.path || prev.localPath,
                          connected: connection.ok,
                          lastChecked: nowStamp(),
                        }));
                        setOfflineStatus(
                          connection.ok
                            ? `${result.message}\n\nAuto-connected. Offline chat is ready.`
                            : `${result.message}\n\nImport OK, but connection failed:\n${connection.message}`,
                        );
                      }
                      setTestingOffline(false);
                    }}
                  >
                    Import into app folder
                  </button>
                  <button
                    className="btn-ghost text-xs"
                    type="button"
                    disabled={!isDesktopRuntime() || !manualPathDraft.trim() || testingOffline}
                    onClick={async () => {
                      setTestingOffline(true);
                      const result = await registerExternalGguf(manualPathDraft.trim());
                      setOfflineStatus(result.message);
                      if (result.ok && result.path) {
                        setModel((prev) => ({
                          ...prev,
                          provider: 'huggingface',
                          modelName: result.name || prev.modelName,
                          localPath: result.path,
                          downloadStatus: 'downloaded',
                          downloadProgress: 100,
                          connected: false,
                          endpoint: 'http://127.0.0.1:3928',
                        }));
                        setOfflineStatus(`${result.message}\n\nConnecting offline runtime...`);
                        const connection = await testOfflineHfModel(result.path);
                        setModel((prev) => ({
                          ...prev,
                          modelName: result.name || prev.modelName,
                          localPath: result.path || prev.localPath,
                          connected: connection.ok,
                          lastChecked: nowStamp(),
                        }));
                        setOfflineStatus(
                          connection.ok
                            ? `${result.message}\n\nAuto-connected. Offline chat is ready.`
                            : `${result.message}\n\nPath registered, but connection failed:\n${connection.message}`,
                        );
                      }
                      setTestingOffline(false);
                    }}
                  >
                    Register path (no copy)
                  </button>
                </div>
              </div>

              {downloadingId && (
                <div>
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

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Quick presets (public GGUF)</p>
                <div className="grid gap-2">
                  {HF_GEMMA_PRESETS.map((item) => {
                    const installed = isInstalled(item.filename);
                    const selected = model.modelName === item.filename || model.localPath?.endsWith(item.filename);
                    const downloading = downloadingId === item.id || downloadingId === item.filename;
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-wrap items-center justify-between gap-3 border p-3 ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-200 bg-white'}`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-black">{item.label}</p>
                            <span className="font-mono text-[10px] text-zinc-500">{item.filename}</span>
                            {installed && <span className="tag text-[10px]">On disk</span>}
                            {selected && model.connected && <span className="tag text-[10px]">Connected</span>}
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-600">{item.description} · {item.sizeHint}</p>
                          <a
                            className="mt-1 inline-block font-mono text-[10px] text-blue-700 underline"
                            href={item.hfUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.hfUrl}
                          </a>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {installed ? (
                            <button
                              className="btn-ghost text-xs"
                              onClick={() => {
                                const found = localModels.find((m) => m.name === item.filename);
                                if (found) void handleSelectInstalled(found);
                                else {
                                  setHfUrlDraft(item.hfUrl);
                                  void runHfDownload(item.repo, item.filename, item.id);
                                }
                              }}
                            >
                              {selected && model.connected ? 'Connected' : 'Use'}
                            </button>
                          ) : (
                            <button
                              className="btn-primary text-xs"
                              disabled={Boolean(downloadingId)}
                              onClick={() => {
                                setHfUrlDraft(item.hfUrl);
                                void runHfDownload(item.repo, item.filename, item.id);
                              }}
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

              {localModels.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Downloaded on this computer</p>
                  <div className="grid gap-1">
                    {localModels.map((item) => (
                      <button
                        key={item.path}
                        className={`flex items-center justify-between border px-3 py-2 text-left text-[11px] ${
                          model.localPath === item.path ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-200 hover:bg-zinc-50'
                        }`}
                        onClick={() => void handleSelectInstalled(item)}
                      >
                        <span className="font-mono font-bold">{item.name}</span>
                        <span className="text-zinc-500">{item.sizeLabel}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {model.localPath && (
                <p className="break-all font-mono text-[10px] text-zinc-500">Selected file: {model.localPath}</p>
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
                  Refresh local files
                </button>
                {model.connected && (
                  <button
                    className="btn-ghost text-xs text-red-600"
                    onClick={() => {
                      void stopOfflineRuntime();
                      setModel((prev) => ({ ...prev, connected: false }));
                      setOfflineStatus('Disconnected offline runtime.');
                    }}
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
              <strong>HYBRID mode</strong> tries Online (OpenRouter) first, then falls back to your downloaded Hugging Face GGUF on this PC.
              Internet is only needed to download the model once — after that, offline chat stays local.
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
            <Select label="Difficulty" value={quiz.difficulty === 'medium' ? 'moderate' : quiz.difficulty} onChange={(v) => setQuiz((p) => ({ ...p, difficulty: v as Quiz['difficulty'] }))} options={['easy', 'moderate', 'hard'].map((d) => ({ label: d, value: d }))} />
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
