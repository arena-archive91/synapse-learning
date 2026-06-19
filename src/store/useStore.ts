import { useState, useCallback } from 'react';
import type { AppView, Course, AgentMessage, AgentMode, UploadedFile, UserSettings } from '../types';
import { mockUser, mockCourses, mockTasks, mockLearnerModel, mockDashboardStats, mockAgentMessages } from '../data/mockData';

export function useAppStore() {
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(mockUser);
  const [courses] = useState(mockCourses);
  const [tasks, setTasks] = useState(mockTasks);
  const [learnerModel] = useState(mockLearnerModel);
  const [dashboardStats] = useState(mockDashboardStats);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>(mockAgentMessages);
  const [agentMode, setAgentMode] = useState<AgentMode>('socratic');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeLessonView, setActiveLessonView] = useState(false);
  const [practicalLessonView, setPracticalLessonView] = useState(false);
  const [studyWorkspaceOpen, setStudyWorkspaceOpen] = useState(false);

  const navigate = useCallback((view: AppView) => {
    setCurrentView(view);
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  }, []);

  const completeTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' as const } : t));
  }, []);

  const addAgentMessage = useCallback((msg: AgentMessage) => {
    setAgentMessages(prev => [...prev, msg]);
  }, []);

  const updateSettings = useCallback((partial: Partial<UserSettings>) => {
    setUser(prev => ({ ...prev, settings: { ...prev.settings, ...partial } }));
  }, []);

  const simulateUpload = useCallback((files: File[]) => {
    setIsUploading(true);
    const newFiles: UploadedFile[] = files.map((f, i) => ({
      id: `file-${Date.now()}-${i}`,
      name: f.name,
      type: getFileType(f.name),
      size: f.size,
      uploadedAt: new Date().toISOString(),
      status: 'uploading' as const,
      progress: 0,
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach((file) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setUploadedFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'processing' as const, progress: 100 } : f));
          setTimeout(() => {
            setUploadedFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'analyzed' as const } : f));
            setIsUploading(false);
          }, 2000);
        } else {
          setUploadedFiles(prev => prev.map(f => f.id === file.id ? { ...f, progress } : f));
        }
      }, 500);
    });
  }, []);

  return {
    currentView, navigate,
    sidebarOpen, setSidebarOpen,
    user, updateSettings,
    courses, selectedCourse, setSelectedCourse,
    tasks, completeTask,
    learnerModel, dashboardStats,
    agentMessages, addAgentMessage, agentMode, setAgentMode,
    uploadedFiles, isUploading, simulateUpload,
    showUploadModal, setShowUploadModal,
    activeLessonView, setActiveLessonView,
    practicalLessonView, setPracticalLessonView,
    studyWorkspaceOpen, setStudyWorkspaceOpen,
  };
}

function getFileType(name: string): UploadedFile['type'] {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'pdf';
    case 'docx': case 'doc': return 'docx';
    case 'pptx': case 'ppt': return 'pptx';
    case 'txt': return 'txt';
    case 'md': return 'md';
    case 'csv': return 'csv';
    case 'py': case 'js': case 'ts': case 'r': case 'sql': return 'code';
    case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': return 'image';
    default: return 'txt';
  }
}
