/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AIMode = 'OFFLINE' | 'ONLINE' | 'HYBRID';

export type LanguageStyle = 'en' | 'urdu-en';

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
  enrolledStudentIds: string[];
}

/** One RAG-style chunk of extracted course document text. */
export interface DocumentChunk {
  id: string;
  index: number;
  text: string;
  /** e.g. "Page 3" or "Section 1" */
  sourceRef: string;
  charCount: number;
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
  /** Extracted document chunks for grounded AI summary / quiz generation */
  chunks?: DocumentChunk[];
  importantPoints?: string[];
  studyHelp?: string;
  lessonMap?: LessonMapItem[];
  contentHash?: string;
  aiProcessed?: boolean;
  extractWarning?: string;
  pageCount?: number;
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
  difficulty: 'easy' | 'medium' | 'moderate' | 'hard';
  questionType: 'MCQ' | 'Short' | 'True/False' | 'Mixed';
  timeLimit: number; // in minutes
  isTestMode: boolean; // True = Official Test, False = Practice Quiz
  isPublished: boolean;
  isDraft?: boolean; // True = teacher is reviewing/editing, not yet published
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
  languageStyle?: LanguageStyle;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  event: string;
  details: string;
  role: 'STUDENT' | 'TEACHER' | 'SYSTEM';
}

export interface LocalModelState {
  /** Offline engine: Hugging Face GGUF on disk + managed local runtime */
  provider: 'huggingface' | 'llama.cpp';
  /** Display name / GGUF filename stem */
  modelName: string;
  /** Full Hugging Face page or resolve URL the user pasted */
  hfUrl?: string;
  /** Absolute path to downloaded .gguf on this machine */
  localPath?: string;
  /** Optional Hugging Face access token (gated models like official Gemma) */
  hfToken?: string;
  downloadStatus: 'not_downloaded' | 'downloading' | 'downloaded';
  downloadProgress: number;
  connected: boolean;
  /** Local OpenAI-compatible endpoint started by the app (not Ollama) */
  endpoint: string;
  lastChecked?: string;
}

export interface AIProviderResult {
  text: string;
  modeUsed: AIMode;
  providerName: string;
  fromCache: boolean;
}

export interface PracticeSet {
  id: string;
  studentId: string;
  courseId: string;
  courseTitle: string;
  basedOnAttemptId: string;
  generatedAt: string;
  focusTopics: string[];
  difficulty: 'easy' | 'medium' | 'moderate' | 'hard';
  targetMistakeTypes: MistakeType[];
  description: string;
  questions: PracticeQuestion[];
  completed: boolean;
  completedAt?: string;
}

export interface PracticeQuestion {
  id: string;
  text: string;
  hint: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  topicTag: string;
  mistakeType: MistakeType;
}
