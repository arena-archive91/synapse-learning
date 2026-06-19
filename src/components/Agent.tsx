import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Sparkles, BookOpen, Brain, GraduationCap, MessageSquare,
  Code, Lightbulb, AlertTriangle, Mic, Volume2, ChevronDown,
  RotateCcw, Target, PenTool, Smile, Search, FileText,
  HelpCircle, Zap, Settings2
} from 'lucide-react';
import type { AgentMessage, AgentMode, Course } from '../types';
import { cn } from '../utils/cn';

interface AgentProps {
  messages: AgentMessage[];
  mode: AgentMode;
  courses: Course[];
  onSendMessage: (msg: AgentMessage) => void;
  onChangeMode: (mode: AgentMode) => void;
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

export function Agent({ messages, mode, courses, onSendMessage, onChangeMode }: AgentProps) {
  const [input, setInput] = useState('');
  const [showModes, setShowModes] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const msg: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
      type: 'text',
    };
    onSendMessage(msg);
    setInput('');
    setShowQuickActions(false);

    // Simulate agent response
    setTimeout(() => {
      const response: AgentMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'agent',
        content: generateAgentResponse(input, mode),
        timestamp: new Date().toISOString(),
        type: 'text',
      };
      onSendMessage(response);
    }, 1500);
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
    setTimeout(() => handleSend(), 100);
  };

  const currentMode = agentModes.find(m => m.mode === mode)!;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] lg:h-[calc(100vh-56px)]">
      {/* Agent Header */}
      <div className="px-4 sm:px-6 py-3 border-b border-border-subtle bg-surface-secondary/30">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
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
              <p className="text-xs text-text-tertiary">Source-grounded · Adaptive</p>
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

      {/* Mode Selector Dropdown */}
      <AnimatePresence>
        {showModes && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-border-subtle bg-surface-secondary/50 overflow-hidden"
          >
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-4">
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything about your material..."
                rows={1}
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
              onClick={handleSend}
              disabled={!input.trim()}
              className={cn(
                'p-3 rounded-xl transition-all shrink-0',
                input.trim()
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
              <button className="text-text-muted hover:text-text-secondary transition-colors">
                📎 Attach source context
              </button>
            </div>
            <span className="text-[10px] text-text-muted">Shift+Enter for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
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
        <div className="whitespace-pre-wrap">
          {message.content.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
            }
            return <span key={i}>{part}</span>;
          })}
        </div>

        {message.sourceReference && (
          <div className={cn(
            'mt-2 pt-2 border-t flex items-center gap-1.5 text-xs',
            isUser ? 'border-white/20 text-white/70' : 'border-border-subtle text-text-tertiary'
          )}>
            <FileText className="w-3 h-3" />
            {message.sourceReference}
          </div>
        )}

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

function generateAgentResponse(_input: string, mode: AgentMode): string {
  const responses: Record<string, string> = {
    socratic: `That's an interesting question. Before I explain directly, let me ask you something:\n\n**What do you think happens when we consider this from the opposite perspective?**\n\nThink about it for a moment. What assumptions are you making? Are there cases where your initial reasoning might break down?\n\nI want you to discover the answer through your own reasoning — I'll guide you step by step.`,
    direct: `Great question! Let me explain this clearly:\n\n**The key concept here is:**\nThis relates to the fundamental principle in your notes where the relationship between variables is defined by their interaction pattern.\n\n**Step 1:** First, identify the core variables involved.\n**Step 2:** Apply the relevant formula or framework.\n**Step 3:** Check your result against boundary conditions.\n\n📖 *Reference: Your uploaded lecture notes, section 3.2*\n\nWould you like me to give you a practice question to test your understanding?`,
    beginner: `No worries, let me break this down in the simplest way possible! 😊\n\n**Imagine it like this:**\nThink of this concept as a recipe. You need specific ingredients (inputs) and you follow steps (process) to get a dish (output).\n\n**The ingredients are:**\n1. The first thing you need to know...\n2. The second building block...\n3. And how they connect...\n\nDoes this analogy make sense? I can make it even simpler or give you a real example!`,
    'exam-coach': `🎯 **Exam Focus Mode**\n\nBased on your material and common exam patterns, here's what you need to know:\n\n**Most likely question format:** Definition + Application\n**Time allocation:** ~5 minutes for this type\n\n**Model answer structure:**\n1. State the definition precisely\n2. Give the formula/framework\n3. Apply to the given scenario\n4. Conclude with limitations\n\n⚠️ **Common trap:** Students often forget to mention the assumptions. Always state them!\n\nWant me to give you a timed practice question?`,
  };

  return responses[mode] || responses.direct;
}
