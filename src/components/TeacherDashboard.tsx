/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Plus, MessageSquare, Award, User, Settings, LogOut, CheckCircle, Trash, RefreshCw, 
  Upload, FileText, ChevronRight, Activity, Users, ShieldAlert, PlusCircle, Sparkles, BookMarked, Eye, Edit, Save, ArrowLeft, ToggleLeft, ToggleRight
} from 'lucide-react';
import { 
  TeacherProfile, Course, CourseMaterial, Quiz, QuizAttempt, AIMode, StudentProfile, SystemLog 
} from '../types';
import { 
  TeacherFlowChart, WeakTopicDiagnosis 
} from './VisualFlowCharts';

interface TeacherDashboardProps {
  profile: TeacherProfile;
  courses: Course[];
  materials: CourseMaterial[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  systemLogs: SystemLog[];
  onAddCourse: (course: Course) => void;
  onUpdateCourse: (course: Course) => void;
  onRemoveCourse: (courseId: string) => void;
  onAddMaterial: (material: CourseMaterial) => void;
  onRemoveMaterial: (materialId: string) => void;
  onAddQuiz: (quiz: Quiz) => void;
  onUpdateQuiz: (quiz: Quiz) => void;
  onRemoveQuiz: (quizId: string) => void;
  onRemoveStudent: (courseId: string, studentId: string) => void;
  onAddSystemLog: (log: SystemLog) => void;
  onLogout: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  profile,
  courses,
  materials,
  quizzes,
  attempts,
  systemLogs,
  onAddCourse,
  onUpdateCourse,
  onRemoveCourse,
  onAddMaterial,
  onRemoveMaterial,
  onAddQuiz,
  onUpdateQuiz,
  onRemoveQuiz,
  onRemoveStudent,
  onAddSystemLog,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'ai' | 'analytics' | 'logs'>('overview');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  
  // Create Course form state
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [courseSubj, setCourseSubj] = useState('');
  const [courseSem, setCourseSem] = useState('6th Semester');
  const [courseCode, setCourseCode] = useState('');

  // Upload Material state
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialType, setMaterialType] = useState<'pdf' | 'notes' | 'slides' | 'image'>('pdf');
  const [materialSummary, setMaterialSummary] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  // AI Quiz Generator states
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [quizTitle, setQuizTitle] = useState('');
  const [sourceMatId, setSourceMatId] = useState('');
  const [quizDiff, setQuizDiff] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [quizType, setQuizType] = useState<'MCQ' | 'Short' | 'True/False' | 'Mixed'>('MCQ');
  const [timeLimit, setTimeLimit] = useState(15);
  const [isTestMode, setIsTestMode] = useState(false);
  const [dueDate, setDueDate] = useState('2026-07-20');
  
  // Edit generated quiz questions state
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [editingQuizIndex, setEditingQuizIndex] = useState<number | null>(null);

  // Teacher AI Assistant chat state
  const [aiMode, setAiMode] = useState<AIMode>('HYBRID');
  const [teacherChatMessages, setTeacherChatMessages] = useState<any[]>([]);
  const [teacherChatInput, setTeacherChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Monitor detailed student state
  const [selectedStudentForMonitor, setSelectedStudentForMonitor] = useState<any | null>(null);

  // Seed default course code when creating
  useEffect(() => {
    if (isCreatingCourse && !courseCode) {
      regenerateCourseCode();
    }
  }, [isCreatingCourse]);

  // Seed default teacher message
  useEffect(() => {
    if (teacherChatMessages.length === 0) {
      setTeacherChatMessages([
        {
          id: 't_ai_init',
          sender: 'ai',
          text: `Welcome, **${profile.name}**! I am your **Gemma AI Teaching Assistant Portal**.

I can synthesize learning assets directly from your uploaded syllabus files. Ask me to:
* **"Generate MCQ quizzes"** or **"Build answer keys"**
* **"Formulate lesson rubrics"** or **"Extract class-wide weak areas"**
* **"Draft bilingual Urdu-English explanations"** for student worksheets.

How can I assist your teaching planning today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    }
  }, []);

  const regenerateCourseCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setCourseCode(code);
  };

  const handleCreateCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle || !courseSubj || !courseCode) return;

    const newCourse: Course = {
      id: 'c_' + Date.now(),
      code: courseCode,
      title: courseTitle,
      description: courseDesc || 'No summary text provided.',
      subject: courseSubj,
      semester: courseSem,
      status: 'active',
      teacherName: profile.name,
      teacherId: profile.id,
      enrolledCount: 0,
      enrolledStudentIds: [],
    };

    onAddCourse(newCourse);
    
    // Add logging
    onAddSystemLog({
      id: 'l_' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      event: 'Course Created',
      details: `Instructor ${profile.name} created course ${courseTitle} (Code: ${courseCode})`,
      role: 'TEACHER',
    });

    setIsCreatingCourse(false);
    setCourseTitle('');
    setCourseDesc('');
    setCourseSubj('');
    regenerateCourseCode();
  };

  // Simulate material upload states
  const handleUploadMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !materialTitle) return;

    setUploadStatus('Processing and quantizing file inputs...');
    setTimeout(() => {
      setUploadStatus('Mapping syllabus concepts with local Gemma embeddings...');
      setTimeout(() => {
        const newMat: CourseMaterial = {
          id: 'm_' + Date.now(),
          courseId: selectedCourse.id,
          title: materialTitle,
          type: materialType,
          fileName: `File_${materialTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.${materialType === 'notes' ? 'md' : 'pdf'}`,
          uploadDate: new Date().toISOString().slice(0, 10),
          fileSize: `${(1.2 + Math.random() * 4).toFixed(1)} MB`,
          contentSummary: materialSummary || `Summarized content regarding ${materialTitle}. Automatically processed by local Gemma system integration.`,
        };

        onAddMaterial(newMat);
        
        onAddSystemLog({
          id: 'l_' + Date.now(),
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
          event: 'Material Uploaded',
          details: `Uploaded study material "${materialTitle}" into course: ${selectedCourse.title}`,
          role: 'TEACHER',
        });

        setUploadStatus('');
        setMaterialTitle('');
        setMaterialSummary('');
      }, 1000);
    }, 1000);
  };

  // Simulate Gemma Quiz Generation Workflow
  const handleTriggerQuizGeneration = () => {
    if (!sourceMatId) return;
    setIsGeneratingQuiz(true);
    setGenerationStep(1);

    setTimeout(() => {
      setGenerationStep(2); // Analyzing concept vectors
      setTimeout(() => {
        setGenerationStep(3); // Drafting MCQ formats
        setTimeout(() => {
          setGenerationStep(4); // Formulating Urdu translations and distractors
          
          // Generate mock question set based on selected difficulty
          const mockQuestions = [
            {
              id: 'q_g1',
              text: `What is the primary operational trade-off of running low-bit quantization (e.g. INT4) Gemma models?`,
              options: [
                'Decreased model file size and RAM requirement, with a slight decay in reasoning complexity',
                'Infinite model speedups with zero reasoning decay',
                'Requirements for liquid nitrogen cooling systems',
                'Conversion of English words into pure emojis'
              ],
              correctAnswer: 'Decreased model file size and RAM requirement, with a slight decay in reasoning complexity',
              explanation: 'INT4 maps heavy weights into 4-bit integers, conserving CPU caches dramatically while preserving most lexical intelligence.',
              topicTag: 'Quantization trade-offs'
            },
            {
              id: 'q_g2',
              text: `How does Offline Mode resolve the loss of sync between student progress maps and the teacher dashboard?`,
              options: [
                'By blocking students from attempting quizzes',
                'By writing progress logs locally to secure client storage, streaming hashes automatically when a network link reconnects',
                'By deleting students from courses dynamically',
                'By requiring paper-based receipts'
              ],
              correctAnswer: 'By writing progress logs locally to secure client storage, streaming hashes automatically when a network link reconnects',
              explanation: 'Client-side LocalStorage securely queues activity payloads, then synchronizes database states once the teacher-student hybrid network is online.',
              topicTag: 'Sync architectures'
            }
          ];

          setGeneratedQuestions(mockQuestions);
          setGenerationStep(5); // Ready for review!
        }, 1200);
      }, 1200);
    }, 1200);
  };

  // Complete Quiz creation, review and publish to database
  const handlePublishGeneratedQuiz = () => {
    if (!selectedCourse) return;

    const finalQuiz: Quiz = {
      id: 'quiz_' + Date.now(),
      courseId: selectedCourse.id,
      title: quizTitle || 'Syllabus Quiz: ' + (materials.find(m => m.id === sourceMatId)?.title || 'General Review'),
      sourceMaterialId: sourceMatId,
      difficulty: quizDiff,
      questionType: quizType,
      timeLimit,
      isTestMode,
      isPublished: true,
      dueDate,
      questions: generatedQuestions,
    };

    onAddQuiz(finalQuiz);

    onAddSystemLog({
      id: 'l_' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      event: 'Quiz Generated',
      details: `Generated and published ${isTestMode ? 'Official Test' : 'Practice Drill'} Quiz: "${finalQuiz.title}" for class: ${selectedCourse.title}`,
      role: 'TEACHER',
    });

    // Reset generator state
    setIsGeneratingQuiz(false);
    setGenerationStep(0);
    setQuizTitle('');
    setSourceMatId('');
    setGeneratedQuestions([]);
  };

  // Teacher Chat Submission
  const handleTeacherChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherChatInput.trim()) return;

    const text = teacherChatInput;
    setTeacherChatMessages(prev => [
      ...prev,
      { id: 't_user_' + Date.now(), sender: 'user', text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
    setTeacherChatInput('');
    setIsAiThinking(true);

    setTimeout(() => {
      let responseText = '';
      const query = text.toLowerCase();

      if (query.includes('rubric') || query.includes('grading')) {
        responseText = `### Gemma AI Lesson Rubric Builder

I have generated a standard **Four-Tier Assessment Rubric** for your syllabus unit:

| Criterion | Level 1: Needs Practice (40-60%) | Level 2: Good Prep (65-79%) | Level 3: Outstanding (80-100%) |
| :--- | :--- | :--- | :--- |
| **Quantization Theory** | Confuses 4-bit weights with half-precision floating points. | Understands cache optimization benefits but struggles with mathematical logic. | Accurately describes CPU-cache transfers and calculates exact memory bottlenecks. |
| **Bilingual Translation** | Unable to formulate dual-context Urdu-English explanations. | Maps vocabulary correctly but lacks colloquial conceptual pacing. | Flawlessly translates technical definitions into simple native dialects. |

#### Answer Key Suggestion
* **Key Item 1**: INT4 saves space.
* **Key Item 2**: BPE tokenizes recursively.`;
      } else if (query.includes('summary') || query.includes('lecture')) {
        responseText = `### Gemma AI Automated Course Outline Summary

Here is a summarized lesson outline generated from your active course documents:

**Unit 3: local Gemma Inference on Low-Resource Hardware**
1. **Introduction**: Overcoming Pakistan classroom connectivity limits.
2. **Technical Bounds**: Memory latency bandwidth is the core constraint on mobile CPUs (RAM to Cache bottle-necks).
3. **Optimizing Tokens**: Deploying customized subword tokenizer layers, expanding standard lexicons with Urdu joiners.
4. **Grading Integrity**: Switching quizzes into **Test Mode** blocks immediate AI query prompts for student devices.`;
      } else {
        responseText = `### Gemma AI Instructor Assistant Response

I have processed your lesson request regarding **"${text}"**.

* **Classroom Weak Area Detected**: 40% of students struggle to differentiate between *BPE (Byte-Pair Encoding)* subword vocabularies and standard character boundaries in cursive script.
* **Instructional Correction Suggestion**: Download the bilingual Urdu tokenization handout and request Gemma to run live trace examples during the next lab.
* **Quizzing Setup**: Ensure your upcoming exam is flagged with **isTestMode = True** to safeguard academic integrity inside the student terminal dashboards.`;
      }

      setTeacherChatMessages(prev => [
        ...prev,
        { id: 't_ai_resp_' + Date.now(), sender: 'ai', text: responseText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
      setIsAiThinking(false);
    }, 1100);
  };

  // Generate mock student monitoring roster
  const simulatedStudents = [
    {
      id: 's1',
      name: 'Awan Ahmed',
      email: 'f25607259@nutech.edu.pk',
      department: 'Computer Science',
      semester: '6th Semester',
      preparationLevel: 'Good Preparation',
      riskLevel: 'Secure',
      attemptsCount: 2,
      lastActive: '2026-07-08 08:12',
      weakTopics: ['Inference Architectures', 'Urdu NLP'],
    },
    {
      id: 's2',
      name: 'Zubair Bilal',
      email: 'z.bilal@nutech.edu.pk',
      department: 'Computer Science',
      semester: '6th Semester',
      preparationLevel: 'Needs Practice',
      riskLevel: 'High Risk (Falling Behind)',
      attemptsCount: 0,
      lastActive: '2026-07-01 10:45',
      weakTopics: ['Quantization', 'Transformer Attention'],
    },
    {
      id: 's3',
      name: 'Fatima Malik',
      email: 'f.malik@nutech.edu.pk',
      department: 'Computer Science',
      semester: '6th Semester',
      preparationLevel: 'Outstanding Preparation',
      riskLevel: 'Secure',
      attemptsCount: 3,
      lastActive: '2026-07-08 09:01',
      weakTopics: ['None - All Areas Clear'],
    }
  ];

  const classAttempts = attempts.filter(a => selectedCourse ? a.courseId === selectedCourse.id : true);

  return (
    <div className="min-h-screen bg-white text-black flex flex-col font-sans">
      
      {/* Header upper console */}
      <header className="sticky top-0 z-40 bg-white border-b border-black px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-black text-white flex items-center justify-center font-mono font-black text-sm">
            T
          </div>
          <div>
            <h1 className="font-sans font-black text-sm uppercase tracking-widest">LetsDOiT Instructor</h1>
            <p className="text-[9px] font-mono text-neutral-400">FACULTY MANAGEMENT PANEL</p>
          </div>
        </div>

        {/* Global stats block */}
        <div className="hidden lg:flex items-center gap-6 border-l border-neutral-200 pl-6 mr-auto ml-6 text-xs">
          <div className="text-left">
            <span className="text-[10px] font-mono text-neutral-400 block">AUTHENTICATED INSTRUCTOR</span>
            <span className="font-mono font-bold">{profile.name}</span>
          </div>
          <div className="text-left">
            <span className="text-[10px] font-mono text-neutral-400 block">CAMPUS DEPARTMENT</span>
            <span className="font-mono font-bold">{profile.department}</span>
          </div>
          <div className="text-left">
            <span className="text-[10px] font-mono text-neutral-400 block">CLASS SESSIONS RUNNING</span>
            <span className="font-mono font-bold">{courses.length} Active Workspaces</span>
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="flex items-center gap-1.5">
          <button
            id="tab-teacher-overview"
            onClick={() => { setActiveTab('overview'); setSelectedCourse(null); }}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-tight border cursor-pointer ${
              activeTab === 'overview' ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200 hover:border-black'
            }`}
          >
            Overview
          </button>
          <button
            id="tab-teacher-courses"
            onClick={() => { setActiveTab('courses'); setSelectedCourse(null); }}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-tight border cursor-pointer ${
              activeTab === 'courses' ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200 hover:border-black'
            }`}
          >
            Course Admin
          </button>
          <button
            id="tab-teacher-ai"
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-tight border cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ai' ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200 hover:border-black'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Instructor AI
          </button>
          <button
            id="tab-teacher-logs"
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-tight border cursor-pointer ${
              activeTab === 'logs' ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200 hover:border-black'
            }`}
          >
            System Logs
          </button>
          <button
            onClick={onLogout}
            title="Log out"
            className="p-1.5 text-neutral-400 hover:text-black hover:bg-neutral-100 border border-transparent rounded cursor-pointer ml-2"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        <AnimatePresence mode="wait">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              
              {/* Banner Board */}
              <div className="grid grid-cols-1 md:grid-cols-3 border border-black p-6 gap-6 bg-white">
                <div className="md:col-span-2 space-y-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 border border-black bg-neutral-50 uppercase font-black">
                    ADMINISTRATOR OVERVIEW CONSOLE
                  </span>
                  <h2 className="text-xl font-sans font-black uppercase">
                    Welcome Instructor, {profile.name}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Create virtual workspaces, manage course codes, and run Gemma generators to synthesize study drills. Track class diagnostic statistics to instantly identify high-risk students before the semester finals.
                  </p>
                </div>

                {/* Quick Add Course code trigger box */}
                <div className="border border-black p-4 bg-neutral-50 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-mono font-black uppercase mb-1">Virtual Course Management</h4>
                    <p className="text-[10px] text-neutral-400">Launch a new course registry with dynamic enrollment keys.</p>
                  </div>
                  <button
                    onClick={() => { setIsCreatingCourse(true); setActiveTab('courses'); }}
                    className="w-full bg-black text-white text-[10px] font-mono font-bold uppercase py-2 border border-black hover:bg-neutral-800 cursor-pointer flex items-center justify-center gap-1.5 mt-3"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Initialize New Course
                  </button>
                </div>
              </div>

              {/* Graphical Workflow visualization */}
              <div className="border border-neutral-200 p-6 bg-white">
                <TeacherFlowChart />
              </div>

              {/* Class Analytical Status Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                <div className="border border-neutral-200 p-4 bg-white flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-mono text-neutral-400 block uppercase">TOTAL REGISTERED STUDENTS</span>
                    <strong className="text-2xl font-mono">105 Students</strong>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-2">Active across 3 courses</p>
                </div>

                <div className="border border-neutral-200 p-4 bg-white flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-mono text-neutral-400 block uppercase">WEEKLY PRACTICE ATTEMPTS</span>
                    <strong className="text-2xl font-mono">24 Submissions</strong>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-2">Gemma-generated practice drills</p>
                </div>

                <div className="border border-neutral-200 p-4 bg-white flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-mono text-neutral-400 block uppercase">AGGREGATE CLASS PASS SCORE</span>
                    <strong className="text-2xl font-mono">74.2% Success</strong>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-2">Conceptual and MCQs combined</p>
                </div>

                <div className="border border-neutral-200 p-4 bg-white flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-mono text-neutral-400 block uppercase">STUDENT RISK ASSESSMENT</span>
                      <strong className="text-2xl font-mono">1 Student At Risk</strong>
                    </div>
                    <span className="p-1 border border-black rounded bg-neutral-100">
                      <ShieldAlert className="w-3.5 h-3.5 text-black" />
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-2">Zubair Bilal (0 attempts complete)</p>
                </div>

              </div>

              {/* Courses Grid List */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                  ACTIVE MANAGED WORKSPACES
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {courses.map(course => {
                    const courseMatCount = materials.filter(m => m.courseId === course.id).length;
                    const courseQuizCount = quizzes.filter(q => q.courseId === course.id).length;
                    return (
                      <div 
                        key={course.id}
                        className="border border-black p-4 bg-white flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-mono bg-neutral-100 border px-1.5 py-0.5 uppercase">
                              CODE: {course.code}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-400">
                              {course.semester}
                            </span>
                          </div>

                          <h4 className="font-sans font-bold text-xs uppercase tracking-tight mb-1">
                            {course.title}
                          </h4>
                          <p className="text-[11px] text-neutral-500 mb-4 line-clamp-2">
                            {course.description}
                          </p>

                          <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-mono bg-neutral-50 p-2 border mb-4">
                            <div>
                              <span className="text-neutral-400 block">MATERIALS</span>
                              <strong className="text-black">{courseMatCount} Files</strong>
                            </div>
                            <div>
                              <span className="text-neutral-400 block">QUIZZES</span>
                              <strong className="text-black">{courseQuizCount} Tests</strong>
                            </div>
                          </div>
                        </div>

                        <button
                          id={`manage-${course.id}`}
                          onClick={() => { setSelectedCourse(course); setActiveTab('courses'); }}
                          className="w-full text-center bg-black text-white hover:bg-neutral-800 py-1.5 text-xs font-mono font-bold uppercase border border-black cursor-pointer"
                        >
                          Manage Course Space
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

            </motion.div>
          )}

          {/* COURSE ADMIN & MANAGEMENT TAB */}
          {activeTab === 'courses' && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              
              {/* COURSE CREATION PANEL */}
              {isCreatingCourse && (
                <div className="max-w-xl mx-auto border border-black p-6 bg-white space-y-6">
                  <div className="flex items-center justify-between border-b pb-3 border-neutral-200">
                    <h3 className="text-sm font-sans font-black uppercase">Launch New Course Workspace</h3>
                    <button 
                      onClick={() => setIsCreatingCourse(false)}
                      className="text-xs font-mono uppercase underline hover:text-neutral-500 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleCreateCourseSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                        Course Code / Title
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none"
                        placeholder="e.g. CS-450: Deep Learning Architectures"
                        value={courseTitle}
                        onChange={(e) => setCourseTitle(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                        Primary Subject Domain
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none"
                        placeholder="e.g. Artificial Intelligence"
                        value={courseSubj}
                        onChange={(e) => setCourseSubj(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                          Class / target Semester
                        </label>
                        <select
                          className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none"
                          value={courseSem}
                          onChange={(e) => setCourseSem(e.target.value)}
                        >
                          <option>1st Semester</option>
                          <option>3rd Semester</option>
                          <option>5th Semester</option>
                          <option>6th Semester</option>
                          <option>8th Semester</option>
                          <option>Graduate MS AI</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                          Enrollment 4-digit code
                        </label>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            required
                            readOnly
                            maxLength={4}
                            className="w-20 border border-neutral-300 focus:border-black bg-neutral-50 px-3 py-2 text-xs font-mono text-center font-bold outline-none"
                            value={courseCode}
                          />
                          <button
                            type="button"
                            onClick={regenerateCourseCode}
                            className="p-2 border border-neutral-300 bg-white hover:border-black text-xs font-mono uppercase cursor-pointer flex items-center justify-center"
                            title="Regenerate dynamic code"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                        Course Summary Description
                      </label>
                      <textarea
                        rows={3}
                        className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none resize-none"
                        placeholder="Provide details about prerequisites, models, or lab setups..."
                        value={courseDesc}
                        onChange={(e) => setCourseDesc(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-black text-white hover:bg-neutral-800 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border border-black cursor-pointer"
                    >
                      Establish Course Workspace
                    </button>
                  </form>
                </div>
              )}

              {/* COURSE ADMIN GENERAL SELECTOR */}
              {!isCreatingCourse && !selectedCourse && (
                <div className="space-y-4">
                  <div className="border border-black p-6 bg-neutral-50 flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-sans font-black uppercase tracking-tight mb-1">Virtual classroom registries</h2>
                      <p className="text-xs text-neutral-500">
                        Add newly designed classes or click specific workspace details to manage uploaded materials and review student grades.
                      </p>
                    </div>

                    <button
                      id="launch-new-course-btn"
                      onClick={() => setIsCreatingCourse(true)}
                      className="bg-black text-white hover:bg-neutral-800 text-xs font-mono font-bold uppercase tracking-wide px-4 py-2 border border-black cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> New Course
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {courses.map(course => (
                      <div key={course.id} className="border border-black p-5 bg-white space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-mono text-neutral-400">Subject: {course.subject}</span>
                            <h3 className="font-sans font-bold text-sm uppercase text-black">{course.title}</h3>
                          </div>
                          <span className="text-lg font-mono font-black tracking-widest border border-black bg-neutral-50 px-2 py-0.5 rounded">
                            {course.code}
                          </span>
                        </div>

                        <div className="flex gap-4 border-y border-neutral-100 py-3 text-xs font-mono">
                          <div>
                            <span className="text-[9px] text-neutral-400 block">STUDENTS</span>
                            <strong>{course.enrolledCount} Active</strong>
                          </div>
                          <div>
                            <span className="text-[9px] text-neutral-400 block">SEMESTER</span>
                            <strong>{course.semester}</strong>
                          </div>
                          <div>
                            <span className="text-[9px] text-neutral-400 block">STATUS</span>
                            <span className="bg-black text-white text-[9px] px-1.5 py-0.5 uppercase rounded">{course.status}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            id={`admin-manage-ws-${course.id}`}
                            onClick={() => setSelectedCourse(course)}
                            className="flex-1 text-center bg-black text-white hover:bg-neutral-800 py-1.5 text-xs font-mono font-bold uppercase border border-black cursor-pointer"
                          >
                            Open Instructor Deck
                          </button>
                          
                          <button
                            onClick={() => {
                              if (window.confirm(`Permanently remove course "${course.title}"?`)) {
                                onRemoveCourse(course.id);
                              }
                            }}
                            className="p-1.5 border border-neutral-200 hover:border-black bg-white text-black hover:bg-neutral-50 rounded cursor-pointer"
                            title="Delete Course Registry"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* INSIDE WORKSPACE SPECIFIC CONSOLE */}
              {!isCreatingCourse && selectedCourse && (
                <div className="space-y-6">
                  
                  {/* Console Header bar */}
                  <div className="border border-black p-6 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <button 
                        onClick={() => setSelectedCourse(null)}
                        className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase text-neutral-400 hover:text-black mb-2 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Return to Course Admin
                      </button>
                      <h2 className="text-xl font-sans font-black uppercase tracking-tight">
                        Console: {selectedCourse.title}
                      </h2>
                      <p className="text-xs text-neutral-500">
                        Department: <strong>{selectedCourse.subject}</strong> | Code: <strong>{selectedCourse.code}</strong> | <strong>{selectedCourse.enrolledCount} Enrolled Students</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const code = Math.floor(1000 + Math.random() * 9000).toString();
                          onUpdateCourse({ ...selectedCourse, code });
                          setSelectedCourse({ ...selectedCourse, code });
                          alert(`Course access code changed to: ${code}`);
                        }}
                        className="bg-white text-black text-[10px] font-mono border border-black px-3 py-2 hover:bg-neutral-50 uppercase flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Change Code
                      </button>

                      <button
                        onClick={() => {
                          const status = selectedCourse.status === 'active' ? 'inactive' : 'active';
                          onUpdateCourse({ ...selectedCourse, status });
                          setSelectedCourse({ ...selectedCourse, status });
                        }}
                        className="bg-black text-white text-[10px] font-mono px-3 py-2 border border-black hover:bg-neutral-800 uppercase cursor-pointer"
                      >
                        Set {selectedCourse.status === 'active' ? 'Inactive' : 'Active'}
                      </button>
                    </div>
                  </div>

                  {/* Core Management Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Left: Materials upload & Removal panel (6/12 width) */}
                    <div className="lg:col-span-4 space-y-4">
                      <div className="border-b border-neutral-200 pb-2">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                          UPLOAD NEW SYLLABUS ASSETS
                        </h3>
                      </div>

                      {/* File upload simulator card */}
                      <form onSubmit={handleUploadMaterial} className="border border-black p-4 bg-white space-y-4">
                        {uploadStatus && (
                          <div className="p-3 border border-black bg-neutral-100 text-xs font-mono animate-pulse text-center">
                            {uploadStatus}
                          </div>
                        )}

                        <div>
                          <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                            Asset Document Title
                          </label>
                          <input
                            type="text"
                            required
                            className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none"
                            placeholder="e.g. Lecture 5: Recurrent Architectures"
                            value={materialTitle}
                            onChange={(e) => setMaterialTitle(e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                              Format Type
                            </label>
                            <select
                              className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none"
                              value={materialType}
                              onChange={(e: any) => setMaterialType(e.target.value)}
                            >
                              <option value="pdf">PDF File</option>
                              <option value="notes">Text Notes (MD)</option>
                              <option value="slides">Slides (PPTX)</option>
                              <option value="image">Diagram Image</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                              Week Tag (Optional)
                            </label>
                            <input
                              type="text"
                              className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none"
                              placeholder="e.g. Week 4"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                            Concept Outline Summary (for Gemma)
                          </label>
                          <textarea
                            rows={2}
                            className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none resize-none"
                            placeholder="Provide 1-2 sentences. Local Gemma will use this block to generate custom practice MCQs..."
                            value={materialSummary}
                            onChange={(e) => setMaterialSummary(e.target.value)}
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-black text-white hover:bg-neutral-800 py-2 text-xs font-mono font-bold uppercase border border-black flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" /> Sync and Upload Asset
                        </button>
                      </form>

                      {/* Uploaded assets quick remove deck */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono text-neutral-400 block uppercase">MANAGED COURSE SYLLABUS MATERIALS</span>
                        {materials.filter(m => m.courseId === selectedCourse.id).length === 0 ? (
                          <span className="text-xs text-neutral-400 italic">No assets uploaded.</span>
                        ) : (
                          materials
                            .filter(m => m.courseId === selectedCourse.id)
                            .map(m => (
                              <div key={m.id} className="text-xs border p-3 bg-white flex justify-between items-center">
                                <div>
                                  <h5 className="font-sans font-bold uppercase tracking-tight text-[11px]">{m.title}</h5>
                                  <span className="text-[9px] font-mono text-neutral-400 uppercase">{m.type} • {m.fileName}</span>
                                </div>

                                <button
                                  onClick={() => {
                                    if (window.confirm(`Remove study file "${m.title}"?`)) {
                                      onRemoveMaterial(m.id);
                                    }
                                  }}
                                  className="p-1 hover:bg-neutral-50 border border-transparent hover:border-neutral-200 rounded text-neutral-400 hover:text-black cursor-pointer"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                    {/* Middle: AI Quiz Generator Module (4/12 width) */}
                    <div className="lg:col-span-5 space-y-4 border-l border-neutral-200 pl-0 lg:pl-6">
                      <div className="border-b border-neutral-200 pb-2">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                          GEMMA AUTOMATED QUIZ GENERATION SUITE
                        </h3>
                      </div>

                      {isGeneratingQuiz ? (
                        // Generation step loader or review layout
                        <div className="border border-black p-4 bg-neutral-50/50 space-y-4">
                          
                          {generationStep < 5 ? (
                            // Gemma processing loop
                            <div className="text-center py-8 space-y-4">
                              <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
                              <h4 className="font-sans font-bold text-xs uppercase">Gemma Generating Syllabus Draft</h4>
                              
                              <div className="p-3 bg-white border text-left space-y-1 font-mono text-[9px] text-neutral-500 max-w-sm mx-auto">
                                <p className={generationStep >= 1 ? 'text-black font-bold' : ''}>[01] Segmenting source text elements... {generationStep >= 1 ? '✔' : '...'}</p>
                                <p className={generationStep >= 2 ? 'text-black font-bold' : ''}>[02] Synthesizing MCQ distractors... {generationStep >= 2 ? '✔' : '...'}</p>
                                <p className={generationStep >= 3 ? 'text-black font-bold' : ''}>[03] Constructing Urdu-English translation tags... {generationStep >= 3 ? '✔' : '...'}</p>
                                <p className={generationStep >= 4 ? 'text-black font-bold' : ''}>[04] Injecting logical mistake diagnostics... {generationStep >= 4 ? '✔' : '...'}</p>
                              </div>
                            </div>
                          ) : (
                            // Question Review / Edit Panel before publish
                            <div className="space-y-4">
                              <div className="border-b pb-2">
                                <span className="text-[9px] font-mono text-neutral-400 uppercase block">STEP 5: REVIEW GENERATED PATTERNS</span>
                                <h4 className="text-xs font-sans font-bold uppercase text-black">Preview Questions</h4>
                              </div>

                              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                                {generatedQuestions.map((q, idx) => (
                                  <div key={idx} className="p-3 border border-neutral-200 bg-white space-y-2 text-xs">
                                    <div className="flex justify-between font-mono text-[9px] text-neutral-400">
                                      <span>QUESTION 0{idx + 1}</span>
                                      <span>Tag: {q.topicTag}</span>
                                    </div>
                                    <input
                                      type="text"
                                      className="w-full font-sans font-bold border-b outline-none focus:border-black"
                                      value={q.text}
                                      onChange={(e) => {
                                        const updated = [...generatedQuestions];
                                        updated[idx].text = e.target.value;
                                        setGeneratedQuestions(updated);
                                      }}
                                    />

                                    <div className="space-y-1 pt-1 font-mono text-[9px]">
                                      <span className="text-neutral-400 block">OPTIONS (EDITABLE):</span>
                                      {q.options?.map((opt, oIdx) => (
                                        <input
                                          key={oIdx}
                                          type="text"
                                          className="w-full border-neutral-100 border px-1 outline-none text-neutral-600"
                                          value={opt}
                                          onChange={(e) => {
                                            const updated = [...generatedQuestions];
                                            updated[idx].options[oIdx] = e.target.value;
                                            setGeneratedQuestions(updated);
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handlePublishGeneratedQuiz}
                                  className="flex-1 bg-black text-white hover:bg-neutral-800 text-xs font-mono font-bold uppercase py-2 border border-black cursor-pointer"
                                >
                                  Publish Drill to Class
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setIsGeneratingQuiz(false); setGenerationStep(0); }}
                                  className="px-3 py-2 border text-xs font-mono uppercase hover:bg-neutral-50 cursor-pointer"
                                >
                                  Reset
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      ) : (
                        // Generator Input form
                        <div className="border border-black p-4 bg-white space-y-4">
                          <div>
                            <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                              Quiz Unit Title
                            </label>
                            <input
                              type="text"
                              className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none"
                              placeholder="e.g. MCQ Practice: Local Quantization models"
                              value={quizTitle}
                              onChange={(e) => setQuizTitle(e.target.value)}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                                Target Source Document
                              </label>
                              <select
                                required
                                className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none"
                                value={sourceMatId}
                                onChange={(e) => setSourceMatId(e.target.value)}
                              >
                                <option value="">— Select study file —</option>
                                {materials
                                  .filter(m => m.courseId === selectedCourse.id)
                                  .map(m => (
                                    <option key={m.id} value={m.id}>{m.title}</option>
                                  ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                                Syllabus Difficulty
                              </label>
                              <select
                                className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none"
                                value={quizDiff}
                                onChange={(e: any) => setQuizDiff(e.target.value)}
                              >
                                <option value="easy">Easy Drill</option>
                                <option value="medium">Medium Practice</option>
                                <option value="hard">Hard Exam</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                                Question Layout
                              </label>
                              <select
                                className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none"
                                value={quizType}
                                onChange={(e: any) => setQuizType(e.target.value)}
                              >
                                <option value="MCQ">MCQs Only</option>
                                <option value="Short">Short Concepts</option>
                                <option value="True/False">True/False</option>
                                <option value="Mixed">Mixed Formats</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                                Time Constraint (Mins)
                              </label>
                              <input
                                type="number"
                                className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none font-mono"
                                value={timeLimit}
                                onChange={(e) => setTimeLimit(Number(e.target.value))}
                              />
                            </div>
                          </div>

                          {/* Practice vs Test Mode toggle for Integrity checks */}
                          <div className="border p-3 bg-neutral-50 space-y-2 border-neutral-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-mono font-bold text-black uppercase block">ACADEMIC INTEGRITY PORTAL</span>
                                <span className="text-[9px] text-neutral-400 block">Practice Mode (AI open) vs Test Mode (AI suspended)</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsTestMode(!isTestMode)}
                                className="text-black hover:text-neutral-700 cursor-pointer"
                              >
                                {isTestMode ? (
                                  <ToggleRight className="w-8 h-8 text-black" />
                                ) : (
                                  <ToggleLeft className="w-8 h-8 text-neutral-400" />
                                )}
                              </button>
                            </div>
                            <span className="text-[9px] font-mono uppercase bg-black text-white px-1.5 py-0.5 rounded">
                              ACTIVE SETTING: {isTestMode ? '⚠️ TEST MODE (STUDENT AI LOCKED)' : '📝 PRACTICE MODE (STUDENT AI ENABLED)'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={handleTriggerQuizGeneration}
                            disabled={!sourceMatId}
                            className={`w-full text-xs font-mono font-bold uppercase py-2.5 border flex items-center justify-center gap-1.5 cursor-pointer ${
                              sourceMatId 
                                ? 'bg-black text-white border-black hover:bg-neutral-800' 
                                : 'bg-white text-neutral-300 border-neutral-200 cursor-not-allowed'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Synthesize Drill with Gemma
                          </button>
                        </div>
                      )}

                      {/* List of active course tests */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono text-neutral-400 block uppercase">PUBLISHED COURSE WORKBOOK DRILLS</span>
                        {quizzes.filter(q => q.courseId === selectedCourse.id).length === 0 ? (
                          <span className="text-xs text-neutral-400 italic">No quizzes published.</span>
                        ) : (
                          quizzes
                            .filter(q => q.courseId === selectedCourse.id)
                            .map(q => (
                              <div key={q.id} className="text-xs border p-3 bg-white flex justify-between items-center">
                                <div>
                                  <h5 className="font-sans font-bold uppercase text-[11px]">{q.title}</h5>
                                  <span className="text-[9px] font-mono text-neutral-400 uppercase">
                                    {q.isTestMode ? '⚠️ TEST MODE' : '📝 PRACTICE'} • {q.questions.length} Qs • {q.difficulty}
                                  </span>
                                </div>

                                <button
                                  onClick={() => {
                                    if (window.confirm(`Permanently remove quiz "${q.title}"?`)) {
                                      onRemoveQuiz(q.id);
                                    }
                                  }}
                                  className="p-1 hover:bg-neutral-50 border border-transparent rounded text-neutral-400 hover:text-black cursor-pointer"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                    {/* Right: Enrolled Students & Activity monitoring roster (3/12 width) */}
                    <div className="lg:col-span-3 space-y-4 border-l border-neutral-200 pl-0 lg:pl-6">
                      <div className="border-b border-neutral-200 pb-2 flex justify-between items-center">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                          CLASS STUDENT MONITORING
                        </h3>
                        <span className="text-[10px] font-mono text-neutral-400">{simulatedStudents.length} Enrolled</span>
                      </div>

                      {/* Student detail monitor modal overlay state */}
                      {selectedStudentForMonitor ? (
                        <div className="border border-black p-4 bg-neutral-50 space-y-4">
                          <div className="flex justify-between items-start border-b pb-2">
                            <div>
                              <span className="text-[9px] font-mono text-neutral-400 uppercase">STUDENT FILE</span>
                              <h4 className="font-sans font-black text-xs uppercase text-black">
                                {selectedStudentForMonitor.name}
                              </h4>
                            </div>
                            <button
                              onClick={() => setSelectedStudentForMonitor(null)}
                              className="text-[9px] font-mono uppercase underline text-neutral-400 hover:text-black cursor-pointer"
                            >
                              Close
                            </button>
                          </div>

                          <div className="space-y-3 text-xs">
                            <div>
                              <span className="text-[9px] font-mono text-neutral-400 block">DEPARTMENT / EMAIL</span>
                              <p className="font-mono text-neutral-700">{selectedStudentForMonitor.email}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 font-mono text-[9px] bg-white p-2 border">
                              <div>
                                <span className="text-neutral-400 block">PREPARATION LEVEL</span>
                                <strong className="text-black underline uppercase">{selectedStudentForMonitor.preparationLevel}</strong>
                              </div>
                              <div>
                                <span className="text-neutral-400 block">RISK LEVEL</span>
                                <strong className="text-black uppercase">{selectedStudentForMonitor.riskLevel}</strong>
                              </div>
                            </div>

                            <div className="border-t pt-2 space-y-1">
                              <span className="text-[9px] font-mono text-neutral-400 block">CONCEPTUAL WEAK SPOTS</span>
                              {selectedStudentForMonitor.weakTopics.map((topic: string, tIdx: number) => (
                                <span key={tIdx} className="inline-block text-[9px] font-mono bg-white border border-neutral-300 px-1.5 py-0.5 rounded uppercase mr-1">
                                  {topic}
                                </span>
                              ))}
                            </div>

                            <div className="border-t pt-3 flex flex-col gap-2">
                              <button
                                onClick={() => {
                                  if (window.confirm(`Expel student "${selectedStudentForMonitor.name}" from your active class registry?`)) {
                                    onRemoveStudent(selectedCourse.id, selectedStudentForMonitor.id);
                                    setSelectedStudentForMonitor(null);
                                    alert('Student account evicted from course workspace.');
                                  }
                                }}
                                className="w-full text-center bg-black text-white py-1 text-[10px] font-mono font-bold uppercase border border-black hover:bg-neutral-800 cursor-pointer"
                              >
                                Expel Student from Course
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Standard Roster List
                        <div className="space-y-2.5">
                          {simulatedStudents.map(student => (
                            <div 
                              key={student.id}
                              onClick={() => setSelectedStudentForMonitor(student)}
                              className="border p-3 bg-white hover:border-black transition-all cursor-pointer flex justify-between items-center group"
                            >
                              <div>
                                <h4 className="font-sans font-bold text-xs uppercase text-neutral-800 group-hover:underline">
                                  {student.name}
                                </h4>
                                <span className="text-[9px] font-mono text-neutral-400 block">
                                  Level: {student.preparationLevel}
                                </span>
                              </div>

                              <div className="text-right">
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 uppercase border rounded block ${
                                  student.riskLevel.includes('High') 
                                    ? 'bg-black text-white border-black animate-pulse' 
                                    : 'bg-white text-neutral-400 border-neutral-200'
                                }`}>
                                  {student.riskLevel.includes('High') ? 'At Risk' : 'Secure'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              )}

            </motion.div>
          )}

          {/* TEACHER AI ASSISTANT CHAT TAB */}
          {activeTab === 'ai' && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              
              {/* AI Modality Banner */}
              <div className="grid grid-cols-1 md:grid-cols-4 border border-black p-4 gap-4 bg-white">
                <div>
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">Active AI Modality</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Sparkles className="w-4 h-4 text-black animate-pulse" />
                    <span className="text-xs font-mono font-bold uppercase underline">Gemma 9B Academic</span>
                  </div>
                </div>

                <div className="md:col-span-3 flex flex-wrap gap-2 items-center text-xs">
                  <span className="text-[10px] font-mono text-neutral-400 mr-2">CHOOSE CONSOLE PATH:</span>
                  
                  {['OFFLINE', 'ONLINE', 'HYBRID'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setAiMode(mode as AIMode)}
                      className={`px-3 py-1 text-[10px] font-mono border uppercase cursor-pointer ${
                        aiMode === mode ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200 hover:border-black'
                      }`}
                    >
                      {mode} Mode
                    </button>
                  ))}

                  <p className="text-[10px] text-neutral-500 w-full mt-1">
                    Gemma parses uploaded material securely to generate rubrics, grading answer keys, and bilingual worksheets.
                  </p>
                </div>
              </div>

              {/* Chat view area */}
              <div className="border border-black bg-white flex flex-col h-[480px]">
                <div className="border-b border-neutral-200 px-4 py-3 bg-neutral-50">
                  <span className="text-[10px] font-mono font-black uppercase text-neutral-700 block">
                    Gemma Instructor Assistant Chat Port
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {teacherChatMessages.map((msg, idx) => (
                    <div 
                      key={idx}
                      className={`flex flex-col max-w-[85%] ${
                        msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      <span className="text-[9px] font-mono text-neutral-400 mb-1">
                        {msg.sender === 'user' ? 'You (Instructor)' : 'Gemma Assistant'} • {msg.timestamp}
                      </span>

                      <div className={`p-4 border rounded-lg text-xs leading-relaxed ${
                        msg.sender === 'user' 
                          ? 'bg-neutral-50 text-black border-neutral-300' 
                          : 'bg-white text-black border-black'
                      }`}>
                        <div className="whitespace-pre-wrap space-y-2">
                          {msg.text.split('\n\n').map((paragraph: string, pIdx: number) => {
                            if (paragraph.startsWith('###')) {
                              return <h3 key={pIdx} className="font-sans font-black uppercase text-xs mt-3 border-b pb-1">{paragraph.replace('###', '')}</h3>;
                            }
                            if (paragraph.startsWith('* **') || paragraph.startsWith('* ')) {
                              return (
                                <ul key={pIdx} className="list-disc pl-4 space-y-1">
                                  {paragraph.split('\n').map((li, liIdx) => (
                                    <li key={liIdx}>{li.replace('*', '').trim()}</li>
                                  ))}
                                </ul>
                              );
                            }
                            if (paragraph.startsWith('|')) {
                              // Simple Table parser mock renderer
                              return (
                                <div key={pIdx} className="overflow-x-auto my-2 border">
                                  <table className="w-full text-[10px] font-mono">
                                    <tbody>
                                      {paragraph.split('\n').map((tr, rIdx) => (
                                        <tr key={rIdx} className={rIdx === 0 ? 'bg-neutral-50 font-bold border-b' : 'border-b'}>
                                          {tr.split('|').filter(c => c.trim()).map((td, dIdx) => (
                                            <td key={dIdx} className="p-1.5 border-r">{td.trim()}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            }
                            return <p key={pIdx}>{paragraph}</p>;
                          })}
                        </div>
                      </div>
                    </div>
                  ))}

                  {isAiThinking && (
                    <div className="p-4 border border-dashed border-neutral-300 bg-white text-xs text-neutral-400 font-mono animate-pulse mr-auto">
                      Gemma compiling curriculum statistics and translation vectors...
                    </div>
                  )}
                </div>

                {/* Prompt shortcuts */}
                <div className="border-t border-neutral-200 px-4 py-2 bg-neutral-50 flex gap-2 overflow-x-auto">
                  <button
                    onClick={() => setTeacherChatInput('Construct an assessment grading rubric for mobile AI architectures.')}
                    className="text-[9px] font-mono border border-neutral-200 bg-white hover:border-black px-2 py-1 uppercase rounded cursor-pointer"
                  >
                    Build Grading Rubric
                  </button>
                  <button
                    onClick={() => setTeacherChatInput('Synthesize bilingual Urdu-English notes summary for Transformer Attention mechanisms.')}
                    className="text-[9px] font-mono border border-neutral-200 bg-white hover:border-black px-2 py-1 uppercase rounded cursor-pointer"
                  >
                    Bilingual Worksheet Notes
                  </button>
                  <button
                    onClick={() => setTeacherChatInput('What are the class-wide weak areas in CS-402 based on latest practice attempts?')}
                    className="text-[9px] font-mono border border-neutral-200 bg-white hover:border-black px-2 py-1 uppercase rounded cursor-pointer"
                  >
                    Diagnose Class Weak Areas
                  </button>
                </div>

                {/* Chat input */}
                <form onSubmit={handleTeacherChatSubmit} className="border-t border-black flex">
                  <input
                    type="text"
                    className="flex-1 px-4 py-3 text-xs outline-none bg-white text-black placeholder-neutral-400 font-sans"
                    placeholder="Ask Gemma assistant to draft grading keys, create practice sets, or translate notes..."
                    value={teacherChatInput}
                    onChange={(e) => setTeacherChatInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="bg-black text-white hover:bg-neutral-800 px-6 py-3 text-xs font-mono font-bold uppercase tracking-widest border-l border-black flex items-center gap-1.5 cursor-pointer"
                  >
                    Instruct <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

            </motion.div>
          )}

          {/* SYSTEM RUNNING LOGS TAB */}
          {activeTab === 'logs' && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="border border-black p-6 bg-white space-y-4"
            >
              <div className="flex justify-between items-center border-b pb-3 border-neutral-200">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black">
                    Real-time sandbox logs & environment telemetry
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Chronological streaming logs representing the student and teacher state transitions.
                  </p>
                </div>
                <span className="text-[10px] font-mono bg-neutral-100 px-2 py-1 border rounded uppercase">
                  Telemetry Active
                </span>
              </div>

              <div className="bg-black text-neutral-300 p-4 rounded font-mono text-[11px] space-y-2 max-h-[350px] overflow-y-auto">
                {systemLogs.map(log => (
                  <div key={log.id} className="flex flex-col md:flex-row md:items-center gap-2 border-b border-neutral-900 pb-1.5 last:border-b-0">
                    <span className="text-neutral-500">{log.timestamp}</span>
                    <span className="text-white font-bold">[{log.role}]</span>
                    <span className="text-neutral-400 uppercase font-semibold">({log.event}):</span>
                    <span className="text-neutral-300 flex-1">{log.details}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
};
