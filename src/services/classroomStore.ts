/**
 * Shared classroom persistence for teacher ↔ student on the same machine.
 * Writes to localStorage (always) and Tauri app-data JSON files (desktop).
 * Students poll / listen for storage events so new materials appear live.
 */

import type {
  Course,
  CourseMaterial,
  PracticeSet,
  Quiz,
  QuizAttempt,
  StudentProfile,
  SystemLog,
  TeacherProfile,
} from '../types';
import {
  isDesktopRuntime,
  loadAttempts,
  loadCourses,
  loadMaterials,
  loadPracticeSets,
  loadQuizzes,
  loadStudentProfile,
  loadSystemLogs,
  loadTeacherProfile,
  saveAttempts,
  saveCourses,
  saveMaterials,
  savePracticeSets,
  saveQuizzes,
  saveStudentProfile,
  saveSystemLogs,
  saveTeacherProfile,
} from './desktop';

export const STORE_KEYS = {
  // v4: cleared demo seed data; real classroom-only persistence
  courses: 'letsdoit_courses_v4',
  materials: 'letsdoit_materials_v4',
  quizzes: 'letsdoit_quizzes_v4',
  attempts: 'letsdoit_attempts_v4',
  practice: 'letsdoit_practice_v4',
  logs: 'letsdoit_logs_v4',
  student: 'letsdoit_student_v4',
  teacher: 'letsdoit_teacher_v4',
  role: 'letsdoit_role_v4',
  /** Monotonic revision so students/teachers detect shared writes */
  revision: 'letsdoit_classroom_revision_v4',
} as const;

export type ClassroomSnapshot = {
  courses: Course[];
  materials: CourseMaterial[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  practiceSets: PracticeSet[];
  logs: SystemLog[];
  student: StudentProfile | null;
  teacher: TeacherProfile | null;
  revision: number;
};

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: unknown): boolean {
  try {
    const next = JSON.stringify(value);
    const prev = localStorage.getItem(key);
    if (prev === next) return false;
    localStorage.setItem(key, next);
    return true;
  } catch {
    return false;
  }
}

/** Stable stringify compare for avoiding feedback loops on poll → setState → persist. */
export function stableEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function getRevision(): number {
  try {
    return Number(localStorage.getItem(STORE_KEYS.revision) || '0') || 0;
  } catch {
    return 0;
  }
}

export function bumpRevision(): number {
  const next = getRevision() + 1;
  try {
    localStorage.setItem(STORE_KEYS.revision, String(next));
    // Broadcast to other tabs / same origin
    window.dispatchEvent(
      new CustomEvent('letsdoit-classroom-updated', { detail: { revision: next } }),
    );
  } catch {
    // ignore
  }
  return next;
}

/**
 * Load shared classroom data. Desktop disk wins when present; else localStorage.
 */
export async function loadClassroomSnapshot(defaults: {
  courses: Course[];
  materials: CourseMaterial[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  practiceSets: PracticeSet[];
  logs: SystemLog[];
  student: StudentProfile;
  teacher: TeacherProfile;
}): Promise<ClassroomSnapshot> {
  let courses = readLocal<Course[]>(STORE_KEYS.courses);
  let materials = readLocal<CourseMaterial[]>(STORE_KEYS.materials);
  let quizzes = readLocal<Quiz[]>(STORE_KEYS.quizzes);
  let attempts = readLocal<QuizAttempt[]>(STORE_KEYS.attempts);
  let practiceSets = readLocal<PracticeSet[]>(STORE_KEYS.practice);
  let logs = readLocal<SystemLog[]>(STORE_KEYS.logs);
  let student = readLocal<StudentProfile>(STORE_KEYS.student);
  let teacher = readLocal<TeacherProfile>(STORE_KEYS.teacher);

  if (isDesktopRuntime()) {
    try {
      const [
        dCourses,
        dMaterials,
        dQuizzes,
        dAttempts,
        dPractice,
        dLogs,
        dStudent,
        dTeacher,
      ] = await Promise.all([
        loadCourses(),
        loadMaterials(),
        loadQuizzes(),
        loadAttempts(),
        loadPracticeSets(),
        loadSystemLogs(),
        loadStudentProfile(),
        loadTeacherProfile(),
      ]);
      if (dCourses?.length) courses = dCourses;
      if (dMaterials) materials = dMaterials;
      if (dQuizzes) quizzes = dQuizzes;
      if (dAttempts) attempts = dAttempts;
      if (dPractice) practiceSets = dPractice;
      if (dLogs) logs = dLogs;
      if (dStudent) student = dStudent;
      if (dTeacher) teacher = dTeacher;
    } catch {
      // keep localStorage values
    }
  }

  return {
    courses: courses ?? defaults.courses,
    materials: materials ?? defaults.materials,
    quizzes: quizzes ?? defaults.quizzes,
    attempts: attempts ?? defaults.attempts,
    practiceSets: practiceSets ?? defaults.practiceSets,
    logs: logs ?? defaults.logs,
    student: student ?? defaults.student,
    teacher: teacher ?? defaults.teacher,
    revision: getRevision(),
  };
}

/** Persist a slice; only bump revision when content actually changed. */
export async function persistCourses(courses: Course[]): Promise<void> {
  const changed = writeLocal(STORE_KEYS.courses, courses);
  if (changed) {
    bumpRevision();
    try {
      await saveCourses(courses);
    } catch {
      // offline / browser
    }
  }
}

export async function persistMaterials(materials: CourseMaterial[]): Promise<void> {
  const changed = writeLocal(STORE_KEYS.materials, materials);
  if (changed) {
    bumpRevision();
    try {
      await saveMaterials(materials);
    } catch {
      // ignore
    }
  }
}

export async function persistQuizzes(quizzes: Quiz[]): Promise<void> {
  const changed = writeLocal(STORE_KEYS.quizzes, quizzes);
  if (changed) {
    bumpRevision();
    try {
      await saveQuizzes(quizzes);
    } catch {
      // ignore
    }
  }
}

export async function persistAttempts(attempts: QuizAttempt[]): Promise<void> {
  const changed = writeLocal(STORE_KEYS.attempts, attempts);
  if (changed) {
    bumpRevision();
    try {
      await saveAttempts(attempts);
    } catch {
      // ignore
    }
  }
}

export async function persistPracticeSets(practiceSets: PracticeSet[]): Promise<void> {
  const changed = writeLocal(STORE_KEYS.practice, practiceSets);
  if (changed) {
    try {
      await savePracticeSets(practiceSets);
    } catch {
      // ignore
    }
  }
}

export async function persistLogs(logs: SystemLog[]): Promise<void> {
  const changed = writeLocal(STORE_KEYS.logs, logs);
  if (changed) {
    try {
      await saveSystemLogs(logs);
    } catch {
      // ignore
    }
  }
}

export async function persistStudent(student: StudentProfile): Promise<void> {
  const changed = writeLocal(STORE_KEYS.student, student);
  if (changed) {
    bumpRevision();
    try {
      await saveStudentProfile(student);
    } catch {
      // ignore
    }
  }
}

export async function persistTeacher(teacher: TeacherProfile): Promise<void> {
  const changed = writeLocal(STORE_KEYS.teacher, teacher);
  if (changed) {
    try {
      await saveTeacherProfile(teacher);
    } catch {
      // ignore
    }
  }
}

/**
 * Soft reload shared slices from disk/localStorage without full remount.
 * Used by polling so teacher uploads and student quiz attempts stay in sync.
 */
export async function reloadSharedClassroom(): Promise<{
  courses: Course[] | null;
  materials: CourseMaterial[] | null;
  quizzes: Quiz[] | null;
  attempts: QuizAttempt[] | null;
  practiceSets: PracticeSet[] | null;
  logs: SystemLog[] | null;
  revision: number;
}> {
  let courses = readLocal<Course[]>(STORE_KEYS.courses);
  let materials = readLocal<CourseMaterial[]>(STORE_KEYS.materials);
  let quizzes = readLocal<Quiz[]>(STORE_KEYS.quizzes);
  let attempts = readLocal<QuizAttempt[]>(STORE_KEYS.attempts);
  let practiceSets = readLocal<PracticeSet[]>(STORE_KEYS.practice);
  let logs = readLocal<SystemLog[]>(STORE_KEYS.logs);

  if (isDesktopRuntime()) {
    try {
      const [dCourses, dMaterials, dQuizzes, dAttempts, dPractice, dLogs] = await Promise.all([
        loadCourses(),
        loadMaterials(),
        loadQuizzes(),
        loadAttempts(),
        loadPracticeSets(),
        loadSystemLogs(),
      ]);
      if (dCourses) courses = dCourses;
      if (dMaterials) materials = dMaterials;
      if (dQuizzes) quizzes = dQuizzes;
      if (dAttempts) attempts = dAttempts;
      if (dPractice) practiceSets = dPractice;
      if (dLogs) logs = dLogs;
    } catch {
      // keep local
    }
  }

  return {
    courses,
    materials,
    quizzes,
    attempts,
    practiceSets,
    logs,
    revision: getRevision(),
  };
}
