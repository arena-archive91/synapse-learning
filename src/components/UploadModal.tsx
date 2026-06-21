import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, FileText, Image, Code, Presentation,
  File, CheckCircle2, Sparkles, ArrowRight, Link2,
  AlertCircle
} from 'lucide-react';
import { cn } from '../utils/cn';

import type { UploadPayload } from '../lib/uploadPipeline';
import type { Course } from '../types';
import { isDemoCourse } from '../lib/demoMode';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => void;
  onProcessUpload?: (payload: UploadPayload) => Promise<unknown>;
  /** Called after a successful processUpload with the generated/extended course. */
  onUploadComplete?: (course: Course) => void;
  onProceed: () => void;
  courses?: Course[];
}

const acceptedFormats = [
  { ext: 'PDF', icon: FileText, color: 'text-red-400' },
  { ext: 'DOCX', icon: File, color: 'text-blue-400' },
  { ext: 'PPTX', icon: Presentation, color: 'text-orange-400' },
  { ext: 'TXT/MD', icon: FileText, color: 'text-text-secondary' },
  { ext: 'Images', icon: Image, color: 'text-accent-emerald' },
  { ext: 'Code', icon: Code, color: 'text-accent-teal' },
];

type SourceMode = 'strict' | 'enriched' | 'notes-only';

export function UploadModal({ isOpen, onClose, onUpload, onProcessUpload, onUploadComplete, onProceed, courses = [] }: UploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [pastedContent, setPastedContent] = useState('');
  const [sourceMode, setSourceMode] = useState<SourceMode>('enriched');
  const [step, setStep] = useState<'upload' | 'configure' | 'processing' | 'error'>('upload');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [focusTags, setFocusTags] = useState<string[]>(['Deep understanding']);
  const [examDate, setExamDate] = useState('');
  const [uploadMode, setUploadMode] = useState<'new' | 'extend'>('new');
  const [targetCourseId, setTargetCourseId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extendableCourses = courses.filter((c) => !isDemoCourse(c.id));

  const FOCUS_OPTIONS = ['Exam preparation', 'Deep understanding', 'Quick review', 'Practice-heavy', 'Beginner-friendly'];

  const toggleFocus = (tag: string) => {
    setFocusTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setStep('upload');
    setFiles([]);
    setPastedContent('');
    setYoutubeUrl('');
    setFocusTags(['Deep understanding']);
    setExamDate('');
    setUploadMode('new');
    setTargetCourseId('');
    setProcessingError(null);
  };

  const handleProceed = async () => {
    const payload: UploadPayload = {
      files,
      pastedContent: pastedContent.trim() || undefined,
      youtubeUrl: youtubeUrl.trim() || undefined,
      sourceMode,
      focusTags,
      examDate: examDate || undefined,
      uploadMode,
      targetCourseId: uploadMode === 'extend' && targetCourseId ? targetCourseId : undefined,
    };
    setStep('processing');
    setProcessingError(null);
    try {
      if (onProcessUpload) {
        const result = await onProcessUpload(payload);
        if (result && typeof result === 'object' && 'id' in result) {
          onUploadComplete?.(result as Course);
        }
      } else if (files.length > 0) {
        onUpload(files);
      }
      resetForm();
      onProceed();
      onClose();
    } catch (err) {
      setProcessingError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setStep('error');
    }
  };

  const hasContent = files.length > 0 || pastedContent.trim().length > 0 || youtubeUrl.trim().length > 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div className="absolute inset-0 bg-black/70" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl border border-border-subtle bg-surface-secondary overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border-subtle">
            <div>
              <h2 className="text-lg font-bold">Upload Learning Material</h2>
              <p className="text-sm text-text-secondary mt-0.5">
                {step === 'upload' && 'Drop your files or paste content'}
                {step === 'configure' && 'Configure your course generation'}
                {step === 'processing' && 'Analyzing your material…'}
                {step === 'error' && 'Something went wrong'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover">
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5">
            {step === 'upload' && (
              <>
                {/* Drop Zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
                    dragActive
                      ? 'border-brand-500 bg-brand-500/5'
                      : 'border-border-default hover:border-brand-500/50 hover:bg-surface-hover/50'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.csv,.py,.js,.ts,.r,.sql,.jpg,.jpeg,.png,.gif,.webp"
                  />
                  <Upload className={cn(
                    'w-10 h-10 mx-auto mb-3 transition-colors',
                    dragActive ? 'text-brand-400' : 'text-text-muted'
                  )} />
                  <p className="text-sm font-medium mb-1">
                    {dragActive ? 'Drop files here' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    PDF, DOCX, PPTX, TXT, MD, Images, Code files, CSV
                  </p>
                </div>

                {/* Accepted formats */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {acceptedFormats.map(f => (
                    <span key={f.ext} className="flex items-center gap-1.5 text-xs text-text-tertiary">
                      <f.icon className={cn('w-3.5 h-3.5', f.color)} />
                      {f.ext}
                    </span>
                  ))}
                </div>

                {/* Selected files */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-text-tertiary font-medium">{files.length} file(s) selected</p>
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-card border border-border-subtle">
                        <FileText className="w-4 h-4 text-brand-400 shrink-0" />
                        <span className="text-sm flex-1 truncate">{file.name}</span>
                        <span className="text-xs text-text-muted">{(file.size / 1024).toFixed(1)} KB</span>
                        <button
                          onClick={e => { e.stopPropagation(); removeFile(i); }}
                          className="text-text-muted hover:text-accent-rose"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Or paste content */}
                <div>
                  <label className="text-xs text-text-tertiary font-medium block mb-2">Or paste content directly</label>
                  <textarea
                    data-testid="upload-paste"
                    value={pastedContent}
                    onChange={e => setPastedContent(e.target.value)}
                    placeholder="Paste your notes, text, or any learning material here..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-surface-input border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500/50 resize-none"
                  />
                </div>

                {/* YouTube URL */}
                <div>
                  <label className="text-xs text-text-tertiary font-medium block mb-2">
                    <Link2 className="w-3.5 h-3.5 inline mr-1" />
                    YouTube / Video URL (optional)
                  </label>
                  <input
                    type="url"
                    data-testid="upload-youtube-url"
                    value={youtubeUrl}
                    onChange={e => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-input border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500/50"
                  />
                </div>
              </>
            )}

            {step === 'configure' && (
              <>
                {extendableCourses.length > 0 && (
                  <div>
                    <label className="text-sm font-medium block mb-3">Course target</label>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setUploadMode('new')}
                        className={cn(
                          'w-full text-left p-3 rounded-xl border text-sm transition-all',
                          uploadMode === 'new' ? 'border-brand-500/50 bg-brand-500/10' : 'border-border-subtle',
                        )}
                      >
                        Create new course from this upload
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadMode('extend')}
                        className={cn(
                          'w-full text-left p-3 rounded-xl border text-sm transition-all',
                          uploadMode === 'extend' ? 'border-brand-500/50 bg-brand-500/10' : 'border-border-subtle',
                        )}
                      >
                        Extend an existing course (merge new topics)
                      </button>
                      {uploadMode === 'extend' && (
                        <select
                          value={targetCourseId}
                          onChange={(e) => setTargetCourseId(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-surface-input border border-border-subtle text-sm"
                        >
                          <option value="">Select course…</option>
                          {extendableCourses.map((c) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                {/* Source mode */}
                <div>
                  <label className="text-sm font-medium block mb-3">Source Mode</label>
                  <div className="space-y-2">
                    {[
                      { mode: 'strict' as SourceMode, label: 'Strict Source-Grounded', desc: 'Only use content from your uploaded material. Minimizes hallucination risk.', icon: '🔒' },
                      { mode: 'enriched' as SourceMode, label: 'Notes + Enrichment', desc: 'Use your notes as primary source, add trusted external explanations and examples.', icon: '✨' },
                      { mode: 'notes-only' as SourceMode, label: 'Notes Only', desc: 'Generate course structure from your notes without any additions.', icon: '📝' },
                    ].map(s => (
                      <button
                        key={s.mode}
                        onClick={() => setSourceMode(s.mode)}
                        className={cn(
                          'w-full text-left p-4 rounded-xl border transition-all',
                          sourceMode === s.mode
                            ? 'border-brand-500/50 bg-brand-500/10'
                            : 'border-border-subtle hover:border-brand-500/20'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span>{s.icon}</span>
                          <span className="font-medium text-sm">{s.label}</span>
                        </div>
                        <p className="text-xs text-text-secondary ml-6">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Focus */}
                <div>
                  <label className="text-sm font-medium block mb-3">Learning Focus</label>
                  <div className="flex flex-wrap gap-2">
                    {FOCUS_OPTIONS.map(focus => (
                      <button
                        key={focus}
                        type="button"
                        onClick={() => toggleFocus(focus)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                          focusTags.includes(focus)
                            ? 'border-brand-500/50 bg-brand-500/10 text-brand-300'
                            : 'border-border-subtle hover:border-brand-500/30 hover:bg-brand-500/5',
                        )}
                      >
                        {focus}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exam date */}
                <div>
                  <label className="text-sm font-medium block mb-2">Exam Date (optional)</label>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="px-4 py-2.5 rounded-xl bg-surface-input border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-brand-500/50"
                  />
                </div>

                <div className="p-3 rounded-xl bg-surface-hover/50 border border-border-subtle">
                  <p className="text-xs text-text-secondary flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                    The AI will extract topics, concepts, prerequisites, definitions, examples, and exercises from your material and build a structured adaptive course.
                  </p>
                </div>
              </>
            )}

            {step === 'error' && (
              <div className="text-center py-8 space-y-4">
                <AlertCircle className="w-12 h-12 text-accent-rose mx-auto" />
                <h3 className="text-lg font-semibold">Could not process your material</h3>
                <p className="text-sm text-text-secondary max-w-md mx-auto">{processingError}</p>
                <button
                  type="button"
                  onClick={() => setStep('configure')}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-500"
                >
                  Back to settings
                </button>
              </div>
            )}

            {step === 'processing' && (
              <div className="text-center py-8">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-teal animate-pulse" />
                  <div className="absolute inset-1 rounded-xl bg-surface-secondary flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-brand-400 animate-float" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">AI is analyzing your material</h3>
                <p className="text-sm text-text-secondary mb-6 max-w-sm mx-auto">
                  Extracting topics, concepts, prerequisites, and building your personalized course...
                </p>
                <div className="space-y-3 max-w-xs mx-auto text-left">
                  {[
                    { label: 'Reading document structure', done: true },
                    { label: 'Extracting key concepts', done: true },
                    { label: 'Mapping prerequisites', done: false },
                    { label: 'Generating learning path', done: false },
                    { label: 'Creating exercises & quizzes', done: false },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {step.done ? (
                        <CheckCircle2 className="w-4 h-4 text-accent-emerald shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-text-muted shrink-0" />
                      )}
                      <span className={step.done ? 'text-text-primary' : 'text-text-tertiary'}>{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {step !== 'processing' && step !== 'error' && (
            <div className="p-5 border-t border-border-subtle flex items-center justify-between">
              <button
                onClick={step === 'configure' ? () => setStep('upload') : onClose}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {step === 'configure' ? 'Back' : 'Cancel'}
              </button>
              <button
                data-testid={step === 'upload' ? 'upload-continue' : 'upload-generate'}
                onClick={step === 'upload' ? () => setStep('configure') : handleProceed}
                disabled={(step === 'upload' && !hasContent) || (step === 'configure' && uploadMode === 'extend' && !targetCourseId)}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all',
                  (step === 'upload' && !hasContent) || (step === 'configure' && uploadMode === 'extend' && !targetCourseId)
                    ? 'bg-surface-hover text-text-muted cursor-not-allowed'
                    : 'bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-brand-400'
                )}
              >
                {step === 'upload' ? 'Continue' : 'Generate Course'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
