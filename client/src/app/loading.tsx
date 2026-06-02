"use client";

import React from 'react';
import { BookOpen } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-500 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-[100px] pointer-events-none animate-blob" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-[100px] pointer-events-none animate-blob" style={{ animationDelay: '4s' }} />

      <div className="flex flex-col items-center gap-6 relative z-10 animate-fade-in">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-blue-600/10 dark:bg-blue-500/10 border border-blue-500/30 flex items-center justify-center animate-pulse">
            <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-500" />
          </div>
          <div className="absolute -inset-1 rounded-3xl border border-blue-500/20 animate-ping opacity-75 pointer-events-none" />
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-500 dark:to-emerald-400 bg-clip-text text-transparent">
            Study Manager Pro
          </span>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
