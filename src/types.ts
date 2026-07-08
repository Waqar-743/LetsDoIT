/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AIMode = 'OFFLINE' | 'ONLINE' | 'HYBRID';

export type UserRole = 'STUDENT' | 'TEACHER' | null;

export type PreparationLevel = 
  | 'Needs Practice' 
  | 'Average Preparation' 
  | 'Good Preparation' 
  | 'Excellent Preparation' 
  | 'Outstanding Preparation';

export type MistakeType = 
  | 'Conceptual gap' 
  | 'Careless mistake' 
  | 'Misread question' 
  | 'Partial understanding';

export type FileType = 'pdf' | 'notes' | 'slides' | 'image';

export interface Course {
  id: string;
  code: string; // 4-digit code
  title: string;
  description: string;
  subject: string;
  semester: string;
  status: 'active' | 'inactive';
  teacherName: string;
  teacherId: string;
  enrolledCount: number;
}

export interface CourseMaterial {
  id: string;
  courseId: string;
  title: string;
  type: FileType;
  fileName: string;
  uploadDate: string;
  fileSize: string;
  contentSummary: string;
  topic?: string;
  contentText?: string;
  lessonMap?: LessonMapItem[];
  contentHash?: string;
}

export interface LessonMapItem {
  concept: string;
  summary: string;
  sourceRef: string;
}

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  sourceMaterialId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'MCQ' | 'Short' | 'True/False' | 'Mixed';
  timeLimit: number; // in minutes
  isTestMode: boolean; // True = Official Test, False = Practice Quiz
  isPublished: boolean;
  dueDate?: string;
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  text: string;
  options?: string[]; // for MCQs and True/False
  correctAnswer: string;
  explanation: string;
  topicTag: string;
  sourceRef?: string;
}

export interface QuizAttempt {
  id: string;
  studentId: string;
  quizId: string;
  quizTitle: string;
  courseId: string;
  courseTitle: string;
  score: number;
  totalQuestions: number;
  attemptDate: string;
  isTestMode: boolean;
  answers: { [questionId: string]: string };
  diagnosis: {
    mistakes: {
      questionId: string;
      questionText: string;
      studentAnswer: string;
      correctAnswer: string;
      mistakeType: MistakeType;
      explanation: string;
    }[];
    weakTopics: string[];
    suggestedPractice: string;
    preparationLevel: PreparationLevel;
  };
}

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  department: string;
  semester: string;
  academicDetails: string;
  joinedCourseIds: string[];
  preparationLevel: PreparationLevel;
  avatar: string;
}

export interface TeacherProfile {
  id: string;
  name: string;
  email: string;
  isApproved: boolean;
  department: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  modeUsed?: AIMode;
  quizRefId?: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  event: string;
  details: string;
  role: 'STUDENT' | 'TEACHER' | 'SYSTEM';
}

export interface LocalModelState {
  provider: 'ollama' | 'llama.cpp' | 'mistral.rs';
  modelName: string;
  downloadStatus: 'not_downloaded' | 'downloading' | 'downloaded';
  downloadProgress: number;
  connected: boolean;
  endpoint: string;
  lastChecked?: string;
}

export interface AIProviderResult {
  text: string;
  modeUsed: AIMode;
  providerName: string;
  fromCache: boolean;
}
