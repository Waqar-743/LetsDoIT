/**
 * Fresh-install defaults for LetsDoIT Classroom.
 * No demo courses, materials, or quizzes — real classroom data is created by users.
 */

import {
  Course,
  CourseMaterial,
  PracticeSet,
  Quiz,
  QuizAttempt,
  StudentProfile,
  SystemLog,
  TeacherProfile,
} from './types';

/** Empty registry — teachers create real courses with 4-digit codes. */
export const INITIAL_COURSES: Course[] = [];

/** Empty — materials appear after PDF/notes upload + chunking. */
export const INITIAL_MATERIALS: CourseMaterial[] = [];

/** Empty — quizzes come from real AI generation on document chunks only. */
export const INITIAL_QUIZZES: Quiz[] = [];

export const INITIAL_STUDENT_PROFILE: StudentProfile = {
  id: 's1',
  name: '',
  email: '',
  department: '',
  semester: '',
  academicDetails: '',
  joinedCourseIds: [],
  preparationLevel: 'Needs Practice',
  avatar: 'ST',
};

export const INITIAL_TEACHER_PROFILE: TeacherProfile = {
  id: 't1',
  name: '',
  email: '',
  isApproved: true,
  department: '',
};

export const INITIAL_ATTEMPTS: QuizAttempt[] = [];

export const INITIAL_SYSTEM_LOGS: SystemLog[] = [
  {
    id: 'l_boot',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    event: 'App ready',
    details:
      'LetsDoIT Classroom started with an empty registry. Create a course, upload materials, and configure Online/Offline AI under Model.',
    role: 'SYSTEM',
  },
];

export const INITIAL_PRACTICE_SETS: PracticeSet[] = [];
