import { invoke } from '@tauri-apps/api/core';
import { AIProviderResult, Course, CourseMaterial, LocalModelState, PracticeSet, Quiz, QuizAttempt, StudentProfile, SystemLog, TeacherProfile } from '../types';

export interface DesktopEnvironment {
  app_data_dir: string;
  model_dir: string;
  model_state_file: string;
  runtime: string;
}

export const isDesktopRuntime = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ─── Model State ────────────────────────────────────────────────────────────────

export const loadDesktopModelState = async (): Promise<LocalModelState | null> => {
  if (!isDesktopRuntime()) return null;
  try {
    return await invoke<LocalModelState | null>('load_model_state');
  } catch {
    return null;
  }
};

export const saveDesktopModelState = async (state: LocalModelState): Promise<void> => {
  if (!isDesktopRuntime()) return;
  await invoke('save_model_state', { state });
};

// ─── AI Cache ──────────────────────────────────────────────────────────────────

export const loadAICache = async (): Promise<Record<string, AIProviderResult> | null> => {
  if (!isDesktopRuntime()) return null;
  try {
    return await invoke<Record<string, AIProviderResult> | null>('load_ai_cache');
  } catch {
    return null;
  }
};

export const saveAICache = async (cache: Record<string, AIProviderResult>): Promise<void> => {
  if (!isDesktopRuntime()) return;
  await invoke('save_ai_cache', { cache });
};

// ─── Courses ───────────────────────────────────────────────────────────────────

export const loadCourses = async (): Promise<Course[] | null> => {
  if (!isDesktopRuntime()) return null;
  try {
    const data = await invoke<Course[] | null>('load_courses');
    return data;
  } catch {
    return null;
  }
};

export const saveCourses = async (courses: Course[]): Promise<void> => {
  if (!isDesktopRuntime()) return;
  await invoke('save_courses', { courses });
};

// ─── Materials ────────────────────────────────────────────────────────────────

export const loadMaterials = async (): Promise<CourseMaterial[] | null> => {
  if (!isDesktopRuntime()) return null;
  try {
    return await invoke<CourseMaterial[] | null>('load_materials');
  } catch {
    return null;
  }
};

export const saveMaterials = async (materials: CourseMaterial[]): Promise<void> => {
  if (!isDesktopRuntime()) return;
  await invoke('save_materials', { materials });
};

// ─── Quizzes ──────────────────────────────────────────────────────────────────

export const loadQuizzes = async (): Promise<Quiz[] | null> => {
  if (!isDesktopRuntime()) return null;
  try {
    return await invoke<Quiz[] | null>('load_quizzes');
  } catch {
    return null;
  }
};

export const saveQuizzes = async (quizzes: Quiz[]): Promise<void> => {
  if (!isDesktopRuntime()) return;
  await invoke('save_quizzes', { quizzes });
};

// ─── Attempts ─────────────────────────────────────────────────────────────────

export const loadAttempts = async (): Promise<QuizAttempt[] | null> => {
  if (!isDesktopRuntime()) return null;
  try {
    return await invoke<QuizAttempt[] | null>('load_attempts');
  } catch {
    return null;
  }
};

export const saveAttempts = async (attempts: QuizAttempt[]): Promise<void> => {
  if (!isDesktopRuntime()) return;
  await invoke('save_attempts', { attempts });
};

// ─── Practice Sets ─────────────────────────────────────────────────────────────

export const loadPracticeSets = async (): Promise<PracticeSet[] | null> => {
  if (!isDesktopRuntime()) return null;
  try {
    return await invoke<PracticeSet[] | null>('load_practice_sets');
  } catch {
    return null;
  }
};

export const savePracticeSets = async (practiceSets: PracticeSet[]): Promise<void> => {
  if (!isDesktopRuntime()) return;
  await invoke('save_practice_sets', { practiceSets });
};

// ─── Student Profile ───────────────────────────────────────────────────────────

export const loadStudentProfile = async (): Promise<StudentProfile | null> => {
  if (!isDesktopRuntime()) return null;
  try {
    return await invoke<StudentProfile | null>('load_student');
  } catch {
    return null;
  }
};

export const saveStudentProfile = async (student: StudentProfile): Promise<void> => {
  if (!isDesktopRuntime()) return;
  await invoke('save_student', { student });
};

// ─── Teacher Profile ───────────────────────────────────────────────────────────

export const loadTeacherProfile = async (): Promise<TeacherProfile | null> => {
  if (!isDesktopRuntime()) return null;
  try {
    return await invoke<TeacherProfile | null>('load_teacher');
  } catch {
    return null;
  }
};

export const saveTeacherProfile = async (teacher: TeacherProfile): Promise<void> => {
  if (!isDesktopRuntime()) return;
  await invoke('save_teacher', { teacher });
};

// ─── System Logs ───────────────────────────────────────────────────────────────

export const loadSystemLogs = async (): Promise<SystemLog[] | null> => {
  if (!isDesktopRuntime()) return null;
  try {
    return await invoke<SystemLog[] | null>('load_system_logs');
  } catch {
    return null;
  }
};

export const saveSystemLogs = async (logs: SystemLog[]): Promise<void> => {
  if (!isDesktopRuntime()) return;
  await invoke('save_system_logs', { logs });
};

// ─── Desktop Environment ───────────────────────────────────────────────────────

export const getDesktopEnvironment = async (): Promise<DesktopEnvironment | null> => {
  if (!isDesktopRuntime()) return null;
  try {
    return await invoke<DesktopEnvironment>('desktop_environment');
  } catch {
    return null;
  }
};
