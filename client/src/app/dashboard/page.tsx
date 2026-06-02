"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import {
  LayoutDashboard, FolderKanban, ListTodo, Calendar as CalendarIcon,
  LineChart, Bell, User, Settings, LogOut, Clock, Plus, Search,
  Menu, Sun, Moon, CheckCircle2, AlertCircle, Play, Pause, RotateCcw,
  UserCheck, FileText, MessageSquare, BookOpen, CheckSquare, X,
  Trash2, ShieldCheck, Mail, Send, SendHorizontal, Edit3, Check, HelpCircle,
  FileUp, Download, ChevronRight, File, Filter, Loader2, Award
} from 'lucide-react';

const socket = io('http://localhost:5000', {
  autoConnect: false
});

export default function Dashboard() {
  const router = useRouter();
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState<any>(null);
  
  // Sidebar open states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  // Main view state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'tasks' | 'calendar' | 'analytics' | 'settings'>('dashboard');

  // API Data
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [projectFiles, setProjectFiles] = useState<any[]>([]);
  const [fileUploadLoading, setFileUploadLoading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [focusHours, setFocusHours] = useState(0.0);
  
  // Global / Unified Kanban Tasks View States
  const [globalTasks, setGlobalTasks] = useState<any[]>([]);
  const [globalTasksLoading, setGlobalTasksLoading] = useState(false);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL');
  const [tasksSearchQuery, setTasksSearchQuery] = useState('');

  // Calendar view navigation
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date(2026, 5, 1)); // Default to June 2026 for consistency with specs
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(15); // Default selected day
  
  // Real-Time Chat States
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Modals & Popovers
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);

  // Form Fields: Projects
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projCat, setProjCat] = useState('');
  const [projVis, setProjVis] = useState<'PRIVATE' | 'TEAM'>('TEAM');
  const [projStart, setProjStart] = useState('');
  const [projDeadline, setProjDeadline] = useState('');
  
  // Form Fields: Tasks
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskEstHours, setTaskEstHours] = useState('');
  
  const [inviteUser, setInviteUser] = useState('');
  
  // Detail View Sub-Tab
  const [detailTab, setDetailTab] = useState<'tasks' | 'chat' | 'files' | 'members' | 'settings'>('tasks');

  // Settings State Form
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileUniversity, setProfileUniversity] = useState('');
  const [profileDepartment, setProfileDepartment] = useState('');
  const [profileSemester, setProfileSemester] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Pomodoro States
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerType, setTimerType] = useState('FOCUS'); // FOCUS, SHORT_BREAK, LONG_BREAK

  // Toast / Status Message
  const [feedback, setFeedback] = useState({ text: '', type: '' });

  // Init Data Fetches
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token) {
      router.push('/');
      return;
    }

    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setProfileName(parsedUser.fullName || '');
      setProfileBio(parsedUser.bio || '');
      setProfileUniversity(parsedUser.university || '');
      setProfileDepartment(parsedUser.department || '');
      setProfileSemester(parsedUser.semester || '');
    }

    fetchProfile(token);
    fetchProjects(token);
    fetchPendingInvites(token);
    fetchStudyStats(token);

    if (document.documentElement.classList.contains('dark')) {
      setTheme('dark');
    }
  }, [router]);

  // Load global tasks when entering tabs that require them
  useEffect(() => {
    if (activeTab === 'tasks' || activeTab === 'calendar' || activeTab === 'dashboard' || activeTab === 'analytics') {
      fetchGlobalTasks();
    }
  }, [activeTab, projects]);

  // Live Sockets & Messaging Room Bindings
  useEffect(() => {
    if (selectedProject) {
      socket.connect();
      socket.emit('join-project', selectedProject.id);

      // Fetch messages history
      const token = localStorage.getItem('token');
      fetch(`http://localhost:5000/api/v1/projects/${selectedProject.id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMessages(data.messages);
        }
      })
      .catch(err => console.error('Failed to load messages', err));

      // Fetch project files
      fetchProjectFiles(selectedProject.id);

      // Listen for broadcasts
      socket.on('message-received', (newMessage: any) => {
        setMessages(prev => [...prev, newMessage]);
      });

      socket.on('task-created', (task: any) => {
        setSelectedProject((prev: any) => {
          if (!prev || prev.id !== task.projectId) return prev;
          return { ...prev, tasks: [...(prev.tasks || []), task] };
        });
        fetchGlobalTasks();
      });

      socket.on('task-updated', (updatedTask: any) => {
        setSelectedProject((prev: any) => {
          if (!prev || prev.id !== updatedTask.projectId) return prev;
          return {
            ...prev,
            tasks: (prev.tasks || []).map((t: any) => t.id === updatedTask.id ? updatedTask : t)
          };
        });
        fetchGlobalTasks();
      });

      socket.on('task-deleted', ({ taskId }) => {
        setSelectedProject((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: (prev.tasks || []).filter((t: any) => t.id !== taskId)
          };
        });
        fetchGlobalTasks();
      });

      socket.on('file-uploaded', (newFile: any) => {
        setProjectFiles(prev => [newFile, ...prev]);
      });

      socket.on('file-deleted', ({ fileId }) => {
        setProjectFiles(prev => prev.filter(f => f.id !== fileId));
      });

      return () => {
        socket.emit('leave-project', selectedProject.id);
        socket.off('message-received');
        socket.off('task-created');
        socket.off('task-updated');
        socket.off('task-deleted');
        socket.off('file-uploaded');
        socket.off('file-deleted');
        socket.disconnect();
      };
    }
  }, [selectedProject]);

  // Scroll Chat to bottom
  useEffect(() => {
    if (detailTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, detailTab]);

  // Alert Banner Helper
  const showFeedback = (text: string, type: 'success' | 'error') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback({ text: '', type: '' }), 4000);
  };

  const fetchProfile = async (token: string) => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Sync setting form
        setProfileName(data.user.fullName || '');
        setProfileBio(data.user.bio || '');
        setProfileUniversity(data.user.university || '');
        setProfileDepartment(data.user.department || '');
        setProfileSemester(data.user.semester || '');
      } else {
        handleLogout();
      }
    } catch (err) {
      if (!user) {
        setUser({ fullName: 'Academic User', username: 'student', email: 'student@example.com' });
      }
    }
  };

  const fetchProjects = async (token: string) => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error('Fetch projects failed', err);
    }
  };

  const fetchProjectDetails = async (projectId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:5000/api/v1/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedProject(data.project);
      } else {
        showFeedback(data.message, 'error');
      }
    } catch (err) {
      showFeedback('Could not load project details', 'error');
    }
  };

  const fetchPendingInvites = async (token: string) => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/invites/pending', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPendingInvites(data.invitations);
      }
    } catch (err) {
      console.error('Fetch invites failed', err);
    }
  };

  const fetchStudyStats = async (token: string) => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/study/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setFocusHours(data.focusHours);
      }
    } catch (err) {
      console.error('Fetch focus hours stats failed', err);
    }
  };

  // Aggregated Tasks Retrieval
  const fetchGlobalTasks = async () => {
    const token = localStorage.getItem('token');
    if (!token || projects.length === 0) return;
    setGlobalTasksLoading(true);
    try {
      const fetchPromises = projects.map(p => 
        fetch(`http://localhost:5000/api/v1/projects/${p.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json())
      );
      const results = await Promise.all(fetchPromises);
      let allTasks: any[] = [];
      results.forEach(res => {
        if (res.success && res.project.tasks) {
          const tasksWithProj = res.project.tasks.map((t: any) => ({
            ...t,
            projectName: res.project.name,
            projectCategory: res.project.category
          }));
          allTasks = [...allTasks, ...tasksWithProj];
        }
      });
      setGlobalTasks(allTasks);
    } catch (err) {
      console.error('Failed to load global tasks', err);
    } finally {
      setGlobalTasksLoading(false);
    }
  };

  // Files Tab Handlers
  const fetchProjectFiles = async (projectId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:5000/api/v1/projects/${projectId}/files`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setProjectFiles(data.files);
      }
    } catch (err) {
      console.error('Failed to load files', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedProject) return;
    const file = e.target.files[0];
    
    const token = localStorage.getItem('token');
    if (!token) return;

    const formData = new FormData();
    formData.append('file', file);

    setFileUploadLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/v1/projects/${selectedProject.id}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showFeedback('File uploaded successfully!', 'success');
        fetchProjectFiles(selectedProject.id);
        setFileInputKey(prev => prev + 1);
      } else {
        showFeedback(data.message || 'File upload failed', 'error');
      }
    } catch (err) {
      showFeedback('Connection error during upload', 'error');
    } finally {
      setFileUploadLoading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!selectedProject) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    if (!confirm('Are you sure you want to permanently delete this file?')) return;

    try {
      const res = await fetch(`http://localhost:5000/api/v1/projects/${selectedProject.id}/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showFeedback('File deleted successfully', 'success');
        fetchProjectFiles(selectedProject.id);
      } else {
        showFeedback(data.message || 'Delete failed', 'error');
      }
    } catch (err) {
      showFeedback('Connection error during delete', 'error');
    }
  };

  const formatBytes = (bytes: string | number) => {
    const num = typeof bytes === 'string' ? parseInt(bytes) : bytes;
    if (isNaN(num) || num === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return parseFloat((num / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Profile Edit Settings handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return;

    setSavingProfile(true);
    try {
      const res = await fetch('http://localhost:5000/api/v1/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: profileName,
          bio: profileBio,
          university: profileUniversity,
          department: profileDepartment,
          semester: profileSemester
        })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback('Profile updated successfully!', 'success');
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        showFeedback(data.message || 'Profile update failed', 'error');
      }
    } catch (err) {
      showFeedback('Connection error during profile update', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Actions: Projects & Invites
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch('http://localhost:5000/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: projName,
          description: projDesc,
          category: projCat,
          visibility: projVis,
          startDate: projStart || undefined,
          deadline: projDeadline || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        showFeedback('Project created successfully!', 'success');
        setCreateModalOpen(false);
        setProjName('');
        setProjDesc('');
        setProjCat('');
        setProjStart('');
        setProjDeadline('');
        fetchProjects(token);
      } else {
        showFeedback(data.message || 'Validation failed', 'error');
      }
    } catch (err) {
      showFeedback('Connection error, could not create project', 'error');
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:5000/api/v1/projects/${selectedProject.id}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ emailOrUsername: inviteUser })
      });

      const data = await res.json();
      if (res.ok) {
        showFeedback('Invitation sent successfully!', 'success');
        setInviteUser('');
        setInviteModalOpen(false);
      } else {
        showFeedback(data.message || 'Invitation failed', 'error');
      }
    } catch (err) {
      showFeedback('Connection error', 'error');
    }
  };

  const handleRespondInvite = async (inviteId: string, action: 'ACCEPTED' | 'REJECTED') => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:5000/api/v1/invites/${inviteId}/respond`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      const data = await res.json();
      if (data.success) {
        showFeedback(`Invitation ${action.toLowerCase()}!`, 'success');
        fetchPendingInvites(token);
        fetchProjects(token);
      } else {
        showFeedback(data.message, 'error');
      }
    } catch (err) {
      showFeedback('Connection error', 'error');
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!selectedProject) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:5000/api/v1/projects/${selectedProject.id}/members/${targetUserId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showFeedback('Member removed from project', 'success');
        fetchProjectDetails(selectedProject.id);
      } else {
        showFeedback(data.message, 'error');
      }
    } catch (err) {
      showFeedback('Connection error', 'error');
    }
  };

  const handleUpdateRole = async (targetUserId: string, role: 'OWNER' | 'MEMBER' | 'VIEWER') => {
    if (!selectedProject) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:5000/api/v1/projects/${selectedProject.id}/members/${targetUserId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback('Role updated successfully', 'success');
        fetchProjectDetails(selectedProject.id);
      } else {
        showFeedback(data.message, 'error');
      }
    } catch (err) {
      showFeedback('Connection error', 'error');
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    if (!confirm('Are you absolutely sure you want to permanently delete this project?')) return;

    try {
      const res = await fetch(`http://localhost:5000/api/v1/projects/${selectedProject.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showFeedback('Project deleted successfully', 'success');
        setSelectedProject(null);
        fetchProjects(token);
      } else {
        showFeedback(data.message, 'error');
      }
    } catch (err) {
      showFeedback('Connection error', 'error');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedProject) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const content = messageInput;
    setMessageInput('');

    try {
      const res = await fetch(`http://localhost:5000/api/v1/projects/${selectedProject.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });
      const data = await res.json();
      if (!data.success) {
        showFeedback(data.message || 'Failed to send message', 'error');
      }
    } catch (err) {
      showFeedback('Message send connection error', 'error');
    }
  };

  // Actions: Tasks CRUD
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch('http://localhost:5000/api/v1/projects/' + selectedProject.id + '/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDesc,
          priority: taskPriority,
          assignedTo: taskAssignee || undefined,
          dueDate: taskDueDate || undefined,
          estimatedHours: taskEstHours ? parseInt(taskEstHours) : undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        showFeedback('Task added successfully!', 'success');
        setTaskTitle('');
        setTaskDesc('');
        setTaskPriority('MEDIUM');
        setTaskAssignee('');
        setTaskDueDate('');
        setTaskEstHours('');
        setAddTaskModalOpen(false);
        fetchProjectDetails(selectedProject.id);
      } else {
        showFeedback(data.message || 'Failed to create task', 'error');
      }
    } catch (err) {
      showFeedback('Connection error', 'error');
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string, projId?: string) => {
    const targetProjId = projId || selectedProject?.id;
    if (!targetProjId) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:5000/api/v1/projects/${targetProjId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();
      if (data.success) {
        showFeedback('Task status updated', 'success');
        if (selectedProject && selectedProject.id === targetProjId) {
          fetchProjectDetails(selectedProject.id);
        } else {
          fetchGlobalTasks();
        }
      } else {
        showFeedback(data.message, 'error');
      }
    } catch (err) {
      showFeedback('Connection error', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string, projId?: string) => {
    const targetProjId = projId || selectedProject?.id;
    if (!targetProjId) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const res = await fetch(`http://localhost:5000/api/v1/projects/${targetProjId}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showFeedback('Task deleted successfully', 'success');
        if (selectedProject && selectedProject.id === targetProjId) {
          fetchProjectDetails(selectedProject.id);
        } else {
          fetchGlobalTasks();
        }
      } else {
        showFeedback(data.message, 'error');
      }
    } catch (err) {
      showFeedback('Connection error', 'error');
    }
  };

  // Log Pomodoro Session
  const logFocusSession = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch('http://localhost:5000/api/v1/study', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          durationMinutes: timerType === 'FOCUS' ? 25 : timerType === 'SHORT_BREAK' ? 5 : 15,
          sessionType: timerType,
          startedAt: new Date(Date.now() - (timerType === 'FOCUS' ? 25 : timerType === 'SHORT_BREAK' ? 5 : 15) * 60 * 1000).toISOString(),
          endedAt: new Date().toISOString()
        })
      });
      
      const data = await res.json();
      if (data.success) {
        showFeedback(`${timerType} log saved!`, 'success');
        fetchStudyStats(token);
      }
    } catch (err) {
      console.error('Failed to log Pomodoro focus session', err);
    }
  };

  const resetTimer = () => {
    setTimerActive(false);
    setTimerSeconds(0);
    if (timerType === 'FOCUS') setTimerMinutes(25);
    else if (timerType === 'SHORT_BREAK') setTimerMinutes(5);
    else setTimerMinutes(15);
  };

  const handleTimerTypeChange = (type: string) => {
    setTimerType(type);
    setTimerActive(false);
    setTimerSeconds(0);
    if (type === 'FOCUS') setTimerMinutes(25);
    else if (type === 'SHORT_BREAK') setTimerMinutes(5);
    else setTimerMinutes(15);
  };

  // Pomodoro timer loop hook
  useEffect(() => {
    let interval: any = null;
    if (timerActive) {
      interval = setInterval(() => {
        if (timerSeconds > 0) {
          setTimerSeconds(timerSeconds - 1);
        } else if (timerMinutes > 0) {
          setTimerMinutes(timerMinutes - 1);
          setTimerSeconds(59);
        } else {
          setTimerActive(false);
          logFocusSession();
          resetTimer();
        }
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive, timerMinutes, timerSeconds, timerType]);

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Filter Tasks by Columns in Single Project
  const getTasksByStatus = (statuses: string[]) => {
    if (!selectedProject || !selectedProject.tasks) return [];
    return selectedProject.tasks.filter((t: any) => statuses.includes(t.status));
  };

  const getProfileCompletionPct = () => {
    if (!user) return 0;
    let filledFields = 0;
    if (user.fullName && user.fullName.trim() !== '') filledFields++;
    if (user.bio && user.bio.trim() !== '') filledFields++;
    if (user.university && user.university.trim() !== '') filledFields++;
    if (user.department && user.department.trim() !== '') filledFields++;
    if (user.semester && user.semester.trim() !== '') filledFields++;
    return Math.round((filledFields / 5) * 100);
  };

  // Filter Tasks by Columns in Global Unified Board
  const getGlobalTasksByStatus = (statuses: string[]) => {
    return globalTasks.filter((task: any) => {
      const matchStatus = statuses.includes(task.status);
      const matchProject = selectedProjectFilter === 'ALL' || task.projectId === selectedProjectFilter;
      const matchSearch = task.title.toLowerCase().includes(tasksSearchQuery.toLowerCase()) || 
                          (task.description && task.description.toLowerCase().includes(tasksSearchQuery.toLowerCase()));
      return matchStatus && matchProject && matchSearch;
    });
  };

  // Dynamic Calendar deadline calculations
  const getCalendarDays = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // day of week offset
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Pad previous month offset
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, currentMonth: false });
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, currentMonth: true });
    }
    return days;
  };

  const getDeadlinesForDay = (dayNum: number) => {
    const targetDateStr = `${currentCalendarDate.getFullYear()}-${String(currentCalendarDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    
    const dayTasks = globalTasks.filter(t => t.dueDate && t.dueDate.split('T')[0] === targetDateStr);
    const dayProjects = projects.filter(p => p.deadline && p.deadline.split('T')[0] === targetDateStr);

    return { tasks: dayTasks, projects: dayProjects };
  };

  // Custom Sidebar Nav Button helper
  const renderSidebarBtn = (tabKey: typeof activeTab, IconComponent: any, label: string) => {
    const isSelected = activeTab === tabKey && !selectedProject;
    return (
      <button
        onClick={() => { setSelectedProject(null); setActiveTab(tabKey); setMobileSidebarOpen(false); }}
        className={`flex items-center gap-4 px-4 py-3 rounded-xl font-bold transition-all duration-200 active:scale-95 w-full text-left ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
      >
        <IconComponent className="w-5 h-5 shrink-0" />
        {(sidebarOpen || mobileSidebarOpen) && <span>{label}</span>}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex transition-colors duration-300">
      
      {/* Toast popup */}
      {feedback.text && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl border text-xs font-bold flex items-center gap-3 shadow-lg ${feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'}`}>
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* SIDEBAR: Desktop view */}
      <aside className={`hidden lg:flex border-r border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 transition-all duration-300 flex-col justify-between shrink-0 sticky top-0 h-screen z-40 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div>
          <div className="h-16 px-6 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center gap-3 overflow-hidden">
            <BookOpen className="w-7 h-7 text-blue-600 dark:text-blue-500 shrink-0" />
            {sidebarOpen && <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-500 dark:to-emerald-400 bg-clip-text text-transparent">StudyManager</span>}
          </div>

          <nav className="p-4 flex flex-col gap-1">
            {renderSidebarBtn('dashboard', LayoutDashboard, 'Dashboard')}
            {renderSidebarBtn('projects', FolderKanban, 'Projects')}
            {renderSidebarBtn('tasks', ListTodo, 'Tasks Board')}
            {renderSidebarBtn('calendar', CalendarIcon, 'Deadlines')}
            {renderSidebarBtn('analytics', LineChart, 'Analytics')}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col gap-1">
          {renderSidebarBtn('settings', Settings, 'Settings')}
          <button onClick={handleLogout} className="flex items-center gap-4 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold transition-all duration-200 active:scale-95 w-full text-left">
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* SIDEBAR: Mobile Overlay Drawer view */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          
          <aside className="relative flex flex-col justify-between w-64 max-w-xs h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 shadow-xl z-50 animate-slide-in">
            <div>
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-500" />
                  <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-500 dark:to-emerald-400 bg-clip-text text-transparent">StudyManager</span>
                </div>
                <button onClick={() => setMobileSidebarOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex flex-col gap-1.5">
                {renderSidebarBtn('dashboard', LayoutDashboard, 'Dashboard')}
                {renderSidebarBtn('projects', FolderKanban, 'Projects')}
                {renderSidebarBtn('tasks', ListTodo, 'Tasks Board')}
                {renderSidebarBtn('calendar', CalendarIcon, 'Deadlines')}
                {renderSidebarBtn('analytics', LineChart, 'Analytics')}
              </nav>
            </div>

            <div className="flex flex-col gap-1">
              {renderSidebarBtn('settings', Settings, 'Settings')}
              <button onClick={handleLogout} className="flex items-center gap-4 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold transition-all w-full text-left">
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        
        {/* Header */}
        <header className="h-16 px-4 md:px-6 border-b border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-all hidden lg:block active:scale-90">
              <Menu className="w-5 h-5" />
            </button>
            <button onClick={() => setMobileSidebarOpen(true)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-all lg:hidden active:scale-90">
              <Menu className="w-5 h-5" />
            </button>
            
            {selectedProject && (
              <span className="text-[10px] md:text-xs font-bold bg-slate-100 dark:bg-slate-800 py-1 px-2.5 rounded-lg flex items-center gap-1.5">
                Focus: <span className="text-blue-500 truncate max-w-[120px] md:max-w-xs">{selectedProject.name}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <button
                onClick={() => setNotifPopoverOpen(!notifPopoverOpen)}
                className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 relative text-slate-500 transition-all active:scale-95"
              >
                <Bell className="w-4 h-4" />
                {pendingInvites.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
              
              {notifPopoverOpen && (
                <div className="absolute right-0 mt-3 w-80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 text-left">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="font-bold text-xs">Academic Invites</h4>
                    <span className="text-[10px] text-slate-400">{pendingInvites.length} Pending</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto flex flex-col gap-3 mt-3">
                    {pendingInvites.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No pending invitations</p>
                    ) : (
                      pendingInvites.map(inv => (
                        <div key={inv.id} className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50 bg-slate-50/20 flex flex-col gap-2">
                          <p className="text-[11px] leading-tight text-slate-600 dark:text-slate-300 font-semibold">
                            <span className="font-bold text-slate-900 dark:text-slate-100">@{inv.sender.username}</span> invited you to <span className="font-bold text-blue-500">{inv.project.name}</span>
                          </p>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleRespondInvite(inv.id, 'REJECTED')}
                              className="px-2 py-1 rounded-lg border text-[10px] font-bold text-rose-500 border-rose-500/20 hover:bg-rose-500/10 transition-all"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => handleRespondInvite(inv.id, 'ACCEPTED')}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition-all"
                            >
                              Accept
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={toggleTheme} className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-all active:scale-95">
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            <div className="flex items-center gap-2 pl-3 border-l border-slate-200/60 dark:border-slate-800/60">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                {user.fullName ? user.fullName[0] : 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold leading-tight truncate max-w-[80px]">{user.fullName ? user.fullName.split(' ')[0] : 'User'}</p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-none">@{user.username}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Workspace views routing */}
        <main className="p-4 md:p-6 flex-1 overflow-y-auto max-w-7xl mx-auto w-full flex flex-col gap-6 md:gap-8 transition-all duration-300">
          
          {selectedProject ? (
            /* PROJECT MODULE INTERACTIVE SUB-VIEWS */
            <div className="flex flex-col gap-6 w-full animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 text-left">
                <div>
                  <button
                    onClick={() => setSelectedProject(null)}
                    className="text-xs font-bold text-blue-500 mb-2 hover:underline flex items-center gap-1 active:scale-95"
                  >
                    ← Back to Projects
                  </button>
                  <h2 className="text-xl md:text-2xl font-extrabold tracking-tight flex items-center gap-3">
                    {selectedProject.name}
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 uppercase">
                      {selectedProject.myRole}
                    </span>
                  </h2>
                  <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-xl font-medium">{selectedProject.description || 'No description added.'}</p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setInviteModalOpen(true)}
                    className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5 text-blue-500" />
                    Invite Teammate
                  </button>
                </div>
              </div>

              {/* Sub-navigation tabs headers */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 overflow-x-auto scrollbar-none pb-0.5">
                {(['tasks', 'chat', 'files', 'members', 'settings'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`pb-3 text-xs md:text-sm font-bold border-b-2 capitalize transition-all duration-200 shrink-0 active:scale-95 ${detailTab === tab ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    {tab === 'tasks' ? 'Tasks Kanban' : tab === 'chat' ? 'Live Chat' : tab === 'files' ? 'Shared Files' : tab}
                  </button>
                ))}
              </div>

              {/* Kanban tab view */}
              {detailTab === 'tasks' && (
                <div className="flex flex-col gap-6 text-left animate-fade-in">
                  <div className="flex justify-between items-center">
                    <h3 className="font-extrabold text-sm md:text-base">Project Kanban board</h3>
                    <button
                      onClick={() => setAddTaskModalOpen(true)}
                      className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
                    >
                      Add Task
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    {/* Columns */}
                    {['To Do', 'Under Review', 'Completed'].map((columnLabel, index) => {
                      const mappingStatuses = 
                        index === 0 ? ['NOT_STARTED', 'IN_PROGRESS'] :
                        index === 1 ? ['UNDER_REVIEW'] : ['COMPLETED'];
                      const columnTasks = getTasksByStatus(mappingStatuses);

                      return (
                        <div key={columnLabel} className="p-4 rounded-3xl bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 min-h-[300px] transition-all duration-300">
                          <h4 className="font-bold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 px-2">{columnLabel} ({columnTasks.length})</h4>
                          <div className="flex flex-col gap-3">
                            {columnTasks.length === 0 ? (
                              <p className="text-xs text-slate-400 text-center py-8">No tasks here</p>
                            ) : (
                              columnTasks.map((task: any) => (
                                <div key={task.id} className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-3 hover:scale-[1.02] hover:shadow transition-all duration-205">
                                  <div>
                                    <div className="flex justify-between items-center mb-1">
                                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-lg uppercase ${task.priority === 'HIGH' ? 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400' : task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                                        {task.priority}
                                      </span>
                                      <button onClick={() => handleDeleteTask(task.id)} className="text-slate-400 hover:text-rose-500 transition-all p-1 active:scale-90">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <h5 className={`font-bold text-xs leading-snug ${index === 2 ? 'line-through text-slate-400' : ''}`}>{task.title}</h5>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 line-clamp-2 font-semibold">{task.description || 'No description added.'}</p>
                                  </div>

                                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60">
                                    <span className="text-[10px] text-slate-400 leading-none font-bold">
                                      {task.assignee ? `@${task.assignee.username}` : 'Unassigned'}
                                    </span>
                                    <select
                                      value={task.status}
                                      onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                                      className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] font-bold focus:outline-none cursor-pointer"
                                    >
                                      <option value="NOT_STARTED">To Do</option>
                                      <option value="IN_PROGRESS">In Progress</option>
                                      <option value="UNDER_REVIEW">Review</option>
                                      <option value="COMPLETED">Complete</option>
                                    </select>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Live Chat sub-tab view */}
              {detailTab === 'chat' && (
                <div className="flex flex-col h-[450px] border border-slate-200/60 dark:border-slate-800/60 rounded-3xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm animate-fade-in">
                  <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
                    {messages.length === 0 ? (
                      <div className="my-auto text-center flex flex-col items-center gap-2 text-slate-400">
                        <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                        <p className="text-xs">No messages yet. Send a greeting in the chat room!</p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isSelf = msg.sender.id === user.id;
                        return (
                          <div key={msg.id} className={`flex items-start gap-3 max-w-[85%] ${isSelf ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {msg.sender.fullName ? msg.sender.fullName[0] : 'U'}
                            </div>
                            <div className="flex flex-col gap-1 text-left">
                              <span className={`text-[10px] text-slate-400 font-bold ${isSelf ? 'text-right' : ''}`}>
                                {msg.sender.fullName} <span className="font-normal text-slate-300 dark:text-slate-600">• {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </span>
                              <div className={`p-3 rounded-2xl text-xs font-semibold ${isSelf ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'}`}>
                                {msg.content}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 flex gap-2 items-center">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold"
                    />
                    <button
                      type="submit"
                      className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm shrink-0 active:scale-90"
                    >
                      <SendHorizontal className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* Shared Files manager sub-tab */}
              {detailTab === 'files' && (
                <div className="p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm text-left flex flex-col gap-6 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="font-extrabold text-base mb-1">Study Modules Library</h3>
                      <p className="text-xs text-slate-400">Upload and access coursework files, PDFs, lecture transcripts, and references.</p>
                    </div>

                    {/* Drag-n-drop file panel */}
                    <div className="relative shrink-0">
                      <input
                        key={fileInputKey}
                        type="file"
                        id="file-upload-input"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={fileUploadLoading}
                      />
                      <label
                        htmlFor="file-upload-input"
                        className={`py-2 px-4 rounded-xl border text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer hover:shadow-md border-blue-500/20 text-blue-600 bg-blue-500/5 ${fileUploadLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {fileUploadLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <FileUp className="w-3.5 h-3.5" />
                            <span>Upload File</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Files table */}
                  <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden shadow-inner bg-slate-50/20">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-semibold text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100/50 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 border-b border-slate-200/50 dark:border-slate-800/50 uppercase tracking-wider text-[10px]">
                            <th className="p-4">Name</th>
                            <th className="p-4">Size</th>
                            <th className="p-4">Uploaded By</th>
                            <th className="p-4">Date Added</th>
                            <th className="p-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {projectFiles.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400 font-semibold">
                                <File className="w-8 h-8 text-slate-350 dark:text-slate-700 mx-auto mb-2" />
                                No files uploaded yet. Add lecture slides, homework PDF, or codes!
                              </td>
                            </tr>
                          ) : (
                            projectFiles.map(file => (
                              <tr key={file.id} className="hover:bg-slate-100/30 dark:hover:bg-slate-900/30 transition-all">
                                <td className="p-4 font-bold text-slate-800 dark:text-slate-100">
                                  <div className="flex items-center gap-2.5 truncate max-w-[200px] md:max-w-xs" title={file.fileName}>
                                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                    <span className="truncate">{file.fileName}</span>
                                  </div>
                                </td>
                                <td className="p-4 text-slate-500 dark:text-slate-450">{formatBytes(file.fileSize)}</td>
                                <td className="p-4 text-slate-500 dark:text-slate-450">@{file.user?.username || 'user'}</td>
                                <td className="p-4 text-slate-400">{new Date(file.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                <td className="p-4">
                                  <div className="flex gap-2 justify-center">
                                    <a
                                      href={`http://localhost:5000${file.fileUrl}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all active:scale-90"
                                      title="Download File"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                    {(selectedProject.myRole === 'OWNER' || file.uploadedBy === user.id) && (
                                      <button
                                        onClick={() => handleDeleteFile(file.id)}
                                        className="p-1.5 rounded-lg border border-rose-200/50 hover:bg-rose-500/10 text-rose-500 transition-all active:scale-90"
                                        title="Delete File"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Members sub-tab view */}
              {detailTab === 'members' && (
                <div className="p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm text-left flex flex-col gap-6 animate-fade-in">
                  <div>
                    <h3 className="font-extrabold text-base mb-1">Collaboration Team</h3>
                    <p className="text-xs text-slate-400">View team privileges and assign role hierarchy.</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {selectedProject.members?.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/20">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                            {m.user.fullName ? m.user.fullName[0] : 'U'}
                          </div>
                          <div>
                            <p className="text-xs font-bold">{m.user.fullName}</p>
                            <p className="text-[10px] text-slate-400">@{m.user.username} • {m.user.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {selectedProject.myRole === 'OWNER' && m.user.id !== user.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={m.role}
                                onChange={(e) => handleUpdateRole(m.user.id, e.target.value as any)}
                                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none cursor-pointer"
                              >
                                <option value="OWNER">Owner</option>
                                <option value="MEMBER">Member</option>
                                <option value="VIEWER">Viewer</option>
                              </select>
                              <button
                                onClick={() => handleRemoveMember(m.user.id)}
                                className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all active:scale-90"
                                title="Remove User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-slate-400 capitalize">{m.role.toLowerCase()}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Settings sub-tab view */}
              {detailTab === 'settings' && (
                <div className="p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm text-left flex flex-col gap-6 animate-fade-in">
                  <div>
                    <h3 className="font-extrabold text-base text-rose-500 mb-1">Danger Zone</h3>
                    <p className="text-xs text-slate-400">Destructive options for managing this repository.</p>
                  </div>

                  <div className="border border-red-500/30 rounded-2xl p-5 bg-red-500/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-sm">Delete Project</h4>
                      <p className="text-xs text-slate-400 mt-1 font-medium">Deleting this repository will wipe clean all tasks, chats, lists and files.</p>
                    </div>
                    {selectedProject.myRole === 'OWNER' ? (
                      <button
                        onClick={handleDeleteProject}
                        className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm shrink-0 active:scale-95"
                      >
                        Delete Project
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-rose-500 bg-rose-500/10 py-1 px-3 rounded-lg">Owner Only Action</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'projects' ? (
            /* VIEW: PROJECTS GRID LIST VIEW */
            <div className="flex flex-col gap-6 animate-fade-in text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Active Repositories</h2>
                  <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 font-semibold">Coursework projects you own or collaborate on.</p>
                </div>
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 max-w-fit active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  New Project
                </button>
              </div>

              {projects.length === 0 ? (
                <div className="py-20 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <FolderKanban className="w-12 h-12 text-slate-350 dark:text-slate-700 mx-auto mb-4" />
                  <h3 className="font-extrabold text-base">No active projects</h3>
                  <p className="text-xs text-slate-450 mt-1 mb-6">Create a coursework module to get started.</p>
                  <button
                    onClick={() => setCreateModalOpen(true)}
                    className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                  >
                    Create Project
                  </button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((proj: any) => (
                    <div
                      key={proj.id}
                      onClick={() => fetchProjectDetails(proj.id)}
                      className="p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 hover:border-blue-500/50 bg-white dark:bg-slate-900 hover:scale-[1.02] transition-all duration-300 shadow-sm cursor-pointer hover:shadow-md flex flex-col justify-between min-h-[170px]"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <span className="px-2.5 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-extrabold uppercase tracking-wider">
                            {proj.category || 'Coursework'}
                          </span>
                          <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase">
                            {proj.myRole.toLowerCase()}
                          </span>
                        </div>
                        <h4 className="font-bold text-base leading-tight mt-1 text-slate-800 dark:text-slate-100">{proj.name}</h4>
                        <p className="text-xs text-slate-450 line-clamp-2 mt-0.5 font-semibold">{proj.description || 'No description added.'}</p>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex justify-between items-center text-[10px] text-slate-400 font-extrabold">
                        <span>{proj._count?.members || 1} Members</span>
                        <span>{proj._count?.tasks || 0} Tasks</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'tasks' ? (
            /* VIEW: UNIFIED WORKLOAD KANBAN BOARD */
            <div className="flex flex-col gap-6 animate-fade-in text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Unified Academic Workload</h2>
                  <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 font-semibold">Agile board tracking all deliverables across modules.</p>
                </div>

                {/* Filter and Search controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-450 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search tasks..."
                      value={tasksSearchQuery}
                      onChange={(e) => setTasksSearchQuery(e.target.value)}
                      className="pl-8 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 text-xs font-semibold focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <select
                      value={selectedProjectFilter}
                      onChange={(e) => setSelectedProjectFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="ALL">All Projects</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {globalTasksLoading ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-xs text-slate-400 font-bold uppercase">Collating task records...</span>
                </div>
              ) : projects.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 font-semibold">No active projects found. Create a project to start planning deliverables.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  {['To Do', 'Under Review', 'Completed'].map((columnLabel, index) => {
                    const statuses = index === 0 ? ['NOT_STARTED', 'IN_PROGRESS'] :
                                     index === 1 ? ['UNDER_REVIEW'] : ['COMPLETED'];
                    const columnTasks = getGlobalTasksByStatus(statuses);

                    return (
                      <div key={columnLabel} className="p-4 rounded-3xl bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 min-h-[350px] transition-all duration-300">
                        <h4 className="font-bold text-xs text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-4 px-2">{columnLabel} ({columnTasks.length})</h4>
                        <div className="flex flex-col gap-3">
                          {columnTasks.length === 0 ? (
                            <p className="text-xs text-slate-450 text-center py-8">No tasks here</p>
                          ) : (
                            columnTasks.map((task: any) => (
                              <div key={task.id} className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-850 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-3 hover:scale-[1.02] hover:shadow transition-all duration-200">
                                <div>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-450 px-2 py-0.5 rounded-lg uppercase tracking-wide truncate max-w-[120px]">
                                      {task.projectName}
                                    </span>
                                    <button onClick={() => handleDeleteTask(task.id, task.projectId)} className="text-slate-400 hover:text-rose-500 transition-all p-1 active:scale-90">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <h5 className={`font-bold text-xs leading-snug ${index === 2 ? 'line-through text-slate-400' : ''}`}>{task.title}</h5>
                                  <p className="text-[11px] text-slate-450 dark:text-slate-500 mt-1 line-clamp-2 font-semibold">{task.description || 'No description added.'}</p>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60">
                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${task.priority === 'HIGH' ? 'bg-red-100 text-red-650 dark:bg-red-950/30 dark:text-red-400' : task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-650 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                                    {task.priority}
                                  </span>
                                  
                                  <select
                                    value={task.status}
                                    onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value, task.projectId)}
                                    className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] font-bold focus:outline-none cursor-pointer"
                                  >
                                    <option value="NOT_STARTED">To Do</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="UNDER_REVIEW">Review</option>
                                    <option value="COMPLETED">Complete</option>
                                  </select>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'calendar' ? (
            /* VIEW: DYNAMIC AGENDA DEADLINES CALENDAR */
            <div className="flex flex-col gap-6 animate-fade-in text-left">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Academic Deadlines Calendar</h2>
                <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 font-semibold">Verify upcoming coursework exams, project deliveries, and milestones dynamically.</p>
              </div>

              <div className="grid lg:grid-cols-3 gap-6 items-start">
                
                {/* Simulated Month Agenda Grid */}
                <div className="lg:col-span-2 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-6">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-base text-blue-500">June 2026</span>
                    <span className="text-xs text-slate-400 font-bold uppercase">Month Agenda</span>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-2.5 min-h-[260px] text-xs font-bold text-slate-400 dark:text-slate-500">
                    {getCalendarDays().map((dayObj, index) => {
                      if (!dayObj.currentMonth) {
                        return <span key={`offset-${index}`} className="opacity-25 p-2 text-center">{dayObj.day}</span>;
                      }

                      const dl = getDeadlinesForDay(dayObj.day);
                      const hasTasks = dl.tasks.length > 0;
                      const hasProjects = dl.projects.length > 0;
                      const isSelected = selectedCalendarDay === dayObj.day;

                      return (
                        <button
                          key={`day-${dayObj.day}`}
                          onClick={() => setSelectedCalendarDay(dayObj.day)}
                          className={`p-2 rounded-xl relative flex flex-col items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold ${
                            isSelected 
                              ? 'bg-blue-600 text-white hover:bg-blue-700' 
                              : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          <span>{dayObj.day}</span>
                          {(hasTasks || hasProjects) && (
                            <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-white' : hasProjects ? 'bg-amber-500' : 'bg-blue-500'
                            }`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Deadlines Side Details Panel */}
                <div className="p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-5 text-left min-h-[300px]">
                  <div>
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400 mb-1">Due on June {selectedCalendarDay}, 2026</h3>
                    <p className="text-xs text-slate-450">Deliverables and targets due for submission today.</p>
                  </div>

                  <div className="flex flex-col gap-3 overflow-y-auto max-h-72">
                    {selectedCalendarDay ? (
                      (() => {
                        const { tasks, projects: dayProjs } = getDeadlinesForDay(selectedCalendarDay);
                        if (tasks.length === 0 && dayProjs.length === 0) {
                          return (
                            <div className="my-auto text-center py-10 text-slate-400">
                              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 animate-bounce" />
                              <p className="text-xs font-bold text-slate-400">Zero Academic Deadlines!</p>
                            </div>
                          );
                        }

                        return (
                          <>
                            {dayProjs.map((p: any) => (
                              <div key={`proj-dl-${p.id}`} className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/5 flex flex-col gap-1">
                                <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Project Module Target</span>
                                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">{p.name}</h4>
                                <p className="text-[10px] text-slate-450 truncate font-semibold">Category: {p.category}</p>
                              </div>
                            ))}
                            {tasks.map((t: any) => (
                              <div key={`task-dl-${t.id}`} className="p-3 rounded-xl border border-blue-500/25 bg-blue-500/5 flex flex-col gap-1">
                                <span className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Coursework Task</span>
                                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">{t.title}</h4>
                                <p className="text-[10px] text-slate-450 font-semibold truncate">Module: {t.projectName}</p>
                                <span className={`text-[8px] max-w-fit font-bold uppercase px-1.5 py-0.5 rounded ${t.priority === 'HIGH' ? 'bg-red-100 text-red-650 dark:bg-red-950/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>{t.priority}</span>
                              </div>
                            ))}
                          </>
                        );
                      })()
                    ) : (
                      <p className="text-xs text-slate-400 py-6 text-center">Click a calendar day with indicator dot to inspect deadlines.</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          ) : activeTab === 'analytics' ? (
            /* VIEW: ANALYTICS CHARTS VIEW */
            <div className="flex flex-col gap-6 animate-fade-in text-left">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Performance Analytics</h2>
                <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 font-semibold">Productivity metrics and Focus Hours logged dynamically.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-4">
                  <h3 className="font-bold text-sm">Focus Habits</h3>
                  <div className="flex items-center gap-4">
                    <Clock className="w-10 h-10 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-2xl font-black">{focusHours} Hours</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Total Cumulative focus sessions Logged</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-4">
                  <h3 className="font-bold text-sm">Module Task Completion Rates</h3>
                  <div className="flex flex-col gap-4">
                    {projects.length === 0 ? (
                      <p className="text-xs text-slate-450 py-4 text-center">No active projects found</p>
                    ) : (
                      projects.map(proj => {
                        const projTasks = globalTasks.filter(t => t.projectId === proj.id);
                        const completed = projTasks.filter(t => t.status === 'COMPLETED').length;
                        const total = projTasks.length;
                        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                        return (
                          <div key={proj.id} className="flex flex-col gap-1.5 text-xs font-semibold">
                            <div className="flex justify-between font-bold">
                              <span className="truncate max-w-[180px]">{proj.name}</span>
                              <span className="text-blue-500">{pct}% ({completed}/{total})</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-inner">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500" 
                                style={{ width: `${pct}%` }} 
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* VIEW: SETTINGS & EDIT PROFILE PREFERENCES VIEW */
            <div className="flex flex-col gap-6 animate-fade-in text-left">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Preferences & Settings</h2>
                <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 font-semibold">Configure your student profile parameters and system parameters.</p>
              </div>

              <div className="grid lg:grid-cols-3 gap-6 items-start">
                
                {/* Edit profile form */}
                <div className="lg:col-span-2 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-6">
                  <div>
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400 mb-1">Edit Student Profile</h3>
                    <p className="text-xs text-slate-450">These details will be shown to your classmates in project groups.</p>
                  </div>

                  <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 text-xs font-semibold">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Name</label>
                        <input
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="e.g. Ahmed Khan"
                          required
                          className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">University</label>
                        <input
                          type="text"
                          value={profileUniversity}
                          onChange={(e) => setProfileUniversity(e.target.value)}
                          placeholder="e.g. Stanford University"
                          className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Department/Major</label>
                        <input
                          type="text"
                          value={profileDepartment}
                          onChange={(e) => setProfileDepartment(e.target.value)}
                          placeholder="e.g. Computer Science"
                          className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Semester</label>
                        <input
                          type="text"
                          value={profileSemester}
                          onChange={(e) => setProfileSemester(e.target.value)}
                          placeholder="e.g. 6th Semester"
                          className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Biography / Core Skills</label>
                      <textarea
                        value={profileBio}
                        onChange={(e) => setProfileBio(e.target.value)}
                        placeholder="Say something about your study focus, skills or academic modules..."
                        rows={3}
                        className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold max-w-fit flex items-center gap-1.5 shadow-sm active:scale-95 text-xs self-end disabled:opacity-50"
                    >
                      {savingProfile ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Save Settings</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Preference card side widgets */}
                <div className="p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-6 text-left">
                  <div>
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400 mb-1">System Preferences</h3>
                    <p className="text-xs text-slate-450">Tweak theme overrides and view connections.</p>
                  </div>

                  <div className="flex flex-col gap-4 font-bold text-xs">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h4 className="font-bold text-sm">Theme Settings</h4>
                        <p className="text-[10px] text-slate-450 font-semibold">Toggle dark / light mode override</p>
                      </div>
                      <button
                        onClick={toggleTheme}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
                      >
                        {theme === 'light' ? 'Set Dark Mode' : 'Set Light Mode'}
                      </button>
                    </div>

                    <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h4 className="font-bold text-sm">Local Server Logs</h4>
                        <p className="text-[10px] text-slate-450 font-semibold">Server instance API root target location</p>
                      </div>
                      <span className="text-xs font-extrabold text-slate-400">http://localhost:5000</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* VIEW: DASHBOARD MAIN OVERVIEW */}
          {activeTab === 'dashboard' && !selectedProject && (
            <div className="flex flex-col gap-6 md:gap-8 animate-fade-in">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <div className="p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 flex flex-col gap-2 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Active Projects</span>
                  <div className="flex items-center gap-3">
                    <FolderKanban className="w-8 h-8 text-blue-500 animate-pulse" />
                    <span className="text-2xl md:text-3xl font-extrabold">{projects.length}</span>
                  </div>
                </div>
                
                <div className="p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 flex flex-col gap-2 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">My Total Tasks</span>
                  <div className="flex items-center gap-3">
                    <CheckSquare className="w-8 h-8 text-amber-500" />
                    <span className="text-2xl md:text-3xl font-extrabold text-amber-500">{globalTasks.length}</span>
                  </div>
                </div>
                
                <div className="p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 flex flex-col gap-2 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Focus Hours</span>
                  <div className="flex items-center gap-3">
                    <Clock className="w-8 h-8 text-emerald-500" />
                    <span className="text-2xl md:text-3xl font-extrabold text-emerald-500">{focusHours}</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 flex flex-col gap-2 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Teammates</span>
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-8 h-8 text-purple-500" />
                    <span className="text-2xl md:text-3xl font-extrabold text-purple-500">
                      {Math.max(1, projects.reduce((acc, curr) => acc + (curr._count?.members || 1), 0))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
                <div className="lg:col-span-2 flex flex-col gap-6 md:gap-8">
                  <div className="p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 flex flex-col gap-6 shadow-sm">
                    <div className="flex justify-between items-center">
                      <h3 className="font-extrabold text-sm md:text-lg">My Coursework Modules</h3>
                      <span onClick={() => setActiveTab('projects')} className="text-xs font-semibold text-blue-500 hover:underline cursor-pointer">View All</span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      {projects.length === 0 ? (
                        <p className="text-xs text-slate-450 text-center py-6 sm:col-span-2">No active projects yet. Add a new module repository!</p>
                      ) : (
                        projects.slice(0, 2).map((proj: any) => (
                          <div
                            key={proj.id}
                            onClick={() => fetchProjectDetails(proj.id)}
                            className="p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 hover:border-blue-500/50 bg-slate-50/50 dark:bg-slate-950/20 hover:scale-[1.02] transition-all flex flex-col gap-4 cursor-pointer text-left duration-200"
                          >
                            <div className="flex justify-between items-start">
                              <span className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                                {proj.category || 'Coursework'}
                              </span>
                              <span className="text-xs text-slate-450 capitalize font-semibold">
                                {proj.myRole.toLowerCase()}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 leading-tight">{proj.name}</h4>
                              <p className="text-xs text-slate-450 mt-1 line-clamp-2 font-semibold">{proj.description || 'No description added.'}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 flex flex-col gap-5 shadow-sm text-left">
                    <h3 className="font-extrabold text-sm md:text-lg">Upcoming Coursework Targets</h3>
                    <div className="flex flex-col gap-3.5">
                      {globalTasks.filter(t => t.status !== 'COMPLETED').length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6 font-semibold">No deadlines found. You are completely up to date!</p>
                      ) : (
                        globalTasks.filter(t => t.status !== 'COMPLETED').slice(0, 3).map(task => (
                          <div key={task.id} className="flex justify-between items-center p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/20">
                            <div className="text-left max-w-[200px] truncate">
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{task.title}</h4>
                              <p className="text-[10px] text-slate-455 font-semibold truncate">{task.projectName}</p>
                            </div>
                            
                            <div className="text-right flex items-center gap-3">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${task.priority === 'HIGH' ? 'bg-red-150 text-red-650' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                {task.priority}
                              </span>
                              {task.dueDate && (
                                <span className="text-[10px] text-slate-400 font-extrabold">
                                  {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-6 md:gap-8">
                  {/* Academic Profile Summary Card */}
                  <div className="p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 flex flex-col gap-5 shadow-sm text-left relative overflow-hidden">
                    <div className="flex justify-between items-center">
                      <h3 className="font-extrabold text-sm md:text-lg">Student Profile</h3>
                      <Award className="w-5 h-5 text-blue-500" />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg uppercase shadow-sm">
                        {user.fullName ? user.fullName[0] : 'U'}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{user.fullName || 'Academic User'}</h4>
                        <p className="text-[10px] text-slate-400 font-extrabold">@{user.username}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5 text-xs font-semibold text-slate-500 dark:text-slate-450 border-t border-b border-slate-100 dark:border-slate-800/60 py-3">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">University</span>
                        <span className="text-slate-800 dark:text-slate-200">{user.university || 'Not added yet'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Major & Semester</span>
                        <span className="text-slate-800 dark:text-slate-200">
                          {user.department || 'No major'} • {user.semester || 'No semester'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Bio</span>
                        <p className="text-slate-600 dark:text-slate-350 line-clamp-2 mt-0.5">{user.bio || 'No bio added yet.'}</p>
                      </div>
                    </div>

                    {/* Completion Percentage */}
                    <div className="flex flex-col gap-1.5 text-xs font-semibold">
                      <div className="flex justify-between font-bold">
                        <span>Profile Completion</span>
                        <span className="text-emerald-500">{getProfileCompletionPct()}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-450 rounded-full transition-all duration-500" 
                          style={{ width: `${getProfileCompletionPct()}%` }} 
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => { setActiveTab('settings'); setSelectedProject(null); }}
                      className="mt-1.5 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-blue-650 dark:text-blue-400 flex items-center justify-center gap-1.5 active:scale-95 transition-all w-full"
                    >
                      <span>Complete Profile Settings</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Pomodoro Focus Timer widget */}
                  <div className="p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 flex flex-col gap-6 items-center shadow-sm relative overflow-hidden">
                    <div className="w-full flex justify-between items-center">
                      <h3 className="font-extrabold text-sm md:text-lg">Study Timer Hub</h3>
                      <Clock className="w-4 h-4 text-slate-400" />
                    </div>

                    <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-950 gap-1 w-full border border-slate-200/20">
                      <button onClick={() => handleTimerTypeChange('FOCUS')} className={`flex-1 text-[11px] py-1.5 font-bold rounded-lg transition-all ${timerType === 'FOCUS' ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-500 border border-slate-200/10' : 'text-slate-400'}`}>Focus</button>
                      <button onClick={() => handleTimerTypeChange('SHORT_BREAK')} className={`flex-1 text-[11px] py-1.5 font-bold rounded-lg transition-all ${timerType === 'SHORT_BREAK' ? 'bg-white dark:bg-slate-900 shadow-sm text-emerald-500 border border-slate-200/10' : 'text-slate-400'}`}>Short Break</button>
                      <button onClick={() => handleTimerTypeChange('LONG_BREAK')} className={`flex-1 text-[11px] py-1.5 font-bold rounded-lg transition-all ${timerType === 'LONG_BREAK' ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-500 border border-slate-200/10' : 'text-slate-400'}`}>Long Break</button>
                    </div>

                    <div className="my-3 text-center">
                      <span className="text-5xl font-black tabular-nums tracking-tight">
                        {String(timerMinutes).padStart(2, '0')}:{String(timerSeconds).padStart(2, '0')}
                      </span>
                      <p className="text-[10px] text-slate-450 dark:text-slate-500 font-extrabold uppercase tracking-wider mt-1.5">{timerType} SESSION ACTIVE</p>
                    </div>

                    <div className="flex gap-3 w-full">
                      <button
                        onClick={() => setTimerActive(!timerActive)}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-white transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 ${timerActive ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                        {timerActive ? (
                          <><Pause className="w-4 h-4" /> Pause</>
                        ) : (
                          <><Play className="w-4 h-4" /> Start</>
                        )}
                      </button>
                      <button onClick={resetTimer} className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-90">
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* CREATE PROJECT MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-[500px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-left">
              <h3 className="font-extrabold text-xl">Create Academic Project</h3>
              <p className="text-xs text-slate-400">Initialize a shared folder repository for course deliverables.</p>
            </div>
            
            <form onSubmit={handleCreateProject} className="flex flex-col gap-4 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Project Name</label>
                <input
                  type="text"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="e.g. Distributed Database Management"
                  required
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Description</label>
                <textarea
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  placeholder="Summarize course goals and team roles..."
                  rows={3}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category/Major</label>
                  <input
                    type="text"
                    value={projCat}
                    onChange={(e) => setProjCat(e.target.value)}
                    placeholder="e.g. CS / Physics"
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all font-semibold"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Visibility</label>
                  <select
                    value={projVis}
                    onChange={(e: any) => setProjVis(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all font-bold cursor-pointer"
                  >
                    <option value="TEAM">Team Only</option>
                    <option value="PRIVATE">Private (Owner Only)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Start Date</label>
                  <input
                    type="date"
                    value={projStart}
                    onChange={(e) => setProjStart(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all font-semibold cursor-pointer"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deadline</label>
                  <input
                    type="date"
                    value={projDeadline}
                    onChange={(e) => setProjDeadline(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all font-semibold cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-sm text-center active:scale-95"
              >
                Create Project
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SEND INVITATION MODAL */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setInviteModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-left">
              <h3 className="font-extrabold text-lg flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
                Invite Team Member
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-semibold">Search for an active student user using username or registered email.</p>
            </div>

            <form onSubmit={handleSendInvite} className="flex flex-col gap-4 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Username or Email</label>
                <input
                  type="text"
                  value={inviteUser}
                  onChange={(e) => setInviteUser(e.target.value)}
                  placeholder="e.g. anas_dev or anas@example.com"
                  required
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all font-semibold"
                />
              </div>

              <button
                type="submit"
                className="mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-sm text-center active:scale-95"
              >
                Send Invitation
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD TASK MODAL */}
      {addTaskModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-[450px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setAddTaskModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-left">
              <h3 className="font-extrabold text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" />
                Add Coursework Task
              </h3>
              <p className="text-xs text-slate-400 mt-1">Assign deliverables to team contributors.</p>
            </div>

            <form onSubmit={handleCreateTask} className="flex flex-col gap-4 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Task Title</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Implement Prisma Schema models"
                  required
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Task Description</label>
                <textarea
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Describe step requirements..."
                  rows={2}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e: any) => setTaskPriority(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all font-bold cursor-pointer"
                  >
                    <option value="LOW">Low Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="HIGH">High Priority</option>
                  </select>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assign To</label>
                  <select
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all font-bold cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {selectedProject && selectedProject.members?.map((m: any) => (
                      <option key={m.user.id} value={m.user.id}>@{m.user.username}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Due Date</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all font-semibold cursor-pointer"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estimated Hours</label>
                  <input
                    type="number"
                    value={taskEstHours}
                    onChange={(e) => setTaskEstHours(e.target.value)}
                    placeholder="e.g. 5"
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-sm text-center active:scale-95"
              >
                Add Task
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
