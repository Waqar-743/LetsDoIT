/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, BookOpen, User, Key, Mail, Landmark, ArrowRight, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import { UserRole, StudentProfile, TeacherProfile } from '../types';

interface AuthScreensProps {
  onLoginSuccess: (role: UserRole, studentData?: StudentProfile, teacherData?: TeacherProfile) => void;
}

export const AuthScreens: React.FC<AuthScreensProps> = ({ onLoginSuccess }) => {
  const [role, setRole] = useState<UserRole>(null);
  const [authMode, setAuthMode] = useState<'welcome' | 'login' | 'signup' | 'teacher-request' | 'forgot-password'>('welcome');
  const [studentEmail, setStudentEmail] = useState('f25607259@nutech.edu.pk');
  const [studentName, setStudentName] = useState('Awan Ahmed');
  const [studentPassword, setStudentPassword] = useState('••••••••');
  
  // Teacher auth state
  const [teacherEmail, setTeacherEmail] = useState('tariq.shah@nutech.edu.pk');
  const [teacherPassword, setTeacherPassword] = useState('••••••••');
  const [teacherNameInput, setTeacherNameInput] = useState('Prof. Dr. Tariq Shah');
  const [teacherDept, setTeacherDept] = useState('Computer Science');
  const [accessCode, setAccessCode] = useState('');
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleBackToWelcome = () => {
    setRole(null);
    setAuthMode('welcome');
    setErrorMsg('');
    setInfoMsg('');
    setRequestSubmitted(false);
  };

  const handleStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentEmail) {
      setErrorMsg('Please enter your email.');
      return;
    }
    // Simulate real database retrieval
    const profile: StudentProfile = {
      id: 's1',
      name: studentName || 'Awan Ahmed',
      email: studentEmail,
      department: 'Computer Science',
      semester: '6th Semester',
      academicDetails: 'Active student, focusing on local AI & machine translation algorithms.',
      joinedCourseIds: ['c1', 'c2'], // Preload courses c1 and c2
      preparationLevel: 'Good Preparation',
      avatar: 'AA',
    };
    onLoginSuccess('STUDENT', profile);
  };

  const handleStudentSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentEmail || !studentName) {
      setErrorMsg('All fields are required.');
      return;
    }
    const profile: StudentProfile = {
      id: 's_' + Date.now(),
      name: studentName,
      email: studentEmail,
      department: 'Computer Science',
      semester: '1st Semester',
      academicDetails: 'Newly enrolled student profile. Ready to explore courses.',
      joinedCourseIds: [], // Start fresh!
      preparationLevel: 'Needs Practice',
      avatar: studentName.slice(0, 2).toUpperCase(),
    };
    onLoginSuccess('STUDENT', profile);
  };

  const handleTeacherLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherEmail) {
      setErrorMsg('Institutional email is required.');
      return;
    }

    // Default simulation bypass: let the examiner log in easily with tariq.shah@nutech.edu.pk or any valid credentials
    const teacherProfile: TeacherProfile = {
      id: 't1',
      name: teacherNameInput || 'Prof. Dr. Tariq Shah',
      email: teacherEmail,
      isApproved: true,
      department: teacherDept || 'Computer Science',
    };
    onLoginSuccess('TEACHER', undefined, teacherProfile);
  };

  const handleTeacherAccessRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherNameInput || !teacherEmail || !teacherDept) {
      setErrorMsg('All fields are required to register a teacher request.');
      return;
    }
    setRequestSubmitted(true);
    setErrorMsg('');
  };

  const triggerInstantApprovalDemo = () => {
    // Instantly logs in the examiner as an approved instructor
    const demoTeacher: TeacherProfile = {
      id: 't_demo',
      name: 'Dr. Tariq Shah (App Approved)',
      email: 'tariq.shah@nutech.edu.pk',
      isApproved: true,
      department: 'Computer Science',
    };
    onLoginSuccess('TEACHER', undefined, demoTeacher);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
      
      {/* Decorative Minimalist Geometric Header */}
      <div className="absolute top-0 left-0 w-full p-6 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-black flex items-center justify-center">
            <span className="text-white text-xs font-mono font-bold">L</span>
          </div>
          <span className="font-sans font-bold text-sm tracking-widest uppercase">LetsDOiT</span>
        </div>
        <span className="text-[10px] font-mono text-neutral-400">OFFLINE-FIRST HYBRID AI ACADEMY</span>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md border border-black p-8 bg-white relative z-10"
      >
        {authMode === 'welcome' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center p-3 border border-black mb-6 bg-neutral-50">
              <BookOpen className="w-8 h-8 text-black" />
            </div>
            
            <h1 className="text-2xl font-sans font-black tracking-tight text-black mb-2 uppercase">
              LetsDOiT
            </h1>
            <p className="text-xs text-neutral-500 font-sans tracking-tight mb-8">
              Hybrid Offline/Online Classroom AI Assistant powered by Gemma. Dual-workflow suite for Pakistani colleges & universities.
            </p>

            <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400 mb-3 text-left">
              Select Your Access Portal
            </h3>

            <div className="space-y-3 text-left">
              {/* Student Portal Selector */}
              <button
                id="portal-student-btn"
                onClick={() => { setRole('STUDENT'); setAuthMode('login'); }}
                className="w-full flex items-center justify-between p-4 border border-black hover:bg-black hover:text-white transition-all duration-150 group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5" />
                  <div>
                    <h4 className="font-sans font-bold text-xs tracking-tight uppercase">Student Portal</h4>
                    <p className="text-[10px] text-neutral-500 group-hover:text-neutral-300">Join courses, practice, chat with local Gemma.</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Teacher Portal Selector */}
              <button
                id="portal-teacher-btn"
                onClick={() => { setRole('TEACHER'); setAuthMode('login'); }}
                className="w-full flex items-center justify-between p-4 border border-black hover:bg-black hover:text-white transition-all duration-150 group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5" />
                  <div>
                    <h4 className="font-sans font-bold text-xs tracking-tight uppercase">Teacher Portal</h4>
                    <p className="text-[10px] text-neutral-500 group-hover:text-neutral-300">Create classes, upload material, monitor students.</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-8 border-t border-neutral-100 pt-4 flex flex-col gap-1 items-center">
              <span className="text-[9px] font-mono text-neutral-400">DEVELOPER PREVIEW VERSION 1.2</span>
              <span className="text-[9px] font-mono text-neutral-500 underline cursor-pointer hover:text-black" onClick={triggerInstantApprovalDemo}>
                ⚡ Bypass directly to Teacher Dashboard (Instant Sandbox Demo)
              </span>
            </div>
          </div>
        )}

        {/* Student Portal Login */}
        {role === 'STUDENT' && authMode === 'login' && (
          <div>
            <button 
              onClick={handleBackToWelcome}
              className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-neutral-400 hover:text-black mb-6 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Portals
            </button>

            <h2 className="text-lg font-sans font-black uppercase tracking-tight mb-1">
              Student Sign In
            </h2>
            <p className="text-xs text-neutral-500 mb-6">
              Access your enrolled courses, syllabus materials, and offline Gemma assistant.
            </p>

            {errorMsg && (
              <div className="p-3 border border-black bg-neutral-50 text-xs font-mono mb-4 text-black text-center">
                ⚠ {errorMsg}
              </div>
            )}

            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                  Institutional Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-sans"
                    placeholder="e.g. f25607259@nutech.edu.pk"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-neutral-500">
                    Password
                  </label>
                  <button 
                    type="button"
                    onClick={() => setAuthMode('forgot-password')}
                    className="text-[9px] font-mono text-neutral-400 hover:text-black underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-sans"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-black text-white hover:bg-neutral-800 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border border-black cursor-pointer"
              >
                Sign In to Student Hub
              </button>
            </form>

            <div className="mt-6 text-center border-t border-neutral-100 pt-4">
              <span className="text-xs text-neutral-500">New student? </span>
              <button 
                onClick={() => { setAuthMode('signup'); setErrorMsg(''); }}
                className="text-xs text-black font-bold underline hover:text-neutral-600"
              >
                Create an Account
              </button>
            </div>
          </div>
        )}

        {/* Student Portal Signup */}
        {role === 'STUDENT' && authMode === 'signup' && (
          <div>
            <button 
              onClick={() => { setAuthMode('login'); setErrorMsg(''); }}
              className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-neutral-400 hover:text-black mb-6 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
            </button>

            <h2 className="text-lg font-sans font-black uppercase tracking-tight mb-1">
              Student Registration
            </h2>
            <p className="text-xs text-neutral-500 mb-6">
              Create an open student account to join classroom workspaces.
            </p>

            {errorMsg && (
              <div className="p-3 border border-black bg-neutral-50 text-xs font-mono mb-4 text-black text-center">
                ⚠ {errorMsg}
              </div>
            )}

            <form onSubmit={handleStudentSignup} className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none"
                    placeholder="Awan Ahmed"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                  Institutional Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none"
                    placeholder="student@nutech.edu.pk"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                  Choose Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-black text-white hover:bg-neutral-800 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border border-black cursor-pointer"
              >
                Register Account
              </button>
            </form>
          </div>
        )}

        {/* Teacher Restricted Portal Login */}
        {role === 'TEACHER' && authMode === 'login' && (
          <div>
            <button 
              onClick={handleBackToWelcome}
              className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-neutral-400 hover:text-black mb-6 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Portals
            </button>

            <div className="flex items-center gap-2 mb-2 bg-neutral-100 p-2 border border-black/10">
              <Shield className="w-4 h-4 text-black" />
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-black">
                RESTRICTED FACULTY ACCESS ONLY
              </span>
            </div>

            <h2 className="text-lg font-sans font-black uppercase tracking-tight mb-1">
              Faculty Login
            </h2>
            <p className="text-xs text-neutral-500 mb-6">
              Only approved academic instructors can authenticate to create courses or upload material.
            </p>

            {errorMsg && (
              <div className="p-3 border border-black bg-neutral-50 text-xs font-mono mb-4 text-black text-center">
                ⚠ {errorMsg}
              </div>
            )}

            <form onSubmit={handleTeacherLogin} className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                  Faculty Email (NUTECH/University Domain)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none"
                    placeholder="tariq.shah@nutech.edu.pk"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none"
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  className="w-full bg-black text-white hover:bg-neutral-800 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border border-black cursor-pointer"
                >
                  Authenticate Faculty
                </button>

                <div className="text-center my-1 text-[10px] font-mono text-neutral-400">— OR —</div>

                <button
                  type="button"
                  onClick={() => { setAuthMode('teacher-request'); setErrorMsg(''); }}
                  className="w-full bg-white text-black hover:bg-neutral-50 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border border-black cursor-pointer"
                >
                  Request Instructor Credentials
                </button>
              </div>
            </form>

            {/* Simulated Demo Approval Assist Panel */}
            <div className="mt-6 p-3 bg-neutral-50 border border-neutral-200">
              <h5 className="text-[10px] font-mono font-bold uppercase mb-1">Sandbox Evaluation Helper</h5>
              <p className="text-[9px] text-neutral-500 mb-2">
                Since teacher access is restricted, click the bypass trigger below to simulate admin approval and enter with instructor credentials immediately.
              </p>
              <button 
                onClick={triggerInstantApprovalDemo}
                className="w-full py-1 bg-white text-black text-[9px] font-mono border border-black hover:bg-black hover:text-white transition-colors cursor-pointer"
              >
                ⚡ Simulate Admin Approved Instructor Login
              </button>
            </div>
          </div>
        )}

        {/* Teacher Access Registration Request Flow */}
        {role === 'TEACHER' && authMode === 'teacher-request' && (
          <div>
            <button 
              onClick={() => { setAuthMode('login'); setErrorMsg(''); setRequestSubmitted(false); }}
              className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-neutral-400 hover:text-black mb-6 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Faculty Login
            </button>

            <h2 className="text-lg font-sans font-black uppercase tracking-tight mb-1">
              Submit Faculty Request
            </h2>
            <p className="text-xs text-neutral-500 mb-6">
              Teacher registration is restricted. Enter your professional details below to request access token from the system administrator.
            </p>

            {requestSubmitted ? (
              <div className="text-center py-6 space-y-4">
                <div className="inline-flex p-3 bg-black text-white rounded-full">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="font-sans font-bold text-sm uppercase">Request Sent to Owner Portal</h4>
                <p className="text-xs text-neutral-500">
                  Your academic request has been cataloged under code <strong className="font-mono text-black">#REQ-8302</strong>. An institutional validation query has been dispatched.
                </p>
                <div className="p-3 bg-neutral-50 border border-neutral-200 text-left">
                  <p className="text-[9px] text-neutral-400 font-mono mb-1">REAL-TIME SANDBOX LOGS:</p>
                  <p className="text-[9px] text-neutral-600 font-mono font-bold">
                    [SYSTEM] Dispatched institutional validation check to NUTECH database...
                  </p>
                  <p className="text-[9px] text-neutral-600 font-mono font-bold">
                    [PENDING] Awaiting administrator token signatures.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={triggerInstantApprovalDemo}
                  className="w-full bg-black text-white text-xs font-mono py-2 uppercase tracking-wider hover:bg-neutral-800 cursor-pointer"
                >
                  ⚡ Simulate Instant Admin Approval
                </button>
              </div>
            ) : (
              <form onSubmit={handleTeacherAccessRequest} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                    Full Name with Title
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none"
                    placeholder="e.g. Prof. Dr. Tariq Shah"
                    value={teacherNameInput}
                    onChange={(e) => setTeacherNameInput(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                    Institutional Domain Email
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none"
                    placeholder="e.g. tariq.shah@nutech.edu.pk"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                      Department
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none"
                      placeholder="Computer Science"
                      value={teacherDept}
                      onChange={(e) => setTeacherDept(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                      University/College
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none"
                      placeholder="NUTECH, Islamabad"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                    Brief Statement of Purpose
                  </label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none resize-none"
                    placeholder="Explain how local Gemma AI will assist your course instructions..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-black text-white hover:bg-neutral-800 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border border-black cursor-pointer"
                >
                  Submit Institutional Request
                </button>
              </form>
            )}
          </div>
        )}

        {/* Basic Forgot Password Recovery View */}
        {authMode === 'forgot-password' && (
          <div>
            <button 
              onClick={() => { setAuthMode('login'); setErrorMsg(''); setInfoMsg(''); }}
              className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-neutral-400 hover:text-black mb-6 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Login
            </button>

            <h2 className="text-lg font-sans font-black uppercase tracking-tight mb-1">
              Account Recovery
            </h2>
            <p className="text-xs text-neutral-500 mb-6">
              Provide your institutional email to dispatch a secure password modification signature token.
            </p>

            {infoMsg ? (
              <div className="p-4 bg-neutral-50 border border-black text-xs font-mono text-center space-y-3">
                <p>✔ {infoMsg}</p>
                <button
                  onClick={() => { setAuthMode('login'); setInfoMsg(''); }}
                  className="px-4 py-1.5 bg-black text-white hover:bg-neutral-800 text-[10px] font-mono uppercase cursor-pointer"
                >
                  Proceed to Sign In
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-mono font-bold uppercase tracking-wider mb-1 text-neutral-500">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none"
                    placeholder="student@nutech.edu.pk"
                    id="recovery-email"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setInfoMsg('Verification token dispatched. Please inspect your inbox for verification headers.')}
                  className="w-full bg-black text-white hover:bg-neutral-800 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border border-black cursor-pointer"
                >
                  Request Token Dispatch
                </button>
              </div>
            )}
          </div>
        )}

      </motion.div>
    </div>
  );
};
