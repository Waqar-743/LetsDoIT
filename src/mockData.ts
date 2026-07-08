/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Course, CourseMaterial, Quiz, QuizAttempt, StudentProfile, SystemLog } from './types';

export const INITIAL_COURSES: Course[] = [
  {
    id: 'c1',
    code: '1024',
    title: 'CS-402: Mobile Computing & Gemma AI',
    description: 'A hybrid hands-on course covering mobile app development, client-side neural networks, and optimizing Gemma models on lightweight devices.',
    subject: 'Computer Science',
    semester: '6th Semester',
    status: 'active',
    teacherName: 'Prof. Dr. Tariq Shah',
    teacherId: 't1',
    enrolledCount: 42,
  },
  {
    id: 'c2',
    code: '4096',
    title: 'CS-411: Natural Language Processing',
    description: 'Deep dive into language modeling, transformer architectures, Urdu-English machine translation, and low-latency offline inference.',
    subject: 'Data Science',
    semester: '6th Semester',
    status: 'active',
    teacherName: 'Assoc. Prof. Sarah Khan',
    teacherId: 't2',
    enrolledCount: 35,
  },
  {
    id: 'c3',
    code: '2048',
    title: 'CS-305: Introduction to Machine Learning',
    description: 'Foundations of supervised and unsupervised learning, linear classifiers, decision trees, and regression with educational use-cases.',
    subject: 'Artificial Intelligence',
    semester: '5th Semester',
    status: 'active',
    teacherName: 'Dr. Asim Jamil',
    teacherId: 't3',
    enrolledCount: 28,
  },
];

export const INITIAL_MATERIALS: CourseMaterial[] = [
  {
    id: 'm1',
    courseId: 'c1',
    title: 'Lecture 1: Introduction to Mobile Edge AI',
    type: 'slides',
    fileName: 'Lec1_Mobile_Edge_AI.pdf',
    uploadDate: '2026-06-15',
    fileSize: '4.8 MB',
    contentSummary: 'Covers edge device hardware constraints, memory quantization, client-side model running, and how Gemma 2B fits into mobile cache architecture.',
  },
  {
    id: 'm2',
    courseId: 'c1',
    title: 'Lab Manual: Compiling Gemma with llama.cpp',
    type: 'pdf',
    fileName: 'Lab_Gemma_Inference_Android.pdf',
    uploadDate: '2026-06-18',
    fileSize: '2.3 MB',
    contentSummary: 'Step-by-step setup guide to run Gemma-2B quantized models locally on entry-level Android devices using Termux and custom build scripts.',
  },
  {
    id: 'm3',
    courseId: 'c2',
    title: 'Handout: Bilingual Urdu-English Tokenization',
    type: 'notes',
    fileName: 'Urdu_Tokenization_Handout.md',
    uploadDate: '2026-06-22',
    fileSize: '450 KB',
    contentSummary: 'A detailed reference file explaining subword tokenizers, vocabulary expansion, handling cursive Nasta`liq text, and translation performance ratios.',
  },
  {
    id: 'm4',
    courseId: 'c2',
    title: 'Lecture 4: Transformer Attention Mechanisms',
    type: 'slides',
    fileName: 'Lec4_Attention_Mechanisms.pdf',
    uploadDate: '2026-06-28',
    fileSize: '6.1 MB',
    contentSummary: 'Visual breakdown of Scaled Dot-Product Attention, Multi-Head queries, keys, values, and positional encoding logic.',
  },
  {
    id: 'm5',
    courseId: 'c3',
    title: 'Syllabus: AI Ethics & Linear Regression',
    type: 'notes',
    fileName: 'Syllabus_ML_Intro.md',
    uploadDate: '2026-06-10',
    fileSize: '120 KB',
    contentSummary: 'Core syllabus outlines, assessment metrics, regression gradient descent math, and bias-variance tradeoff paradigms.',
  },
];

export const INITIAL_QUIZZES: Quiz[] = [
  {
    id: 'q1',
    courseId: 'c1',
    title: 'Practice: Edge AI Hardware Constraints',
    sourceMaterialId: 'm1',
    difficulty: 'easy',
    questionType: 'MCQ',
    timeLimit: 10,
    isTestMode: false,
    isPublished: true,
    questions: [
      {
        id: 'q1_1',
        text: 'Which quantization format is commonly used to fit a 2B parameter Gemma model on standard mobile devices with under 4GB RAM?',
        options: ['FP32 (32-bit single precision)', 'FP16 (16-bit half precision)', 'INT4 (4-bit integer quantization)', 'INT32 (32-bit integer)'],
        correctAnswer: 'INT4 (4-bit integer quantization)',
        explanation: 'INT4 quantization compresses model weights to 4-bits, reducing memory footprints dramatically while keeping reasoning capabilities intact.',
        topicTag: 'Quantization',
      },
      {
        id: 'q1_2',
        text: 'True or False: Gemma can perform lightweight local inference on mobile browsers using WebGPU.',
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: 'WebGPU allows browser-based hardware acceleration enabling local, offline model executions without complex client installations.',
        topicTag: 'Inference Architectures',
      },
      {
        id: 'q1_3',
        text: 'What is the primary benefit of Offline Mode AI in Pakistani rural classroom settings?',
        options: ['Higher power consumption', 'In-browser ads', 'Zero internet reliance', 'Infinite database sync'],
        correctAnswer: 'Zero internet reliance',
        explanation: 'Offline mode lets students query Gemma without load-shedding or network interruptions, running models entirely locally.',
        topicTag: 'Offline Learning',
      },
    ],
  },
  {
    id: 'q2',
    courseId: 'c2',
    title: 'Review: Tokenization & Urdu Text Processing',
    sourceMaterialId: 'm3',
    difficulty: 'medium',
    questionType: 'Mixed',
    timeLimit: 15,
    isTestMode: false,
    isPublished: true,
    questions: [
      {
        id: 'q2_1',
        text: 'Explain why Nasta`liq text tokenization poses challenges compared to standard Latin tokenization.',
        correctAnswer: 'Cursive writing structure and character blending',
        explanation: 'Urdu (written in Nasta`liq) has highly cursive characters where shapes change depending on position, making basic character-level segmentation difficult.',
        topicTag: 'Urdu NLP',
      },
      {
        id: 'q2_2',
        text: 'Which of the following is commonly used for subword tokenization in modern LLMs?',
        options: ['Word2Vec', 'Byte-Pair Encoding (BPE)', 'One-hot encoding', 'Bag of Words'],
        correctAnswer: 'Byte-Pair Encoding (BPE)',
        explanation: 'BPE builds a vocabulary of common character sequences, allowing the model to represent both full words and subword roots.',
        topicTag: 'Subwords',
      },
    ],
  },
  {
    id: 'q3',
    courseId: 'c1',
    title: 'Official Exam: Mobile Gemma Diagnostics',
    sourceMaterialId: 'm2',
    difficulty: 'hard',
    questionType: 'MCQ',
    timeLimit: 20,
    isTestMode: true,
    isPublished: true,
    dueDate: '2026-07-15',
    questions: [
      {
        id: 'q3_1',
        text: 'In low-latency local execution, which factor primarily limits the tokens-per-second generation rate of a 2B parameter model on low-end CPUs?',
        options: ['Disk write speeds', 'Memory bandwidth', 'GPU core counts', 'Display refresh rate'],
        correctAnswer: 'Memory bandwidth',
        explanation: 'Offline LLM generation is highly memory-bound because weights must be loaded from RAM to CPU caches for every single generated token.',
        topicTag: 'Hardware Bottlenecks',
      },
      {
        id: 'q3_2',
        text: 'How does Gemma 2B handle multi-turn conversations?',
        options: ['By storing every turn in separate neural files', 'By appending conversation history to the prompt context', 'By retraining the model on the fly', 'By deleting previous turns'],
        correctAnswer: 'By appending conversation history to the prompt context',
        explanation: 'Gemma relies on appending the chat transcript (formatted with role tags) within its context window to maintain multi-turn memory.',
        topicTag: 'Context Management',
      },
    ],
  },
];

export const INITIAL_STUDENT_PROFILE: StudentProfile = {
  id: 's1',
  name: 'Awan Ahmed',
  email: 'f25607259@nutech.edu.pk',
  department: 'Computer Science',
  semester: '6th Semester',
  academicDetails: 'Active scholar, specializing in Edge Computing and AI systems. GPA: 3.82',
  joinedCourseIds: ['c1', 'c2'],
  preparationLevel: 'Good Preparation',
  avatar: 'AA',
};

export const INITIAL_ATTEMPTS: QuizAttempt[] = [
  {
    id: 'att1',
    studentId: 's1',
    quizId: 'q1',
    quizTitle: 'Practice: Edge AI Hardware Constraints',
    courseId: 'c1',
    courseTitle: 'CS-402: Mobile Computing & Gemma AI',
    score: 2,
    totalQuestions: 3,
    attemptDate: '2026-07-02 14:30',
    isTestMode: false,
    answers: {
      'q1_1': 'INT4 (4-bit integer quantization)',
      'q1_2': 'False', // wrong answer (it's True)
      'q1_3': 'Zero internet reliance',
    },
    diagnosis: {
      mistakes: [
        {
          questionId: 'q1_2',
          questionText: 'True or False: Gemma can perform lightweight local inference on mobile browsers using WebGPU.',
          studentAnswer: 'False',
          correctAnswer: 'True',
          mistakeType: 'Conceptual gap',
          explanation: 'You didn`t realize that WebGPU allows native browser hardware acceleration, making browser-based Gemma inference fully functional.',
        }
      ],
      weakTopics: ['Inference Architectures'],
      suggestedPractice: 'Review browser hardware accelerated APIs (WebGPU/WebNN) and complete the Lab 1 exercises.',
      preparationLevel: 'Good Preparation',
    }
  },
  {
    id: 'att2',
    studentId: 's1',
    quizId: 'q2',
    quizTitle: 'Review: Tokenization & Urdu Text Processing',
    courseId: 'c2',
    courseTitle: 'CS-411: Natural Language Processing',
    score: 1,
    totalQuestions: 2,
    attemptDate: '2026-07-05 10:15',
    isTestMode: false,
    answers: {
      'q2_1': 'It is hard', // low detail answer
      'q2_2': 'Byte-Pair Encoding (BPE)',
    },
    diagnosis: {
      mistakes: [
        {
          questionId: 'q2_1',
          questionText: 'Explain why Nasta`liq text tokenization poses challenges compared to standard Latin tokenization.',
          studentAnswer: 'It is hard',
          correctAnswer: 'Cursive writing structure and character blending',
          mistakeType: 'Partial understanding',
          explanation: 'Your answer is overly generic. The actual challenge is character shaping transitions and lack of space delimiters in cursive script.',
        }
      ],
      weakTopics: ['Urdu NLP'],
      suggestedPractice: 'Read the Urdu tokenization handouts and trace cursive joiner behaviors.',
      preparationLevel: 'Average Preparation',
    }
  },
];

export const INITIAL_SYSTEM_LOGS: SystemLog[] = [
  {
    id: 'l1',
    timestamp: '2026-07-08 08:30:12',
    event: 'Model Boot',
    details: 'Local Gemma 2B model loaded into browser cache (Offline Mode ready).',
    role: 'SYSTEM',
  },
  {
    id: 'l2',
    timestamp: '2026-07-08 08:35:45',
    event: 'Course Created',
    details: 'CS-402: Mobile Computing & Gemma AI updated with new syllabus.',
    role: 'TEACHER',
  },
  {
    id: 'l3',
    timestamp: '2026-07-08 08:42:19',
    event: 'Material Uploaded',
    details: 'Dr. Tariq Shah uploaded "Lab_Gemma_Inference_Android.pdf" to CS-402.',
    role: 'TEACHER',
  },
  {
    id: 'l4',
    timestamp: '2026-07-08 08:55:00',
    event: 'Quiz Generated',
    details: 'AI Assistant generated easy MCQ practice questions from Lab Manual.',
    role: 'SYSTEM',
  },
];
