/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Info, CheckCircle, Search, HelpCircle, Activity, Award } from 'lucide-react';

interface FlowStepProps {
  number: number;
  title: string;
  desc: string;
  isActive?: boolean;
}

const FlowStep: React.FC<FlowStepProps> = ({ number, title, desc, isActive = false }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: number * 0.08 }}
      className={`relative flex flex-col p-4 border rounded-lg transition-all ${
        isActive 
          ? 'bg-black text-white border-black shadow-md' 
          : 'bg-white text-black border-neutral-200 hover:border-black'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
          isActive ? 'border-white/30 bg-white/10 text-white' : 'border-neutral-200 bg-neutral-50 text-neutral-500'
        }`}>
          STEP 0{number}
        </span>
        {isActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        )}
      </div>
      <h4 className="font-sans font-medium text-xs tracking-tight">{title}</h4>
      <p className={`text-[11px] mt-1 ${isActive ? 'text-neutral-300' : 'text-neutral-500'}`}>
        {desc}
      </p>
    </motion.div>
  );
};

export const StudentFlowChart: React.FC = () => {
  const steps = [
    { title: 'Course Joined', desc: 'Secure entry via 4-digit token.' },
    { title: 'Material Viewed', desc: 'Read lecture notes, slides & PDFs.' },
    { title: 'AI Practice', desc: 'Deep dive queries & concept drilling.' },
    { title: 'Quiz Attempted', desc: 'Start easy, medium, or hard drills.' },
    { title: 'Weak Areas Detected', desc: 'Gemma diagnoses core conceptual gaps.' },
    { title: 'Practice Improved', desc: 'Focus on suggested targeted reviews.' },
    { title: 'Prep Level Updated', desc: 'Visual upgrade on preparation level.' },
  ];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-black" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-black">
            Student Learning Journey Map
          </h3>
        </div>
        <span className="text-[10px] font-mono text-neutral-400">STATEFUL LIFECYCLE</span>
      </div>

      {/* Grid of steps */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {steps.map((step, idx) => (
          <div key={idx} className="relative flex flex-col justify-between">
            <FlowStep 
              number={idx + 1} 
              title={step.title} 
              desc={step.desc} 
              isActive={idx === 4} // Highlight Weak Areas Detected
            />
            {idx < steps.length - 1 && (
              <div className="hidden lg:flex absolute top-1/2 -right-2 transform -translate-y-1/2 z-10 text-neutral-300 pointer-events-none">
                <ArrowRight className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const TeacherFlowChart: React.FC = () => {
  const steps = [
    { title: 'Course Created', desc: 'Publish workspace & dynamic 4-digit code.' },
    { title: 'Material Uploaded', desc: 'Attach PDF, notes & visual slides.' },
    { title: 'Quiz Generated', desc: 'AI constructs MCQs and short-answers.' },
    { title: 'Students Attempt', desc: 'Track local practice or official tests.' },
    { title: 'Weak Areas Found', desc: 'Aggregate class-wide misconceptions.' },
    { title: 'Review Progress', desc: 'Adjust teaching materials & guidelines.' },
  ];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-black" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-black">
            Teacher Instruction Workflow Map
          </h3>
        </div>
        <span className="text-[10px] font-mono text-neutral-400">CLASS MANAGEMENT</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {steps.map((step, idx) => (
          <div key={idx} className="relative flex flex-col justify-between">
            <FlowStep 
              number={idx + 1} 
              title={step.title} 
              desc={step.desc} 
              isActive={idx === 2} // Highlight Quiz Generated
            />
            {idx < steps.length - 1 && (
              <div className="hidden lg:flex absolute top-1/2 -right-2 transform -translate-y-1/2 z-10 text-neutral-300 pointer-events-none">
                <ArrowRight className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Custom Black & White Sparkline Graph
export const MonochromeLineChart: React.FC<{ data: number[]; labels: string[] }> = ({ data, labels }) => {
  const maxVal = Math.max(...data, 1);
  const minVal = 0;
  const range = maxVal - minVal;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * 100; // percent width
    const y = 90 - ((val - minVal) / range) * 80; // percent height with margin
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="p-4 border border-black bg-white rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-xs font-mono font-bold uppercase tracking-wide">Historical Practice Trend</h4>
          <p className="text-[10px] text-neutral-500">Aggregated average score progression (%)</p>
        </div>
        <div className="text-right">
          <span className="text-lg font-mono font-bold">87%</span>
          <p className="text-[9px] text-neutral-400">CURRENT AVERAGE</p>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative h-24 w-full border-b border-l border-neutral-200 pt-2 pl-2">
        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 90" preserveAspectRatio="none">
          {/* Grid lines */}
          <line x1="0" y1="10" x2="100" y2="10" stroke="#f0f0f0" strokeDasharray="2" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="#f0f0f0" strokeDasharray="2" />

          {/* Area fill */}
          <polygon
            points={`0,90 ${points} 100,90`}
            fill="url(#gradient-bw)"
            className="opacity-10"
          />

          {/* Line */}
          <polyline
            fill="none"
            stroke="black"
            strokeWidth="1.5"
            points={points}
          />

          {/* Data points */}
          {data.map((val, idx) => {
            const x = (idx / (data.length - 1)) * 100;
            const y = 90 - ((val - minVal) / range) * 80;
            return (
              <g key={idx}>
                <circle
                  cx={x}
                  cy={y}
                  r="2"
                  fill="white"
                  stroke="black"
                  strokeWidth="1.5"
                  className="cursor-pointer hover:r-3 transition-all"
                />
              </g>
            );
          })}

          <defs>
            <linearGradient id="gradient-bw" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="black" />
              <stop offset="100%" stopColor="white" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-2">
        {labels.map((label, idx) => (
          <span key={idx} className="text-[9px] font-mono text-neutral-400">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

// Custom Black & White Activity Bar Chart
export const MonochromeBarChart: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="p-4 border border-black bg-white rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-xs font-mono font-bold uppercase tracking-wide">Weekly Active Hours</h4>
          <p className="text-[10px] text-neutral-500">Local & online session logging duration</p>
        </div>
        <div className="text-right">
          <span className="text-lg font-mono font-bold">14.5h</span>
          <p className="text-[9px] text-neutral-400">TOTAL THIS WEEK</p>
        </div>
      </div>

      <div className="flex items-end justify-between h-24 pt-4 border-b border-neutral-200">
        {data.map((item, idx) => {
          const heightPct = (item.value / maxVal) * 100;
          return (
            <div key={idx} className="flex flex-col items-center w-full group">
              {/* Tooltip on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[9px] font-mono px-1 py-0.5 rounded -mt-6 absolute mb-20">
                {item.value}h
              </div>
              <div 
                className="w-4 bg-neutral-200 hover:bg-black transition-colors rounded-t"
                style={{ height: `${Math.max(heightPct, 5)}%` }}
              />
              <span className="text-[9px] font-mono text-neutral-400 mt-2">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Custom Topic Diagnosis Radar / Grid View
export const WeakTopicDiagnosis: React.FC<{ topics: { name: string; score: number; attempts: number }[] }> = ({ topics }) => {
  return (
    <div className="p-4 border border-black bg-white rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-xs font-mono font-bold uppercase tracking-wide">Topic Breakdown & Weak Areas</h4>
          <p className="text-[10px] text-neutral-500">Based on diagnostic mistake patterns</p>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 border border-black rounded bg-neutral-50 text-black">
          {topics.length} TOPICS TRACKED
        </span>
      </div>

      <div className="space-y-3">
        {topics.map((topic, idx) => {
          const isWeak = topic.score < 60;
          return (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="font-sans font-medium">{topic.name}</span>
                <span className={`font-mono font-bold ${isWeak ? 'text-black underline' : 'text-neutral-500'}`}>
                  {topic.score}% {isWeak ? '• NEEDS PRACTICE' : '• SECURE'}
                </span>
              </div>
              
              {/* Bar progress */}
              <div className="w-full h-2 bg-neutral-100 border border-neutral-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${isWeak ? 'bg-black' : 'bg-neutral-400'}`} 
                  style={{ width: `${topic.score}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                <span>{topic.attempts} quiz attempts</span>
                {isWeak && <span>Action: Review Lecture PDF & ask AI</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
