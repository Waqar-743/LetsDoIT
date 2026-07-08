/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Plus, MessageSquare, Award, User, Settings, LogOut, CheckCircle, 
  Download, Send, ArrowRight, BookMarked, HelpCircle, Laptop, Globe, Cpu, AlertTriangle, FileText, ArrowLeft, Clock, BarChart2
} from 'lucide-react';
import { 
  StudentProfile, Course, CourseMaterial, Quiz, QuizAttempt, AIMode, PreparationLevel, MistakeType, ChatMessage 
} from '../types';
import { 
  StudentFlowChart, MonochromeLineChart, MonochromeBarChart, WeakTopicDiagnosis 
} from './VisualFlowCharts';

interface StudentDashboardProps {
  profile: StudentProfile;
  courses: Course[];
  materials: CourseMaterial[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  onUpdateProfile: (updated: StudentProfile) => void;
  onJoinCourse: (code: string) => string | null; // returns error message or null if success
  onLeaveCourse: (courseId: string) => void;
  onAddAttempt: (attempt: QuizAttempt) => void;
  onLogout: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  profile,
  courses,
  materials,
  quizzes,
  attempts,
  onUpdateProfile,
  onJoinCourse,
  onLeaveCourse,
  onAddAttempt,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'ai' | 'quizzes' | 'profile'>('overview');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<CourseMaterial | null>(null);
  const [aiMode, setAiMode] = useState<AIMode>('HYBRID');
  
  // AI Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [selectedMaterialForAI, setSelectedMaterialForAI] = useState<CourseMaterial | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quiz state
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizDifficulty, setQuizDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isQuizRunning, setIsQuizRunning] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<{ [questionId: string]: string }>({});
  const [quizTimer, setQuizTimer] = useState(0);
  const [quizTimerInterval, setQuizTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [justSubmittedQuizAttempt, setJustSubmittedQuizAttempt] = useState<QuizAttempt | null>(null);

  // Join Course Input state
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAiThinking]);

  // Handle quiz timer
  useEffect(() => {
    if (isQuizRunning && quizTimer > 0) {
      const interval = setInterval(() => {
        setQuizTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            handleAutoSubmitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isQuizRunning, quizTimer]);

  // Seed initial system messages if chat is empty
  useEffect(() => {
    if (chatMessages.length === 0) {
      setChatMessages([
        {
          id: 'welcome_ai',
          sender: 'ai',
          text: `Assalam-o-Alaikum, **${profile.name}**! I am your **Gemma Teaching Assistant**.

I am fully operational in **${aiMode} Mode**. I can explain lecture notes, summarize slides, translate technical concepts into bilingual **Urdu-English**, or generate focused mock questions.

**Select one of your courses or send any course file directly to this workspace to begin studying!**`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modeUsed: aiMode,
        }
      ]);
    }
  }, []);

  // Filter joined courses
  const joinedCourses = courses.filter(c => profile.joinedCourseIds.includes(c.id));

  // Handle joining a course
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setJoinSuccess('');
    
    if (!joinCode || joinCode.length !== 4) {
      setJoinError('Please supply a valid 4-digit code.');
      return;
    }

    const error = onJoinCourse(joinCode);
    if (error) {
      setJoinError(error);
    } else {
      const targetCourse = courses.find(c => c.code === joinCode);
      setJoinSuccess(`Successfully joined ${targetCourse?.title || 'the course'}!`);
      setJoinCode('');
      setTimeout(() => setJoinSuccess(''), 3000);
    }
  };

  // Send content straight to AI Study Assistant
  const handleSendMaterialToAI = (material: CourseMaterial, course: Course) => {
    setSelectedMaterialForAI(material);
    setActiveTab('ai');
    
    // Auto insert an AI prompt query
    const samplePrompt = `I have loaded your uploaded document: **${material.title}** (${material.fileName}). Please analyze this material and provide:
1. A **high-level summary** of the core technical concept.
2. A list of the **top 3 key takeaways** I need to memorize.
3. An **Urdu-English (Bilingual)** translation of the main definition to help me grasp the concept deeply.`;

    setChatMessages(prev => [
      ...prev,
      {
        id: 'user_file_send_' + Date.now(),
        sender: 'user',
        text: `[Attached Course File: ${material.title}] \n\n${samplePrompt}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);

    setIsAiThinking(true);
    setTimeout(() => {
      let gemmaResponse = '';
      if (material.id === 'm3') { // Urdu Tokenization Handout
        gemmaResponse = `### Gemma Analysis: Bilingual Urdu-English Tokenization

Based on your uploaded study notes: **${material.title}**, here is your custom learning brief:

#### 1. Core Concept Summary
Standard subword tokenizers (like Byte-Pair Encoding or WordPiece) are pre-trained mostly on English corpora. When processing cursive **Nasta\`liq Urdu script**, words are frequently over-segmented into tiny character fragments, causing high latency, excessive token counts, and semantic information loss.

#### 2. Top 3 Key Takeaways
* **Cursive Shape Merging**: Urdu shapes shift dynamically depending on their surrounding letters (initial, medial, final, isolated forms).
* **Vocabulary Expansion**: Adding explicit Urdu byte sequences directly to the tokenizer vocabulary reduces sequence lengths by up to **64%**.
* **Zero Internet Advantage**: local Gemma models can execute these custom tokenization maps completely offline, safeguarding user query privacy.

#### 3. Bilingual Urdu-English Translation (مفہوم)
> **Subword Tokenization (ذیلی لفظی ٹوکن سازی)**:
> Dividing complex words into smaller, reusable building blocks (morphemes) to handle rare words and grammar patterns.
> *اردو میں اس کا مطلب ہے کہ طویل الفاظ کو چھوٹے حصوں میں تقسیم کیا جاتا ہے تاکہ کمپیوٹر نئے یا غیر معمولی الفاظ کو آسانی سے سمجھ سکے، جیسے "کتابیں" کو "کتاب" اور "یں" میں تقسیم کرنا۔*

#### 💡 suggested practice
Try asking me to generate a 3-question MCQ quiz on this specific document to test your memory!`;
      } else {
        gemmaResponse = `### Gemma Analysis: ${material.title}

#### 1. Technical Summary
This document breaks down the fundamental architecture of **${course.title}**. It outlines why edge processing or local execution models are critical in locations with limited or intermittent internet bandwidth.

#### 2. Top 3 Key Takeaways
* **Resource Optimization**: Local quantization techniques (like 4-bit weights) allow massive models to operate inside client memory limits.
* **Latency Compression**: By processing prompts locally, you bypass network handshakes, leading to predictable tokens-per-second values.
* **Academic Integrity**: Quizzes labeled as "Test Mode" temporarily lock this AI container to prevent unauthorized concept lookups.

#### 3. Urdu-English Explanation (آسان اردو تشریح)
> **Edge Processing (ایج پروسیسنگ / مقامی نظام)**:
> Running computations locally on your physical device rather than a remote cloud server.
> *اس کا آسان مطلب یہ ہے کہ معلومات کو انٹرنیٹ کے ذریعے کسی دور دراز کمپیوٹر پر بھیجنے کے بجائے، آپ کے اپنے موبائل یا لیپ ٹاپ پر ہی پروسیس کیا جاتا ہے۔ اس سے بغیر انٹرنیٹ بھی کام جاری رہتا ہے۔*`;
      }

      setChatMessages(prev => [
        ...prev,
        {
          id: 'ai_resp_' + Date.now(),
          sender: 'ai',
          text: gemmaResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modeUsed: aiMode,
        }
      ]);
      setIsAiThinking(false);
    }, 1500);
  };

  // Submit AI Prompt
  const handleSendPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsgText = chatInput;
    setChatMessages(prev => [
      ...prev,
      {
        id: 'msg_u_' + Date.now(),
        sender: 'user',
        text: userMsgText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
    setChatInput('');
    setIsAiThinking(true);

    // Simulate AI generation with custom Pakistan local classroom context
    setTimeout(() => {
      let gemmaAnswer = '';
      const query = userMsgText.toLowerCase();

      if (query.includes('urdu') || query.includes('explanation') || query.includes('explain')) {
        gemmaAnswer = `### Gemma Explanation (آسان تشریح)

Based on your classroom request, here is a simplified bilingual breakdown:

**Core Concept: Neural Network Quantization (کوانٹائزیشن)**
* **In English**: Quantization is the process of mapping continuous, high-precision floating-point numbers (FP32) to low-precision formats (like INT4) to save memory and hardware processing power.
* **In Urdu (آسان الفاظ میں)**: کوانٹائزیشن کا مطلب ہے ماڈل کے وزنی ڈیٹا (weights) کو سکڑانا۔ جیسے ایک بہت بڑی فائل کو اس کا معیار خراب کیے بغیر کمپریس کر دینا تاکہ وہ کم ریم (RAM) والے موبائل پر بھی چل سکے۔

**Why does this matter in Pakistan?**
* With frequent load shedding and unstable mobile internet in local classrooms, executing **INT4 Gemma models offline** ensures study guides are immediately accessible without waiting for data buffers.`;
      } else if (query.includes('quiz') || query.includes('practice') || query.includes('test')) {
        gemmaAnswer = `### Practice Preparation Helper

I can help you prepare for your course quizzes! I recommend starting a **Practice Quiz** from the navigation panel.

Here is a quick diagnostic question to test your knowledge:
* **Question**: Why does local Gemma run memory-bound on mobile hardware?
* **Options**:
  A) Due to low disk storage space.
  B) Because weights must be continuously loaded from system RAM to CPU cache for every single token.
  C) Because mobile screens cannot render fast fonts.

*Ask me for the answer if you are unsure!*`;
      } else {
        gemmaAnswer = `### Gemma Teaching Assistant Response

I have analyzed your request regarding **"${userMsgText}"** inside your curriculum environment.

#### Concept Walkthrough
1. **Context**: Running Local Gemma models under a hybrid architecture.
2. **Offline Mode**: Operates fully on-device without data packets. Uses smaller quantized parameters (e.g. 2B models).
3. **Online Mode**: Uses larger hosted parameters (e.g. 9B or larger Gemma models) via remote hosting for highly complex mathematical calculations.
4. **Hybrid Mode**: Dynamically switches to online query routing when a connection is stable, failing back to local CPU execution if the link is dropped.

#### Suggested Action
Select your active Course Materials to generate custom interactive MCQs directly matching your current semester syllabus!`;
      }

      setChatMessages(prev => [
        ...prev,
        {
          id: 'msg_ai_' + Date.now(),
          sender: 'ai',
          text: gemmaAnswer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modeUsed: aiMode,
        }
      ]);
      setIsAiThinking(false);
    }, 1200);
  };

  // Start a Quiz
  const handleStartQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setQuizAnswers({});
    setJustSubmittedQuizAttempt(null);
    setIsQuizRunning(true);
    setQuizTimer(quiz.timeLimit * 60);
    setActiveTab('quizzes');
  };

  // Auto-submit quiz on timeout
  const handleAutoSubmitQuiz = () => {
    if (isQuizRunning) {
      handleCompleteQuiz();
    }
  };

  // Complete/Submit Quiz and calculate high-fidelity diagnostic outputs
  const handleCompleteQuiz = () => {
    if (!activeQuiz) return;
    setIsQuizRunning(false);

    let score = 0;
    const mistakesList: any[] = [];
    const weakTopicsMap = new Set<string>();

    activeQuiz.questions.forEach(q => {
      const studentAns = quizAnswers[q.id] || '[No Answer Provided]';
      const isCorrect = studentAns.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();

      if (isCorrect) {
        score++;
      } else {
        // High-fidelity mistake categorizer
        const mistakeTypes: MistakeType[] = [
          'Conceptual gap',
          'Careless mistake',
          'Misread question',
          'Partial understanding'
        ];
        
        // Simple hash calculation helper
        const getHashCode = (str: string): number => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + code;
            hash = hash & hash;
          }
          return Math.abs(hash);
        };

        // Distribute types based on question ID to make it mock-analytical but consistent
        const pickedType = mistakeTypes[getHashCode(q.id) % 4] || 'Conceptual gap';
        
        mistakesList.push({
          questionId: q.id,
          questionText: q.text,
          studentAnswer: studentAns,
          correctAnswer: q.correctAnswer,
          mistakeType: pickedType,
          explanation: q.explanation,
        });
        weakTopicsMap.add(q.topicTag);
      }
    });

    // Score calculation
    const scorePct = (score / activeQuiz.questions.length) * 100;
    let quizPrepLevel: PreparationLevel = 'Needs Practice';
    if (scorePct >= 90) quizPrepLevel = 'Outstanding Preparation';
    else if (scorePct >= 80) quizPrepLevel = 'Excellent Preparation';
    else if (scorePct >= 65) quizPrepLevel = 'Good Preparation';
    else if (scorePct >= 45) quizPrepLevel = 'Average Preparation';

    const newAttempt: QuizAttempt = {
      id: 'att_' + Date.now(),
      studentId: profile.id,
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      courseId: activeQuiz.courseId,
      courseTitle: courses.find(c => c.id === activeQuiz.courseId)?.title || 'Course Unit',
      score,
      totalQuestions: activeQuiz.questions.length,
      attemptDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
      isTestMode: activeQuiz.isTestMode,
      answers: quizAnswers,
      diagnosis: {
        mistakes: mistakesList,
        weakTopics: Array.from(weakTopicsMap),
        suggestedPractice: mistakesList.length > 0 
          ? `Review the source materials for topics: "${Array.from(weakTopicsMap).join(', ')}". Ask Gemma AI to translate complex sections.`
          : 'Outstanding result! You have mastered all topics in this study block.',
        preparationLevel: quizPrepLevel,
      }
    };

    onAddAttempt(newAttempt);
    setJustSubmittedQuizAttempt(newAttempt);
    
    // Update student's overall preparation level based on historical quiz averages
    const allAttempts = [...attempts, newAttempt];
    const avgPct = (allAttempts.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions), 0) / allAttempts.length) * 100;
    
    let overallPrep: PreparationLevel = 'Needs Practice';
    if (avgPct >= 90) overallPrep = 'Outstanding Preparation';
    else if (avgPct >= 80) overallPrep = 'Excellent Preparation';
    else if (avgPct >= 65) overallPrep = 'Good Preparation';
    else if (avgPct >= 45) overallPrep = 'Average Preparation';

    onUpdateProfile({
      ...profile,
      preparationLevel: overallPrep,
    });
  };



  // Check if active course has any official test publishing
  const hasActiveTestMode = joinedCourses.some(course => {
    const courseQuizzes = quizzes.filter(q => q.courseId === course.id && q.isTestMode && q.isPublished);
    // Find if the student has NOT completed this test yet
    return courseQuizzes.some(q => !attempts.some(att => att.quizId === q.id));
  });

  return (
    <div className="min-h-screen bg-white text-black flex flex-col font-sans">
      
      {/* Upper Navigation Rail */}
      <header className="sticky top-0 z-40 bg-white border-b border-black px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-black text-white flex items-center justify-center font-mono font-black text-sm">
            L
          </div>
          <div>
            <h1 className="font-sans font-black text-sm uppercase tracking-wider">LetsDOiT Student</h1>
            <p className="text-[9px] font-mono text-neutral-400">OFFLINE-FIRST HYBRID AI</p>
          </div>
        </div>

        {/* Global Stats Rail */}
        <div className="hidden lg:flex items-center gap-6 border-l border-neutral-200 pl-6 mr-auto ml-6">
          <div className="text-left">
            <span className="text-[10px] font-mono text-neutral-400 block">CURRENT PREPARATION LEVEL</span>
            <span className="text-xs font-mono font-bold uppercase underline decoration-2 decoration-black">
              {profile.preparationLevel}
            </span>
          </div>
          <div className="text-left">
            <span className="text-[10px] font-mono text-neutral-400 block">ENROLLED WORKSPACES</span>
            <span className="text-xs font-mono font-bold">{joinedCourses.length} Courses</span>
          </div>
          <div className="text-left">
            <span className="text-[10px] font-mono text-neutral-400 block">LOCAL ENGINE ENGINE</span>
            <span className="text-xs font-mono font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-black rounded-full animate-ping" />
              Gemma-2B Active
            </span>
          </div>
        </div>

        {/* Navigation Action tabs */}
        <div className="flex items-center gap-1.5">
          <button
            id="tab-student-overview"
            onClick={() => { setActiveTab('overview'); setSelectedCourse(null); }}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-tight border cursor-pointer ${
              activeTab === 'overview' ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200 hover:border-black'
            }`}
          >
            Overview
          </button>
          <button
            id="tab-student-courses"
            onClick={() => { setActiveTab('courses'); setSelectedCourse(null); }}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-tight border cursor-pointer ${
              activeTab === 'courses' ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200 hover:border-black'
            }`}
          >
            Courses
          </button>
          <button
            id="tab-student-ai"
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-tight border cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ai' ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200 hover:border-black'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Gemma AI
          </button>
          <button
            id="tab-student-quizzes"
            onClick={() => setActiveTab('quizzes')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-tight border cursor-pointer ${
              activeTab === 'quizzes' ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200 hover:border-black'
            }`}
          >
            Quizzes
          </button>
          <button
            id="tab-student-profile"
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-tight border cursor-pointer flex items-center gap-1 ${
              activeTab === 'profile' ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200 hover:border-black'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Profile
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
              
              {/* Header Panel */}
              <div className="grid grid-cols-1 md:grid-cols-3 border border-black p-6 gap-6 bg-white">
                <div className="md:col-span-2 space-y-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 border border-black bg-neutral-50 uppercase font-bold text-black rounded">
                    Student Profile Session
                  </span>
                  <h2 className="text-xl font-sans font-black uppercase">
                    Welcome Back, {profile.name}
                  </h2>
                  <p className="text-xs text-neutral-500 max-w-xl">
                    You are accessing the dynamic offline classroom environment. Your current preparation stands at <strong className="text-black underline">{profile.preparationLevel}</strong>. Start review exercises locally on Gemma or join courses issued by your campus instructors.
                  </p>
                </div>

                {/* Course Code Quick Join Box */}
                <div className="border border-black p-4 bg-neutral-50 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-mono font-black uppercase mb-1">Join Course Workspace</h4>
                    <p className="text-[10px] text-neutral-400 mb-3">Provide the 4-digit code provided by your course teacher.</p>
                  </div>
                  
                  <form onSubmit={handleJoin} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="e.g. 1024"
                        className="w-24 border border-neutral-300 focus:border-black bg-white text-xs font-mono font-bold tracking-widest text-center uppercase outline-none py-1.5"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                      />
                      <button
                        type="submit"
                        className="flex-1 bg-black text-white text-[10px] font-mono font-bold uppercase py-1.5 border border-black hover:bg-neutral-800 cursor-pointer"
                      >
                        Enroll
                      </button>
                    </div>
                    {joinError && <p className="text-[10px] font-mono text-black font-bold">⚠ {joinError}</p>}
                    {joinSuccess && <p className="text-[10px] font-mono text-black underline">{joinSuccess}</p>}
                  </form>
                </div>
              </div>

              {/* Dynamic Interactive Flow Chart */}
              <div className="border border-neutral-200 p-6 bg-white">
                <StudentFlowChart />
              </div>

              {/* Learning Charts Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Score Trend sparkline */}
                <MonochromeLineChart 
                  data={[40, 65, 55, 80, 87]} 
                  labels={['Lec 1 Demo', 'Lab Manual Quant', 'Urdu Tokenizer', 'Attention Exam', 'Today']} 
                />

                {/* Week Active Hours bar chart */}
                <MonochromeBarChart 
                  data={[
                    { label: 'Mon', value: 1.5 },
                    { label: 'Tue', value: 3.2 },
                    { label: 'Wed', value: 0.8 },
                    { label: 'Thu', value: 4.5 },
                    { label: 'Fri', value: 2.1 },
                    { label: 'Sat', value: 1.0 },
                    { label: 'Sun', value: 1.4 },
                  ]}
                />
              </div>

              {/* Enrolled Courses Quick Deck */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                  YOUR ACTIVE COURSE WORKSPACES
                </h3>
                
                {joinedCourses.length === 0 ? (
                  <div className="border border-neutral-200 p-8 text-center text-xs text-neutral-500 bg-neutral-50">
                    No active courses. Please enter a 4-digit token code above to join a course (Try typing "1024" or "4096" to unlock preloaded courses!).
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {joinedCourses.map(course => {
                      const courseQuizzes = quizzes.filter(q => q.courseId === course.id);
                      return (
                        <div 
                          key={course.id}
                          className="border border-black p-4 bg-white hover:shadow-md transition-shadow flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-mono border border-neutral-200 px-1.5 py-0.5 rounded text-neutral-500">
                                CODE: {course.code}
                              </span>
                              <span className="text-[10px] font-mono text-neutral-400">
                                {course.enrolledCount} enrolled students
                              </span>
                            </div>
                            
                            <h4 className="font-sans font-bold text-xs uppercase tracking-tight mb-1">
                              {course.title}
                            </h4>
                            <p className="text-[11px] text-neutral-500 mb-3 line-clamp-2">
                              {course.description}
                            </p>
                          </div>

                          <div className="border-t border-neutral-100 pt-3 flex items-center justify-between">
                            <div className="text-left">
                              <span className="text-[9px] font-mono text-neutral-400 block">FACULTY INSTRUCTOR</span>
                              <span className="text-[10px] font-sans font-medium text-black">
                                {course.teacherName}
                              </span>
                            </div>

                            <button
                              id={`enter-course-${course.id}`}
                              onClick={() => { setSelectedCourse(course); setActiveTab('courses'); }}
                              className="text-[10px] font-mono font-bold bg-black text-white hover:bg-neutral-800 px-3 py-1 border border-black uppercase cursor-pointer flex items-center gap-1"
                            >
                              Workspace <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </motion.div>
          )}

          {/* COURSES WORKSPACE TAB */}
          {activeTab === 'courses' && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {!selectedCourse ? (
                // Course Hub Selector
                <div className="space-y-4">
                  <div className="border border-black p-6 bg-neutral-50">
                    <h2 className="text-lg font-sans font-black uppercase tracking-tight mb-1">Course Workspace Hub</h2>
                    <p className="text-xs text-neutral-500">
                      Select any enrolled class below to inspect slides, retrieve syllabus files, view practice quizzes, or consult the local Gemma assistant.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {joinedCourses.map(course => (
                      <div 
                        key={course.id}
                        className="border border-black p-5 bg-white flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-mono bg-black text-white px-2 py-0.5 uppercase">
                              {course.semester}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-400">
                              Enrolled Class Code: {course.code}
                            </span>
                          </div>
                          <h3 className="font-sans font-bold text-sm uppercase tracking-tight mb-2">
                            {course.title}
                          </h3>
                          <p className="text-xs text-neutral-500 mb-4">
                            {course.description}
                          </p>
                          <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-50 border border-neutral-100 rounded text-xs">
                            <div>
                              <span className="text-[9px] font-mono text-neutral-400 block">INSTRUCTOR</span>
                              <strong>{course.teacherName}</strong>
                            </div>
                            <div>
                              <span className="text-[9px] font-mono text-neutral-400 block">ENROLLMENT STATUS</span>
                              <strong className="text-neutral-700 capitalize">{course.status}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-neutral-100">
                          <button
                            id={`view-ws-${course.id}`}
                            onClick={() => setSelectedCourse(course)}
                            className="flex-1 text-center bg-black text-white hover:bg-neutral-800 py-2 text-xs font-mono font-bold uppercase border border-black cursor-pointer"
                          >
                            Open Class Workspace
                          </button>
                          <button
                            id={`leave-course-${course.id}`}
                            onClick={() => {
                              if (window.confirm(`Leave course "${course.title}"? This clears local history.`)) {
                                onLeaveCourse(course.id);
                              }
                            }}
                            className="px-3 py-2 text-xs font-mono uppercase text-black hover:bg-neutral-100 border border-neutral-200 cursor-pointer"
                            title="Leave Course Workspace"
                          >
                            Leave
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // Inside Specific Course Workspace
                <div className="space-y-6">
                  
                  {/* Class Header Banner */}
                  <div className="border border-black p-6 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <button 
                        onClick={() => setSelectedCourse(null)}
                        className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase text-neutral-400 hover:text-black mb-2 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Return to Hub
                      </button>
                      <h2 className="text-xl font-sans font-black uppercase tracking-tight">
                        {selectedCourse.title}
                      </h2>
                      <p className="text-xs text-neutral-500">
                        Instructor: <strong>{selectedCourse.teacherName}</strong> | Class: <strong>{selectedCourse.semester}</strong> | <strong>{selectedCourse.enrolledCount} students enrolled</strong>
                      </p>
                    </div>

                    <div className="text-left md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-neutral-100 flex md:flex-col justify-between items-center md:items-end">
                      <span className="text-[9px] font-mono text-neutral-400">CLASS ENROLLMENT CODE</span>
                      <strong className="text-xl font-mono tracking-widest bg-neutral-100 px-3 py-1 border border-neutral-200 rounded">
                        {selectedCourse.code}
                      </strong>
                    </div>
                  </div>

                  {/* Course Materials Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left & Middle: Files / Uploaded Documents */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                          TEACHER-UPLOADED LECTURE MATERIALS
                        </h3>
                        <span className="text-[10px] font-mono text-neutral-400">
                          {materials.filter(m => m.courseId === selectedCourse.id).length} Documents
                        </span>
                      </div>

                      <div className="space-y-3">
                        {materials.filter(m => m.courseId === selectedCourse.id).length === 0 ? (
                          <div className="border border-dashed border-neutral-200 p-8 text-center text-xs text-neutral-400">
                            No study materials uploaded for this class.
                          </div>
                        ) : (
                          materials
                            .filter(m => m.courseId === selectedCourse.id)
                            .map(material => (
                              <div 
                                key={material.id}
                                className={`border p-4 bg-white flex flex-col justify-between transition-all ${
                                  selectedMaterial?.id === material.id ? 'border-black bg-neutral-50/50 shadow-sm' : 'border-neutral-200 hover:border-black'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-start gap-2.5">
                                    <div className="p-2 border border-neutral-200 bg-neutral-50">
                                      <FileText className="w-5 h-5 text-black" />
                                    </div>
                                    <div>
                                      <h4 className="font-sans font-bold text-xs uppercase tracking-tight">
                                        {material.title}
                                      </h4>
                                      <div className="flex gap-2 items-center text-[10px] font-mono text-neutral-400 mt-1">
                                        <span className="uppercase font-bold text-black border-r border-neutral-200 pr-2">
                                          {material.type}
                                        </span>
                                        <span>{material.fileName}</span>
                                        <span>•</span>
                                        <span>{material.fileSize}</span>
                                        <span>•</span>
                                        <span>Uploaded {material.uploadDate}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      id={`send-ai-${material.id}`}
                                      onClick={() => handleSendMaterialToAI(material, selectedCourse)}
                                      className="text-[10px] font-mono font-bold bg-black text-white hover:bg-neutral-800 px-2.5 py-1.5 border border-black uppercase cursor-pointer"
                                      title="Study with Gemma AI"
                                    >
                                      Study with AI
                                    </button>
                                    <button
                                      onClick={() => setSelectedMaterial(selectedMaterial?.id === material.id ? null : material)}
                                      className="text-[10px] font-mono px-2.5 py-1.5 border border-neutral-200 hover:border-black bg-white text-black cursor-pointer"
                                    >
                                      {selectedMaterial?.id === material.id ? 'Close' : 'Details'}
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded Material Details & Summary panel */}
                                {selectedMaterial?.id === material.id && (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="border-t border-neutral-100 mt-3 pt-3 text-xs space-y-3"
                                  >
                                    <div>
                                      <strong className="text-[10px] font-mono text-neutral-400 uppercase block">AI DOCUMENT BRIEFING</strong>
                                      <p className="text-neutral-600 mt-0.5 italic leading-relaxed">{material.contentSummary}</p>
                                    </div>
                                    
                                    <div className="flex gap-2 justify-end">
                                      <button 
                                        onClick={() => alert(`Initiating file transfer stream for [${material.fileName}]. Local caching successful.`)}
                                        className="text-[10px] font-mono bg-white text-black border border-black hover:bg-neutral-50 px-3 py-1.5 uppercase flex items-center gap-1 cursor-pointer"
                                      >
                                        <Download className="w-3.5 h-3.5" /> Download PDF/Slides
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                    {/* Right side: Course level testing & Quizzes */}
                    <div className="space-y-4">
                      <div className="border-b border-neutral-200 pb-2">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                          CLASS ASSIGNMENTS & QUIZZES
                        </h3>
                      </div>

                      <div className="space-y-3">
                        {quizzes.filter(q => q.courseId === selectedCourse.id).length === 0 ? (
                          <div className="border border-dashed border-neutral-200 p-8 text-center text-xs text-neutral-400">
                            No quizzes uploaded for this course yet.
                          </div>
                        ) : (
                          quizzes
                            .filter(q => q.courseId === selectedCourse.id && q.isPublished)
                            .map(quiz => {
                              const hasAttempted = attempts.some(a => a.quizId === quiz.id);
                              const attemptDetails = attempts.find(a => a.quizId === quiz.id);

                              return (
                                <div 
                                  key={quiz.id}
                                  className={`border p-4 bg-white flex flex-col justify-between ${
                                    quiz.isTestMode ? 'border-neutral-900 bg-neutral-50/20' : 'border-neutral-200'
                                  }`}
                                >
                                  <div>
                                    <div className="flex justify-between items-center mb-2">
                                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 uppercase border ${
                                        quiz.isTestMode 
                                          ? 'bg-black text-white border-black' 
                                          : 'bg-white text-black border-neutral-300'
                                      }`}>
                                        {quiz.isTestMode ? '⚠️ Official Test' : '📝 Practice Drill'}
                                      </span>
                                      
                                      <span className="text-[9px] font-mono text-neutral-400 uppercase">
                                        DIFFICULTY: {quiz.difficulty}
                                      </span>
                                    </div>

                                    <h4 className="font-sans font-bold text-xs uppercase mb-1">
                                      {quiz.title}
                                    </h4>
                                    
                                    <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500 mb-4">
                                      <span>{quiz.questions.length} questions</span>
                                      <span>Time: {quiz.timeLimit} mins</span>
                                    </div>
                                  </div>

                                  {/* Interaction Flow based on previous attempt state */}
                                  <div className="border-t border-neutral-100 pt-3 flex items-center justify-between">
                                    {hasAttempted ? (
                                      <div className="flex justify-between w-full items-center">
                                        <span className="text-[10px] font-mono text-black font-bold flex items-center gap-1">
                                          <CheckCircle className="w-3.5 h-3.5 text-black" /> Completed ({attemptDetails?.score}/{attemptDetails?.totalQuestions})
                                        </span>
                                        <button
                                          onClick={() => {
                                            setJustSubmittedQuizAttempt(attemptDetails || null);
                                            setActiveTab('quizzes');
                                          }}
                                          className="text-[9px] font-mono font-bold uppercase underline hover:text-neutral-500 cursor-pointer"
                                        >
                                          View Results
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex justify-between w-full items-center">
                                        {quiz.dueDate && (
                                          <span className="text-[9px] font-mono text-neutral-400">
                                            Due: {quiz.dueDate}
                                          </span>
                                        )}
                                        <button
                                          id={`start-quiz-${quiz.id}`}
                                          onClick={() => handleStartQuiz(quiz)}
                                          className="ml-auto bg-black text-white hover:bg-neutral-800 text-[10px] font-mono font-bold uppercase tracking-tight px-3 py-1.5 border border-black cursor-pointer"
                                        >
                                          Start {quiz.isTestMode ? 'Exam' : 'Quiz'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>

                  </div>

                </div>
              )}
            </motion.div>
          )}

          {/* AI CHAT WORKSPACE TAB */}
          {activeTab === 'ai' && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              
              {/* Gemma Model Status Block */}
              <div className="grid grid-cols-1 md:grid-cols-4 border border-black p-4 gap-4 bg-white">
                <div className="md:col-span-1 space-y-1">
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
                    Active AI Model Engine
                  </h4>
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-black" />
                    <span className="text-xs font-mono font-bold uppercase underline">Gemma 2B Client</span>
                  </div>
                </div>

                {/* AI Mode Selector Panel */}
                <div className="md:col-span-3 flex flex-wrap gap-3 items-center">
                  <span className="text-[10px] font-mono text-neutral-400 mr-2">CHOOSE MODALITY:</span>
                  
                  <button
                    onClick={() => setAiMode('OFFLINE')}
                    className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-tight border cursor-pointer flex items-center gap-1.5 ${
                      aiMode === 'OFFLINE' ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200 hover:border-black'
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5" />
                    Offline Mode
                  </button>

                  <button
                    onClick={() => setAiMode('ONLINE')}
                    className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-tight border cursor-pointer flex items-center gap-1.5 ${
                      aiMode === 'ONLINE' ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200 hover:border-black'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Online Mode
                  </button>

                  <button
                    onClick={() => setAiMode('HYBRID')}
                    className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-tight border cursor-pointer flex items-center gap-1.5 ${
                      aiMode === 'HYBRID' ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200 hover:border-black'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    Hybrid/Auto Mode
                  </button>

                  {/* Modality Explain label */}
                  <p className="text-[10px] text-neutral-500 w-full mt-1 font-sans">
                    {aiMode === 'OFFLINE' && 'Offline Mode: works locally inside browser cache with zero internet reliance.'}
                    {aiMode === 'ONLINE' && 'Online Mode: utilizes remote cloud-hosted Gemma clusters for high reasoning efficiency.'}
                    {aiMode === 'HYBRID' && 'Hybrid Mode: automatically uses high hosted parameters, falling back to local weights on connection drop.'}
                  </p>
                </div>
              </div>

              {/* Chat Viewport Area */}
              <div className="border border-black bg-white flex flex-col h-[500px]">
                
                {/* Chat Header and active exam integrity status check */}
                <div className="border-b border-neutral-200 px-4 py-3 bg-neutral-50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-black" />
                    <span className="text-[10px] font-mono font-black uppercase">
                      Gemma AI Interactive Study Workspace
                    </span>
                  </div>

                  {selectedMaterialForAI && (
                    <span className="text-[10px] font-mono bg-black text-white px-2 py-0.5 rounded">
                      Context: {selectedMaterialForAI.title}
                    </span>
                  )}
                </div>

                {/* Main Message Box / Integrity check block */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {hasActiveTestMode ? (
                    // Academic Integrity Suspended Block
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                      <div className="p-3 border border-black bg-neutral-100 rounded-full">
                        <AlertTriangle className="w-8 h-8 text-black" />
                      </div>
                      <h3 className="font-sans font-black text-sm uppercase tracking-tight">
                        AI study assistance suspended
                      </h3>
                      <p className="text-xs text-neutral-500 max-w-md">
                        Your teacher has launched an official exam (<strong className="text-black">CS-402 Official Exam</strong>) in this workspace. Under **Test Mode** guidelines, AI lookup engines are suspended to ensure academic integrity.
                      </p>
                      <button
                        onClick={() => setActiveTab('quizzes')}
                        className="bg-black text-white font-mono text-xs px-4 py-2 border border-black hover:bg-neutral-800 uppercase cursor-pointer"
                      >
                        Navigate to Exam Panel
                      </button>
                    </div>
                  ) : (
                    // Normal Chat Screen
                    <>
                      {chatMessages.map((msg, idx) => (
                        <div 
                          key={msg.id || idx}
                          className={`flex flex-col max-w-[85%] ${
                            msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                          }`}
                        >
                          <span className="text-[9px] font-mono text-neutral-400 mb-1">
                            {msg.sender === 'user' ? 'You' : 'Gemma AI'} • {msg.timestamp}
                            {msg.modeUsed && ` [${msg.modeUsed}]`}
                          </span>

                          <div className={`p-4 border rounded-lg text-xs leading-relaxed ${
                            msg.sender === 'user'
                              ? 'bg-neutral-50 text-black border-neutral-300'
                              : 'bg-white text-black border-black'
                          }`}>
                            {/* Simple render logic for formatted headers and blockquotes inside state */}
                            <div className="whitespace-pre-wrap space-y-2">
                              {msg.text.split('\n\n').map((paragraph, pIdx) => {
                                if (paragraph.startsWith('###')) {
                                  return <h3 key={pIdx} className="font-sans font-black uppercase text-sm mt-3 border-b pb-1 border-neutral-100">{paragraph.replace('###', '')}</h3>;
                                }
                                if (paragraph.startsWith('####')) {
                                  return <h4 key={pIdx} className="font-sans font-bold text-xs uppercase tracking-tight mt-2">{paragraph.replace('####', '')}</h4>;
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
                                if (paragraph.startsWith('>')) {
                                  return (
                                    <blockquote key={pIdx} className="border-l-2 border-black pl-3 py-1 text-neutral-600 bg-neutral-50 my-2 italic">
                                      {paragraph.replace('>', '').trim()}
                                    </blockquote>
                                  );
                                }
                                return <p key={pIdx}>{paragraph}</p>;
                              })}
                            </div>
                          </div>
                        </div>
                      ))}

                      {isAiThinking && (
                        <div className="flex flex-col items-start mr-auto max-w-[80%]">
                          <span className="text-[9px] font-mono text-neutral-400 mb-1">
                            Gemma AI • Running local parameters...
                          </span>
                          <div className="p-4 border border-dashed border-neutral-300 bg-white text-xs text-neutral-500 font-mono animate-pulse">
                            Processing query... Generative token streaming in progress...
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Prompt Shortcuts Rail */}
                {!hasActiveTestMode && (
                  <div className="border-t border-neutral-200 px-4 py-2 bg-neutral-50 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
                    <button
                      onClick={() => setChatInput('Explain my uploaded lecture notes simply.')}
                      className="text-[9px] font-mono border border-neutral-200 bg-white hover:border-black px-2 py-1 uppercase rounded cursor-pointer"
                    >
                      Summarize Notes
                    </button>
                    <button
                      onClick={() => setChatInput('Explain machine learning concepts in Urdu-English bilingual terms.')}
                      className="text-[9px] font-mono border border-neutral-200 bg-white hover:border-black px-2 py-1 uppercase rounded cursor-pointer"
                    >
                      Bilingual (Urdu-English)
                    </button>
                    <button
                      onClick={() => setChatInput('Help me prepare for my quiz: Ask me 3 questions.')}
                      className="text-[9px] font-mono border border-neutral-200 bg-white hover:border-black px-2 py-1 uppercase rounded cursor-pointer"
                    >
                      Generate Mock Questions
                    </button>
                    <button
                      onClick={() => setChatInput('Construct a weekly ML study plan for 6th semester.')}
                      className="text-[9px] font-mono border border-neutral-200 bg-white hover:border-black px-2 py-1 uppercase rounded cursor-pointer"
                    >
                      Create Study Plan
                    </button>
                  </div>
                )}

                {/* Chat Input form */}
                {!hasActiveTestMode && (
                  <form onSubmit={handleSendPrompt} className="border-t border-black flex">
                    <input
                      type="text"
                      className="flex-1 px-4 py-3 text-xs outline-none bg-white text-black placeholder-neutral-400 font-sans"
                      placeholder="Ask Gemma AI teaching assistant a concept or request a bilingual Urdu explanation..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="bg-black text-white hover:bg-neutral-800 px-6 py-3 text-xs font-mono font-bold uppercase tracking-widest border-l border-black flex items-center gap-1.5 cursor-pointer"
                    >
                      Send <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>

            </motion.div>
          )}

          {/* QUIZZES & TESTING TAB */}
          {activeTab === 'quizzes' && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              
              {/* QUIZ IS RUNNING SCREEN */}
              {isQuizRunning && activeQuiz && (
                <div className="border border-black p-6 bg-white space-y-6">
                  
                  {/* Exam Tracker banner */}
                  <div className="flex justify-between items-center border-b border-black pb-4">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 border border-black uppercase font-bold bg-neutral-100">
                        {activeQuiz.isTestMode ? '⚠️ ACTIVE EXAMINATION' : '📝 ACTIVE PRACTICE DRILL'}
                      </span>
                      <h2 className="text-lg font-sans font-black uppercase mt-2">
                        {activeQuiz.title}
                      </h2>
                    </div>

                    {/* Countdown Timer */}
                    <div className="text-right flex items-center gap-2 border border-black p-2 bg-neutral-50">
                      <Clock className="w-4 h-4 text-black animate-pulse" />
                      <span className="text-sm font-mono font-bold">
                        {Math.floor(quizTimer / 60)}:{(quizTimer % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>

                  {/* Question Loop */}
                  <div className="space-y-6">
                    {activeQuiz.questions.map((question, idx) => (
                      <div key={question.id} className="p-4 border border-neutral-200 bg-neutral-50/50 space-y-3">
                        <span className="text-[10px] font-mono text-neutral-400 uppercase">
                          QUESTION {idx + 1} OF {activeQuiz.questions.length} • {question.topicTag}
                        </span>
                        <h4 className="font-sans font-bold text-xs uppercase leading-relaxed text-black">
                          {question.text}
                        </h4>

                        {/* MCQ / Options check */}
                        {question.options ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                            {question.options.map((opt, oIdx) => {
                              const isSelected = quizAnswers[question.id] === opt;
                              return (
                                <button
                                  type="button"
                                  key={oIdx}
                                  onClick={() => setQuizAnswers(prev => ({ ...prev, [question.id]: opt }))}
                                  className={`p-3 text-left text-xs border transition-all cursor-pointer ${
                                    isSelected 
                                      ? 'bg-black text-white border-black font-semibold' 
                                      : 'bg-white text-black border-neutral-200 hover:border-black'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          // Short Answer text input
                          <div className="pt-2">
                            <input
                              type="text"
                              className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none"
                              placeholder="Type your conceptual response here..."
                              value={quizAnswers[question.id] || ''}
                              onChange={(e) => setQuizAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Submission Flow */}
                  <div className="border-t border-black pt-4 flex justify-between items-center">
                    <span className="text-[10px] font-mono text-neutral-400">
                      DO NOT REFRESH OR CLOSE PORTAL. ANSWERS AUTO-SAVED LOCALLY.
                    </span>
                    <button
                      onClick={handleCompleteQuiz}
                      className="bg-black text-white hover:bg-neutral-800 text-xs font-mono font-bold uppercase tracking-wider px-6 py-2.5 border border-black cursor-pointer"
                    >
                      Complete & Submit Attempt
                    </button>
                  </div>

                </div>
              )}

              {/* QUIZ RESULT AND WEAK-AREA DIAGNOSIS REPORT */}
              {!isQuizRunning && justSubmittedQuizAttempt && (
                <div className="border border-black p-6 bg-white space-y-6">
                  
                  {/* Results Banner */}
                  <div className="grid grid-cols-1 md:grid-cols-3 border border-black p-6 gap-6 bg-neutral-50">
                    <div className="md:col-span-2 space-y-2">
                      <span className="text-[9px] font-mono px-2 py-0.5 border border-black bg-white text-black uppercase font-black">
                        OFFICIAL AI DIAGNOSIS REPORT
                      </span>
                      <h2 className="text-xl font-sans font-black uppercase">
                        {justSubmittedQuizAttempt.quizTitle}
                      </h2>
                      <p className="text-xs text-neutral-500">
                        Course Unit: <strong>{justSubmittedQuizAttempt.courseTitle}</strong> | Attempted: <strong>{justSubmittedQuizAttempt.attemptDate}</strong>
                      </p>
                    </div>

                    <div className="border border-black p-4 bg-white text-center flex flex-col items-center justify-center">
                      <span className="text-[9px] font-mono text-neutral-400 uppercase">SCORE PERFORMANCE</span>
                      <strong className="text-2xl font-mono font-black">
                        {justSubmittedQuizAttempt.score} / {justSubmittedQuizAttempt.totalQuestions}
                      </strong>
                      <span className="text-[10px] font-mono bg-black text-white px-2 py-0.5 uppercase mt-2">
                        {Math.round((justSubmittedQuizAttempt.score / justSubmittedQuizAttempt.totalQuestions) * 100)}% SUCCESS
                      </span>
                    </div>
                  </div>

                  {/* Diagnosis results and mistakes categories */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Mistake Diagnoses Cards */}
                    <div className="lg:col-span-2 space-y-4">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                        GEMMA DIAGNOSTIC MISTAKE CLASSIFICATION
                      </h3>

                      {justSubmittedQuizAttempt.diagnosis.mistakes.length === 0 ? (
                        <div className="p-6 border border-neutral-200 text-center text-xs text-neutral-500">
                          🎉 Fantastic! Perfect execution. No concept mistakes detected in this study run.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {justSubmittedQuizAttempt.diagnosis.mistakes.map((mistake, mIdx) => (
                            <div key={mIdx} className="border border-neutral-300 p-4 bg-white space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] font-mono bg-black text-white px-2 py-0.5 uppercase tracking-wide">
                                  Category: {mistake.mistakeType}
                                </span>
                                <span className="text-[10px] font-mono text-neutral-400">
                                  MISTAKE 0{mIdx + 1}
                                </span>
                              </div>

                              <div>
                                <h4 className="text-xs font-sans font-bold uppercase text-neutral-500">QUESTION:</h4>
                                <p className="text-xs font-medium text-black">{mistake.questionText}</p>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-neutral-50 border border-neutral-100 text-xs font-mono">
                                <div>
                                  <span className="text-[9px] text-neutral-400 block">YOUR SELECTION</span>
                                  <span className="text-black line-through">{mistake.studentAnswer}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-neutral-400 block">CORRECT PATTERN</span>
                                  <span className="text-black underline font-bold">{mistake.correctAnswer}</span>
                                </div>
                              </div>

                              <div>
                                <h5 className="text-[10px] font-mono font-bold text-black uppercase">Gemma Corrective Guideline:</h5>
                                <p className="text-xs text-neutral-600 italic mt-1 leading-relaxed">
                                  {mistake.explanation}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Dynamic Action items right side */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                        SUGGESTED REVIEWS
                      </h3>

                      <div className="border border-black p-4 bg-white space-y-4">
                        <div>
                          <span className="text-[9px] font-mono text-neutral-400 block">WEAK CONCEPTS IDENTIFIED</span>
                          {justSubmittedQuizAttempt.diagnosis.weakTopics.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {justSubmittedQuizAttempt.diagnosis.weakTopics.map((topic, tIdx) => (
                                <span key={tIdx} className="text-[9px] font-mono bg-neutral-100 border px-1.5 py-0.5 uppercase">
                                  {topic}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs font-semibold">None detected! Secure syllabus state.</span>
                          )}
                        </div>

                        <div className="border-t border-neutral-100 pt-3">
                          <span className="text-[9px] font-mono text-neutral-400 block">AI GENERATED ACTION PLAN</span>
                          <p className="text-xs text-neutral-600 leading-relaxed mt-1">
                            {justSubmittedQuizAttempt.diagnosis.suggestedPractice}
                          </p>
                        </div>

                        <div className="border-t border-neutral-100 pt-3">
                          <span className="text-[9px] font-mono text-neutral-400 block">DIAGNOSTIC PREPARATION LEVEL</span>
                          <span className="text-xs font-mono font-bold uppercase block mt-1 underline">
                            {justSubmittedQuizAttempt.diagnosis.preparationLevel}
                          </span>
                        </div>

                        <div className="border-t border-black pt-4 flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedMaterialForAI(null);
                              setActiveTab('ai');
                            }}
                            className="flex-1 text-center bg-black text-white hover:bg-neutral-800 py-2 text-xs font-mono font-bold uppercase border border-black cursor-pointer"
                          >
                            Ask AI to Explain
                          </button>
                          <button
                            onClick={() => setJustSubmittedQuizAttempt(null)}
                            className="px-3 py-2 text-xs font-mono uppercase border hover:bg-neutral-100 cursor-pointer"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>
              )}

              {/* GENERAL QUIZZES OVERVIEW HUB */}
              {!isQuizRunning && !justSubmittedQuizAttempt && (
                <div className="space-y-6">
                  
                  {/* Quizzes dashboard banner */}
                  <div className="border border-black p-6 bg-neutral-50">
                    <h2 className="text-lg font-sans font-black uppercase tracking-tight mb-1">Interactive testing center</h2>
                    <p className="text-xs text-neutral-500">
                      Test your semester syllabus offline. Based on your inputs, Gemma compiles analytical diagnosis, categorizing mistake patterns to upgrade your overall preparation status.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Available Quizzes list */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="border-b border-neutral-200 pb-2 flex justify-between items-center">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                          ALL AVAILABLE CAMPUS EXAMS & PRACTICE DRILLS
                        </h3>
                      </div>

                      <div className="space-y-3">
                        {joinedCourses.length === 0 ? (
                          <div className="p-6 border border-dashed text-center text-xs text-neutral-400 bg-white">
                            Please enroll in a course workspace to unlock practice exams.
                          </div>
                        ) : (
                          quizzes
                            .filter(q => profile.joinedCourseIds.includes(q.courseId) && q.isPublished)
                            .map(quiz => {
                              const attempted = attempts.find(a => a.quizId === quiz.id);
                              return (
                                <div key={quiz.id} className="border border-black p-4 bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                  <div>
                                    <div className="flex gap-2 items-center mb-1">
                                      <span className={`text-[9px] font-mono px-1.5 py-0.5 uppercase border ${
                                        quiz.isTestMode ? 'bg-black text-white border-black' : 'bg-white text-neutral-300 border-neutral-200'
                                      }`}>
                                        {quiz.isTestMode ? 'Exam test' : 'Practice Drill'}
                                      </span>
                                      <span className="text-[9px] font-mono text-neutral-400">
                                        COURSE: {courses.find(c => c.id === quiz.courseId)?.title}
                                      </span>
                                    </div>
                                    <h4 className="font-sans font-bold text-xs uppercase text-black">{quiz.title}</h4>
                                    <div className="flex gap-3 text-[10px] font-mono text-neutral-400 mt-1">
                                      <span>{quiz.questions.length} questions</span>
                                      <span>•</span>
                                      <span>{quiz.timeLimit} minutes limit</span>
                                    </div>
                                  </div>

                                  <div className="border-t md:border-t-0 pt-2 md:pt-0 w-full md:w-auto flex justify-between md:justify-end items-center gap-3">
                                    {attempted ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono font-bold">
                                          Score: {attempted.score}/{attempted.totalQuestions} ({Math.round((attempted.score/attempted.totalQuestions)*100)}%)
                                        </span>
                                        <button
                                          onClick={() => setJustSubmittedQuizAttempt(attempted)}
                                          className="text-[10px] font-mono border px-2.5 py-1 text-black bg-white hover:bg-neutral-50 cursor-pointer"
                                        >
                                          Diagnosis
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        id={`drill-start-${quiz.id}`}
                                        onClick={() => handleStartQuiz(quiz)}
                                        className="bg-black text-white hover:bg-neutral-800 text-[10px] font-mono font-bold uppercase tracking-wide px-3 py-1.5 border border-black cursor-pointer"
                                      >
                                        Start Drill
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>

                    {/* Historical summary and analytics right side */}
                    <div className="space-y-4">
                      
                      {/* Weak Topics diagnosis radar */}
                      <WeakTopicDiagnosis 
                        topics={[
                          { name: 'Quantization', score: 85, attempts: 2 },
                          { name: 'Inference Architectures', score: 40, attempts: 3 }, // weak
                          { name: 'Urdu NLP', score: 50, attempts: 1 }, // weak
                          { name: 'Transformer Attention', score: 90, attempts: 1 },
                        ]}
                      />

                      {/* Attempts History log */}
                      <div className="p-4 border border-neutral-200 bg-white rounded-lg">
                        <h4 className="text-xs font-mono font-bold uppercase tracking-wide text-neutral-400 mb-3">
                          COMPLETED ATTEMPTS LOG
                        </h4>
                        
                        <div className="space-y-2.5">
                          {attempts.length === 0 ? (
                            <span className="text-xs text-neutral-400 italic">No historical quiz submissions.</span>
                          ) : (
                            attempts.map(att => (
                              <div key={att.id} className="text-xs border-b border-neutral-100 pb-2 flex justify-between items-center">
                                <div>
                                  <h5 className="font-semibold line-clamp-1 uppercase text-[11px]">{att.quizTitle}</h5>
                                  <span className="text-[9px] font-mono text-neutral-400">{att.attemptDate}</span>
                                </div>
                                <span className="font-mono font-bold">
                                  {att.score}/{att.totalQuestions}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>

                  </div>

                </div>
              )}

            </motion.div>
          )}

          {/* STUDENT PROFILE & SETTINGS TAB */}
          {activeTab === 'profile' && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto border border-black p-6 bg-white space-y-6"
            >
              <h2 className="text-lg font-sans font-black uppercase tracking-tight border-b pb-3 border-neutral-200">
                Student Profile & Account Settings
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Left: Avatar Selection */}
                <div className="flex flex-col items-center justify-center p-4 border border-neutral-200 bg-neutral-50/50">
                  <div className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center font-sans font-black text-2xl mb-3">
                    {profile.avatar}
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400">ACTIVE AVATAR TOKEN</span>
                  
                  <div className="flex gap-1.5 mt-3">
                    {['AA', 'S1', 'G2', 'U3'].map(tok => (
                      <button
                        key={tok}
                        onClick={() => onUpdateProfile({ ...profile, avatar: tok })}
                        className={`w-7 h-7 text-[10px] font-mono border rounded ${
                          profile.avatar === tok ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200'
                        }`}
                      >
                        {tok}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: Academic Info forms */}
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                      Student Full Name
                    </label>
                    <input
                      type="text"
                      className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none"
                      value={profile.name}
                      onChange={(e) => onUpdateProfile({ ...profile, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                      Institutional Email (Primary domain)
                    </label>
                    <input
                      type="email"
                      className="w-full border border-neutral-300 focus:border-black bg-neutral-50 px-3 py-2 text-xs outline-none text-neutral-500"
                      readOnly
                      value={profile.email}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                        Academic Department
                      </label>
                      <input
                        type="text"
                        className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none"
                        value={profile.department}
                        onChange={(e) => onUpdateProfile({ ...profile, department: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                        Semester / Academic Year
                      </label>
                      <input
                        type="text"
                        className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none"
                        value={profile.semester}
                        onChange={(e) => onUpdateProfile({ ...profile, semester: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                      Secondary Scholastic Details
                    </label>
                    <textarea
                      rows={2}
                      className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-2 text-xs outline-none resize-none"
                      value={profile.academicDetails}
                      onChange={(e) => onUpdateProfile({ ...profile, academicDetails: e.target.value })}
                    />
                  </div>
                </div>

              </div>

              <div className="border-t border-neutral-200 pt-4 flex justify-between items-center text-xs">
                <span className="text-[10px] font-mono text-neutral-400">DATABASE PARADIGM: LOCALSTORAGE STORAGE KEY</span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset application states? This restores original preloaded courses and profile metrics.')) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="text-[10px] font-mono uppercase underline text-black hover:text-neutral-500 cursor-pointer"
                >
                  Hard Reset Sandbox Storage
                </button>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
};
