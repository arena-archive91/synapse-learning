import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './store/useStore';
import { Landing } from './components/Landing';
import { Onboarding } from './components/Onboarding';
import { Shell } from './components/Shell';
import { Dashboard } from './components/Dashboard';
import { Library } from './components/Library';
import { Tasks } from './components/Tasks';
import { Agent } from './components/Agent';
import { CourseView } from './components/CourseView';
import { Analytics } from './components/Analytics';
import { Settings } from './components/Settings';
import { UploadModal } from './components/UploadModal';
import { LessonView } from './components/LessonView';
import { PracticalLessonView } from './components/PracticalLessonView';
import { StudyWorkspace } from './components/workspace/StudyWorkspace';
import type { AppView } from './types';

export default function App() {
  const store = useAppStore();

  // Landing page
  if (store.currentView === 'landing') {
    return <Landing onGetStarted={() => store.navigate('onboarding')} />;
  }

  // Onboarding
  if (store.currentView === 'onboarding') {
    return <Onboarding onComplete={() => store.navigate('dashboard')} />;
  }

  // Course detail view
  if (store.currentView === 'course' && store.selectedCourse) {
    return (
      <Shell currentView={store.currentView} onNavigate={store.navigate} sidebarOpen={store.sidebarOpen} onToggleSidebar={store.setSidebarOpen} user={store.user} stats={store.dashboardStats} onUpload={() => store.setShowUploadModal(true)}>
        <CourseView course={store.selectedCourse} onBack={() => store.navigate('library')} onStartLesson={() => store.setStudyWorkspaceOpen(true)} onOpenAgent={() => store.navigate('agent')} />
        <UploadModal isOpen={store.showUploadModal} onClose={() => store.setShowUploadModal(false)} onUpload={store.simulateUpload} onProceed={() => store.navigate('library')} />
        {store.activeLessonView && (
          <LessonView onClose={() => store.setActiveLessonView(false)} onOpenAgent={() => { store.setActiveLessonView(false); store.navigate('agent'); }} />
        )}
      </Shell>
    );
  }

  // Main app views
  return (
    <Shell currentView={store.currentView} onNavigate={store.navigate} sidebarOpen={store.sidebarOpen} onToggleSidebar={store.setSidebarOpen} user={store.user} stats={store.dashboardStats} onUpload={() => store.setShowUploadModal(true)}>
      <AnimatePresence mode="wait">
        <motion.div key={store.currentView} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {store.currentView === 'dashboard' && (
            <Dashboard
              stats={store.dashboardStats}
              courses={store.courses}
              tasks={store.tasks}
              learnerModel={store.learnerModel}
              onNavigate={(view: AppView) => store.navigate(view)}
              onSelectCourse={(course) => { store.setSelectedCourse(course); store.navigate('course'); }}
              onOpenWorkspace={() => store.setStudyWorkspaceOpen(true)}
            />
          )}
          {store.currentView === 'library' && (
            <Library
              courses={store.courses}
              uploadedFiles={store.uploadedFiles}
              onSelectCourse={(course) => { store.setSelectedCourse(course); store.navigate('course'); }}
              onUpload={() => store.setShowUploadModal(true)}
            />
          )}
          {store.currentView === 'tasks' && (
            <Tasks tasks={store.tasks} onComplete={store.completeTask} onStartSession={() => {
              // Open practical view for coding tasks, theoretical for others
              const nextPractice = store.tasks.find(t => t.status === 'pending' && t.type === 'practice');
              if (nextPractice) { store.setPracticalLessonView(true); } else { store.setActiveLessonView(true); }
            }} />
          )}
          {store.currentView === 'agent' && (
            <Agent messages={store.agentMessages} mode={store.agentMode} courses={store.courses} onSendMessage={store.addAgentMessage} onChangeMode={store.setAgentMode} />
          )}
          {store.currentView === 'analytics' && (
            <Analytics learnerModel={store.learnerModel} stats={store.dashboardStats} courses={store.courses} />
          )}
          {store.currentView === 'settings' && (
            <Settings settings={store.user.settings} onUpdate={store.updateSettings} />
          )}
        </motion.div>
      </AnimatePresence>

      <UploadModal isOpen={store.showUploadModal} onClose={() => store.setShowUploadModal(false)} onUpload={store.simulateUpload} onProceed={() => store.navigate('library')} />
      {store.activeLessonView && (
        <LessonView onClose={() => store.setActiveLessonView(false)} onOpenAgent={() => { store.setActiveLessonView(false); store.navigate('agent'); }} />
      )}
      {store.practicalLessonView && (
        <PracticalLessonView onClose={() => store.setPracticalLessonView(false)} onOpenAgent={() => { store.setPracticalLessonView(false); store.navigate('agent'); }} />
      )}
      {store.studyWorkspaceOpen && (
        <StudyWorkspace onClose={() => store.setStudyWorkspaceOpen(false)} onOpenAgent={() => { store.setStudyWorkspaceOpen(false); store.navigate('agent'); }} />
      )}
    </Shell>
  );
}
