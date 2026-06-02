"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BookOpen, CheckSquare, Calendar, MessageSquare, Clock, Shield, 
  Sparkles, Moon, Sun, ArrowRight, Eye, EyeOff, Check, X, Loader2,
  Brain, Code, BookOpenCheck, Activity
} from 'lucide-react';

const STUDY_TIPS = [
  "Studies show studying in 25-minute blocks (Pomodoro) followed by 5-minute breaks prevents cognitive fatigue.",
  "Active Recall (testing yourself) is 150% more effective for retention than passive re-reading of textbooks.",
  "Explaining concepts in simple terms to a classmate is the fastest way to debug your own understanding.",
  "Spaced repetition helps move details to long-term memory—review concepts at day 1, day 3, and day 7.",
  "Moving cards on the Kanban board helps your team visualize project bottlenecks instantly.",
  "Tracking focus sessions builds positive cognitive habits and keeps you accountable."
];

export default function Home() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [theme, setTheme] = useState('light');
  
  // Forms
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Password Visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login Transition Splash Screen States
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [transitionMessage, setTransitionMessage] = useState('Initializing secure authentication...');
  const [activeStudyTip, setActiveStudyTip] = useState('');

  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
      setTheme('dark');
    }
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  const toggleTheme = () => {
    if (theme === 'light') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setTheme('light');
    }
  };

  // Password Validation Checks
  const isPasswordLong = password.length >= 8;
  const isPasswordMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  // Run transition simulation upon success
  const startTransition = (userData: any, token: string) => {
    setIsTransitioning(true);
    setLoadingProgress(0);
    setTransitionMessage('Authenticating credentials...');
    
    // Choose random study tip
    const randomTip = STUDY_TIPS[Math.floor(Math.random() * STUDY_TIPS.length)];
    setActiveStudyTip(randomTip);

    const interval = setInterval(() => {
      setLoadingProgress((prev) => {
        const next = prev + 5;
        if (next === 20) setTransitionMessage('Connecting to academic databases...');
        if (next === 45) setTransitionMessage('Syncing team project kanbans...');
        if (next === 65) setTransitionMessage('Mounting live collaboration channels...');
        if (next === 85) setTransitionMessage('Tuning Pomodoro study focus timers...');
        if (next === 95) setTransitionMessage('Preparing your workspace...');
        if (next >= 100) {
          clearInterval(interval);
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(userData));
          setTimeout(() => {
            router.push('/dashboard');
          }, 150);
          return 100;
        }
        return next;
      });
    }, 60);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isLogin && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    const baseUrl = 'http://localhost:5000/api/v1/auth';
    const endpoint = isLogin ? `${baseUrl}/login` : `${baseUrl}/register`;
    const payload = isLogin 
      ? { emailOrUsername: email, password }
      : { fullName, username, email, password, confirmPassword };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          const firstErrorField = Object.keys(data.errors)[0];
          const firstErrorMsg = data.errors[firstErrorField][0];
          throw new Error(`${firstErrorField}: ${firstErrorMsg}`);
        }
        throw new Error(data.message || 'Authentication failed');
      }

      setSuccess(isLogin ? 'Sign in successful!' : 'Account created successfully!');
      
      // Start premium route loader screen
      setTimeout(() => {
        startTransition(data.user, data.token);
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Connection failed. Please verify that the backend is running.');
      setLoading(false);
    }
  };

  // If in route transition mode, render premium loading screen
  if (isTransitioning) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950 text-slate-800 dark:text-slate-100 transition-all duration-500 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-[-25%] left-[-15%] w-[600px] h-[600px] rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-[120px] pointer-events-none animate-blob" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[600px] h-[600px] rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-[120px] pointer-events-none animate-blob" style={{ animationDelay: '5s' }} />

        <div className="w-full max-w-[500px] px-6 text-center z-10 flex flex-col items-center gap-8 animate-fade-in">
          {/* Logo element */}
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-blue-600/15 dark:bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shadow-lg">
              <Brain className="w-10 h-10 text-blue-600 dark:text-blue-500 animate-pulse" />
            </div>
            <div className="absolute -inset-1 rounded-3xl border border-blue-500/20 animate-ping opacity-60 pointer-events-none" />
          </div>

          <div className="flex flex-col gap-2 w-full">
            <h2 className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-500 dark:to-emerald-400 bg-clip-text text-transparent">
              Study Manager Pro
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{transitionMessage}</p>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full bg-slate-200/50 dark:bg-slate-800/50 h-2.5 rounded-full overflow-hidden border border-slate-300/20 shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 dark:from-blue-500 dark:to-emerald-400 rounded-full transition-all duration-150"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>

          {/* Academic Tip Panel */}
          {activeStudyTip && (
            <div className="w-full p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md shadow-md text-left flex flex-col gap-2 mt-4 animate-fade-in">
              <span className="text-[10px] font-extrabold tracking-wider text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1.5">
                <BookOpenCheck className="w-3.5 h-3.5" />
                Study Method Pro Tip
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                {activeStudyTip}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950 text-slate-800 dark:text-slate-100 transition-colors duration-500">
      
      {/* Background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-[120px] pointer-events-none animate-blob" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-[100px] pointer-events-none animate-blob" style={{ animationDelay: '7s' }} />

      {/* Floating Academic symbols background particles */}
      <div className="absolute top-[20%] right-[45%] p-3 rounded-2xl glass-panel border border-slate-300/30 text-blue-500 animate-floating hidden lg:block opacity-60" style={{ animationDelay: '1s' }}>
        <Brain className="w-6 h-6" />
      </div>
      <div className="absolute bottom-[25%] left-[45%] p-3 rounded-2xl glass-panel border border-slate-300/30 text-emerald-500 animate-floating hidden lg:block opacity-60" style={{ animationDelay: '3s' }}>
        <Clock className="w-6 h-6" />
      </div>
      <div className="absolute top-[60%] left-[8%] p-3 rounded-2xl glass-panel border border-slate-300/30 text-purple-500 animate-floating hidden lg:block opacity-60" style={{ animationDelay: '5s' }}>
        <Code className="w-6 h-6" />
      </div>

      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800/40 backdrop-blur-md sticky top-0 z-50 transition-all">
        <div className="flex items-center gap-2.5 hover:opacity-90 transition-all cursor-pointer">
          <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-500 animate-pulse" />
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-500 dark:to-emerald-400 bg-clip-text text-transparent">
            Study Manager Pro
          </span>
        </div>
        
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
          aria-label="Toggle Theme"
        >
          {theme === 'light' ? <Moon className="w-5 h-5 text-slate-700" /> : <Sun className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />}
        </button>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-6 py-12 lg:py-20 grid lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left column */}
        <div className="lg:col-span-7 flex flex-col gap-6 text-left animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 max-w-fit shadow-sm border border-blue-200/20">
            <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-spin" style={{ animationDuration: '4s' }} />
            Empower Your Academic Projects
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-none bg-gradient-to-br from-slate-900 to-slate-700 dark:from-slate-50 dark:to-slate-300 bg-clip-text text-transparent">
            Centralized Academic Workspace for Teams
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed font-medium">
            Eliminate communication clutter. Centralize tasks, group chats, milestones, file uploads, and study metrics in one high-performance dashboard designed specifically for students.
          </p>

          {/* Module Feature Grid */}
          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <div className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/55 dark:bg-slate-900/50 backdrop-blur-sm hover:scale-[1.02] transition-all hover:shadow-sm duration-300">
              <CheckSquare className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Kanban Board</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Drag & drop tasks across stages.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/55 dark:bg-slate-900/50 backdrop-blur-sm hover:scale-[1.02] transition-all hover:shadow-sm duration-300">
              <Calendar className="w-5 h-5 text-emerald-500 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Deadlines Calendar</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Track homework, midterms, and team targets.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/55 dark:bg-slate-900/50 backdrop-blur-sm hover:scale-[1.02] transition-all hover:shadow-sm duration-300">
              <MessageSquare className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Live Collaboration</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Project-specific chat channels with emoji & mentions.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/55 dark:bg-slate-900/50 backdrop-blur-sm hover:scale-[1.02] transition-all hover:shadow-sm duration-300">
              <Clock className="w-5 h-5 text-rose-500 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Pomodoro Study Timer</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Track and build personal focus metrics.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Form */}
        <div className="lg:col-span-5 w-full flex justify-center animate-floating">
          <div className="w-full max-w-[450px] p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300 glow-shadow">
            
            {/* Form Headers */}
            <div className="flex gap-4 mb-8 border-b border-slate-200 dark:border-slate-800 pb-4">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
                className={`flex-1 pb-2 font-bold text-center border-b-2 transition-all duration-300 active:scale-95 ${isLogin ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
                className={`flex-1 pb-2 font-bold text-center border-b-2 transition-all duration-300 active:scale-95 ${!isLogin ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl border border-red-200/50 bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-semibold flex items-center gap-2 animate-fade-in">
                <Shield className="w-4 h-4 shrink-0 animate-pulse" />
                <span className="text-left">{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 rounded-xl border border-emerald-200/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-semibold text-left animate-fade-in">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              {!isLogin && (
                <>
                  <div className="flex flex-col gap-2 text-left animate-fade-in">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ahmed Khan"
                      required
                      className="px-4 py-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold"
                    />
                  </div>
                  <div className="flex flex-col gap-2 text-left animate-fade-in">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="ahmed_khan"
                      required
                      className="px-4 py-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-2 text-left">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {isLogin ? 'Email or Username' : 'Email Address'}
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isLogin ? "ahmed@example.com or ahmed_khan" : "ahmed@example.com"}
                  required
                  className="px-4 py-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold"
                />
              </div>

              {/* Password field with Visibility Toggler */}
              <div className="flex flex-col gap-2 text-left">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 pr-10 py-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password field & Password strength indicators for SignUp */}
              {!isLogin && (
                <div className="flex flex-col gap-3 text-left animate-fade-in">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className={`w-full px-4 pr-10 py-3 text-xs rounded-xl border bg-white/50 dark:bg-slate-950/50 focus:ring-1 outline-none transition-all font-semibold ${
                          confirmPassword.length === 0
                            ? 'border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-blue-500'
                            : isPasswordMatch
                              ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all p-1"
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Live Password Rules Card */}
                  <div className="p-3.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col gap-2 text-[11px] font-semibold">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">Password Checklist</span>
                    <div className="flex items-center gap-2">
                      <span className={`p-0.5 rounded-full ${isPasswordLong ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                        {isPasswordLong ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      </span>
                      <span className={isPasswordLong ? 'text-slate-700 dark:text-slate-350' : 'text-slate-400'}>
                        At least 8 characters
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`p-0.5 rounded-full ${isPasswordMatch ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                        {isPasswordMatch ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      </span>
                      <span className={isPasswordMatch ? 'text-slate-700 dark:text-slate-350' : 'text-slate-400'}>
                        Confirm password matches new password
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (!isLogin && (!isPasswordLong || !isPasswordMatch))}
                className="mt-2 py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-xs text-center text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
              Secured with SHA-256 bcrypt & JWT
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
