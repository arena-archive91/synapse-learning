import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Sparkles, BookOpen, Brain, GraduationCap, MessageSquare,
  Code, Lightbulb, AlertTriangle, Mic, Volume2, ChevronDown,
  RotateCcw, Target, PenTool, Smile, Search, FileText,
  HelpCircle, Zap, Settings2
} from 'lucide-react';
import type { AgentMessage, AgentMode, Course, UserSettings, UploadedFile, MessageCitation } from '../types';
import { cn } from '../utils/cn';
import { streamAgentReply, isLlmAvailable } from '../lib/llmClient';
import { buildSourceExcerpt, retrieveForQueryHybrid } from '../lib/sourceContext';
import { spanFromCitation } from '../lib/conceptProvenance';
import { formatCitation } from '../lib/rag';
import { GoToSourceButton } from './GoToSourceButton';
import { RichText } from './RichText';

interface AgentProps {
  messages: AgentMessage[];
  mode: AgentMode;
  courses: Course[];
  onSendMessage: (msg: AgentMessage) => void;
  onUpdateMessage: (id: string, patch: Partial<AgentMessage>) => void;
  onChangeMode: (mode: AgentMode) => void;
  activeTaskTitle?: string;
  activeTaskConcept?: string;
  xpReward?: number;
  onCompleteTask?: () => void;
  settings?: UserSettings;
  uploadedFiles?: UploadedFile[];
  onGoToSource?: (highlight: { fileId: string; charStart: number; charEnd: number }) => void;
  lang?: 'en' | 'el';
}

const agentModes: { mode: AgentMode; icon: typeof Brain; label: string; desc: string; color: string }[] = [
  { mode: 'socratic', icon: HelpCircle, label: 'Socratic Tutor', desc: 'Guided questioning', color: 'text-brand-400' },
  { mode: 'direct', icon: Lightbulb, label: 'Direct Explain', desc: 'Clear explanations', color: 'text-accent-cyan' },
  { mode: 'beginner', icon: Smile, label: 'Beginner', desc: 'No prior knowledge', color: 'text-accent-emerald' },
  { mode: 'exam-coach', icon: GraduationCap, label: 'Exam Coach', desc: 'Exam-focused prep', color: 'text-accent-amber' },
  { mode: 'deep-theory', icon: BookOpen, label: 'Deep Theory', desc: 'Rigorous analysis', color: 'text-brand-300' },
  { mode: 'practical', icon: Code, label: 'Practical', desc: 'Exercises & code', color: 'text-accent-teal' },
  { mode: 'error-diagnosis', icon: AlertTriangle, label: 'Error Diagnosis', desc: 'Analyze mistakes', color: 'text-accent-rose' },
  { mode: 'feynman', icon: MessageSquare, label: 'Feynman', desc: 'Explain to learn', color: 'text-accent-orange' },
  { mode: 'debate', icon: Target, label: 'Debate', desc: 'Critical discussion', color: 'text-brand-200' },
  { mode: 'oral-exam', icon: Mic, label: 'Oral Exam', desc: 'Professor simulation', color: 'text-accent-rose' },
  { mode: 'math-tutor', icon: Zap, label: 'Math Tutor', desc: 'Step-by-step math', color: 'text-accent-amber' },
  { mode: 'coding-tutor', icon: Code, label: 'Coding Tutor', desc: 'Interactive code', color: 'text-accent-teal' },
  { mode: 'writing-coach', icon: PenTool, label: 'Writing Coach', desc: 'Essay structure', color: 'text-brand-300' },
  { mode: 'memory-coach', icon: RotateCcw, label: 'Memory Coach', desc: 'Retrieval practice', color: 'text-accent-emerald' },
  { mode: 'motivation', icon: Sparkles, label: 'Focus Coach', desc: 'Small actionable steps', color: 'text-accent-amber' },
];

const quickActions = [
  'Explain this concept simply',
  'Give me a practice question',
  'Where does this come from in my notes?',
  'What are common mistakes here?',
  'Create flashcards for this topic',
  'Simulate an exam question',
];

export function Agent({
  messages,
  mode,
  courses,
  onSendMessage,
  onUpdateMessage,
  onChangeMode,
  activeTaskTitle,
  activeTaskConcept,
  xpReward,
  onCompleteTask,
  settings,
  uploadedFiles = [],
  onGoToSource,
  lang = settings?.language ?? 'en',
}: AgentProps) {
  const [input, setInput] = useState('');
  const [showModes, setShowModes] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [attachSource, setAttachSource] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const llmReady = isLlmAvailable(settings);
  const sourceExcerpt = attachSource
    ? buildSourceExcerpt(
        uploadedFiles,
        activeTaskConcept,
        selectedSource === 'all' ? undefined : selectedSource,
      )
    : undefined;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isThinking) return;
    const msg: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      type: 'text',
    };
    onSendMessage(msg);
    setInput('');
    setShowQuickActions(false);
    setIsThinking(true);

    // Query-aware retrieval: rank source chunks against the actual message
    // (widened by the active concept) for grounding + precise citations.
    const retrieval = attachSource
      ? await retrieveForQueryHybrid(uploadedFiles, text, settings, {
          concept: activeTaskConcept,
          courseId: selectedSource === 'all' ? undefined : selectedSource,
        })
      : { excerpt: undefined, citations: [], grounded: false };

    const queryExcerpt = retrieval.excerpt ?? sourceExcerpt;

    const streamId = `msg-${Date.now() + 1}`;
    onSendMessage({
      id: streamId,
      role: 'agent',
      content: '',
      timestamp: new Date().toISOString(),
      type: 'text',
      isStreaming: true,
      metadata: {
        sourceGrounded: retrieval.grounded || (mode !== 'motivation' && !!queryExcerpt),
        enrichmentUsed: false,
        inferenceUsed: llmReady,
      },
    });

    setIsThinking(false);

    const { content, usedLlm, sourceGrounded } = await streamAgentReply(
      text,
      mode,
      settings,
      {
        taskTitle: activeTaskTitle,
        concept: activeTaskConcept,
        courses: courses.map((c) => c.title),
        sourceExcerpt: queryExcerpt,
      },
      (full) => onUpdateMessage(streamId, { content: full }),
    );

    const citationLine = retrieval.citations.length > 0
      ? retrieval.citations.slice(0, 3).map(formatCitation).join('  ·  ')
      : undefined;

    onUpdateMessage(streamId, {
      content,
      isStreaming: false,
      sourceReference: citationLine,
      citations: retrieval.citations,
      metadata: {
        sourceGrounded: retrieval.grounded || sourceGrounded || (mode !== 'motivation' && !!queryExcerpt),
        enrichmentUsed: settings?.sourceMode === 'enriched' && !retrieval.grounded,
        inferenceUsed: usedLlm,
      },
    });
    setIsThinking(false);
  };

  const handleQuickAction = (action: string) => {
    void handleSend(action);
  };

  const currentMode = agentModes.find(m => m.mode === mode)!;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] lg:h-[calc(100vh-56px)]">
      {/* Agent Header */}
      <div className="px-4 sm:px-6 py-3 border-b border-border-subtle bg-surface-secondary/30">
        <div className="flex items-center justify-between max-w-none w-full min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-teal flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Synapse Agent</span>
                <button
                  onClick={() => setShowModes(!showModes)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-surface-hover border border-border-subtle hover:border-brand-500/30 transition-all"
                >
                  <currentMode.icon className={cn('w-3 h-3', currentMode.color)} />
                  {currentMode.label}
                  <ChevronDown className={cn('w-3 h-3 transition-transform', showModes && 'rotate-180')} />
                </button>
              </div>
              <p className="text-xs text-text-tertiary">
                {llmReady ? 'LLM connected · streaming' : 'Offline mode · Add API key in Settings'}
                {sourceExcerpt ? ' · source context attached' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedSource}
              onChange={e => setSelectedSource(e.target.value)}
              className="text-xs bg-surface-input border border-border-subtle rounded-lg px-2 py-1.5 text-text-secondary focus:outline-none focus:border-brand-500/50"
            >
              <option value="all">All Sources</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <button className="p-1.5 rounded-lg hover:bg-surface-hover text-text-tertiary">
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {activeTaskTitle && (
        <div className="px-4 sm:px-6 py-2 border-b border-brand-500/20 bg-brand-500/5">
          <div className="max-w-none w-full min-w-0 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-brand-300 truncate">{activeTaskTitle}</p>
              {activeTaskConcept && (
                <p className="text-[10px] text-text-tertiary truncate">Focus: {activeTaskConcept}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {xpReward !== undefined && (
                <span className="text-xs text-accent-amber font-medium">+{xpReward} XP</span>
              )}
              {onCompleteTask && (
                <button
                  onClick={onCompleteTask}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white transition-all"
                >
                  Complete task
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mode Selector Dropdown */}
      <AnimatePresence>
        {showModes && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-border-subtle bg-surface-secondary/50 overflow-hidden"
          >
            <div className="max-w-none w-full min-w-0 px-4 sm:px-6 py-4">
              <p className="text-xs text-text-tertiary font-medium uppercase tracking-wider mb-3">Agent Mode</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {agentModes.map(m => (
                  <button
                    key={m.mode}
                    onClick={() => { onChangeMode(m.mode); setShowModes(false); }}
                    className={cn(
                      'p-2.5 rounded-xl text-left transition-all border',
                      mode === m.mode
                        ? 'bg-brand-600/15 border-brand-500/30 text-brand-300'
                        : 'border-border-subtle hover:border-brand-500/20 bg-surface-card'
                    )}
                  >
                    <m.icon className={cn('w-4 h-4 mb-1', m.color)} />
                    <p className="text-xs font-medium">{m.label}</p>
                    <p className="text-[10px] text-text-tertiary">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-none w-full min-w-0 px-4 sm:px-6 py-4 space-y-4">
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} onGoToSource={onGoToSource} lang={lang} />
          ))}
          {isThinking && (
            <div className="flex gap-3 px-1 py-2 text-sm text-text-muted">
              <Sparkles className="w-4 h-4 text-brand-400 animate-pulse shrink-0 mt-0.5" />
              <span>Thinking…</span>
            </div>
          )}
          <div ref={messagesEndRef} />

          {/* Quick Actions */}
          {showQuickActions && messages.length <= 4 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-4"
            >
              <p className="text-xs text-text-tertiary mb-3">Quick actions:</p>
              <div className="flex flex-wrap gap-2">
                {quickActions.map(action => (
                  <button
                    key={action}
                    onClick={() => handleQuickAction(action)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border-subtle hover:border-brand-500/30 hover:bg-surface-hover text-text-secondary transition-all"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border-subtle bg-surface-secondary/30 pb-20 lg:pb-0">
        <div className="max-w-none w-full min-w-0 px-4 sm:px-6 py-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Ask anything about your material..."
                rows={1}
                disabled={isThinking}
                className="w-full px-4 py-3 pr-12 rounded-xl bg-surface-input border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500/50 resize-none"
                style={{ minHeight: '46px', maxHeight: '120px' }}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <button className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted">
                  <Search className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted">
                  <FileText className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isThinking}
              className={cn(
                'p-3 rounded-xl transition-all shrink-0',
                input.trim() && !isThinking
                  ? 'bg-brand-600 hover:bg-brand-500 text-white'
                  : 'bg-surface-hover text-text-muted cursor-not-allowed'
              )}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
            <div className="flex items-center gap-3 text-[10px] text-text-muted flex-wrap">
              <span className="flex items-center gap-1">
                <Volume2 className="w-3 h-3" />
                Source-grounded
              </span>
              <span>•</span>
              <span>{currentMode.label} mode</span>
              <span>•</span>
              <button className="text-brand-400 hover:text-brand-300 transition-colors">
                🛡️ Don't give me the answer
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setAttachSource((v) => !v)}
                className={cn(
                  'text-text-muted hover:text-text-secondary transition-colors',
                  attachSource && sourceExcerpt && 'text-brand-400',
                )}
              >
                📎 {attachSource ? 'Source context on' : 'Source context off'}
              </button>
            </div>
            <span className="text-[10px] text-text-muted">Shift+Enter for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CitationList({
  citations,
  onGoToSource,
  lang = 'en',
}: {
  citations: MessageCitation[];
  onGoToSource?: (highlight: { fileId: string; charStart: number; charEnd: number }) => void;
  lang?: 'en' | 'el';
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 pt-2 border-t border-border-subtle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-brand-300 transition-colors"
      >
        <FileText className="w-3 h-3" />
        {citations.length} {citations.length === 1 ? 'source' : 'sources'} · show me where this came from
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {citations.map((c) => (
            <div key={c.chunkId} className="rounded-lg border border-border-subtle bg-surface-primary/40 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] text-brand-300 font-medium min-w-0">
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="truncate">{c.fileName}</span>
                  <span className="text-text-muted">· {c.locator}</span>
                  {c.heading && <span className="text-text-muted truncate">· {c.heading}</span>}
                </div>
                {onGoToSource && (
                  <GoToSourceButton lang={lang} onClick={() => onGoToSource(spanFromCitation(c))} />
                )}
              </div>
              <p className="text-[11px] text-text-tertiary mt-0.5 leading-snug">{c.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  onGoToSource,
  lang = 'en',
}: {
  message: AgentMessage;
  onGoToSource?: (highlight: { fileId: string; charStart: number; charEnd: number }) => void;
  lang?: 'en' | 'el';
}) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="text-center">
        <span className="text-xs text-text-muted px-3 py-1 rounded-full bg-surface-hover inline-block">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-teal flex items-center justify-center shrink-0 mt-1">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}

      <div className={cn(
        'max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'bg-brand-600 text-white rounded-tr-md'
          : 'bg-surface-card border border-border-subtle rounded-tl-md'
      )}>
        <div>
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <RichText text={message.content || (message.isStreaming ? '…' : '')} />
          )}
          {message.isStreaming && message.content && (
            <span className="inline-block w-0.5 h-4 bg-brand-400 animate-pulse ml-0.5 align-middle" />
          )}
        </div>

        {message.citations && message.citations.length > 0 ? (
          <CitationList citations={message.citations} onGoToSource={onGoToSource} lang={lang} />
        ) : message.sourceReference ? (
          <div className={cn(
            'mt-2 pt-2 border-t flex items-center gap-1.5 text-xs',
            isUser ? 'border-white/20 text-white/70' : 'border-border-subtle text-text-tertiary'
          )}>
            <FileText className="w-3 h-3" />
            {message.sourceReference}
          </div>
        ) : null}

        {message.confidence !== undefined && message.confidence < 0.8 && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-accent-amber">
            <AlertTriangle className="w-3 h-3" />
            <span>Lower confidence — verify with source</span>
          </div>
        )}

        {/* Source attribution labels */}
        {!isUser && message.metadata && (
          <div className="mt-2 pt-2 border-t border-border-subtle flex items-center gap-2 flex-wrap">
            {message.metadata.sourceGrounded && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-emerald/10 text-accent-emerald font-medium">📖 Source-grounded</span>
            )}
            {message.metadata.inferenceUsed && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-300 font-medium">🧠 AI inference</span>
            )}
            {message.metadata.enrichmentUsed && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-amber/10 text-accent-amber font-medium">✨ External enrichment</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

