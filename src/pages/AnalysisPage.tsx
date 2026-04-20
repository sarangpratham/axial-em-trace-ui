import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { ChatProvider, openAIAdapter, useThread, useThreadList, type Message, type Thread, type UserMessage } from '@openuidev/react-headless';
import { Renderer } from '@openuidev/react-lang';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppTopbar } from '../components/AppTopbar';
import { analysisLibrary } from '../components/analysis/openuiLibrary';
import type { TraceExplorerState } from '../hooks/useTraceExplorerState';
import {
  ANALYSIS_CHAT_API_URL,
  ANALYSIS_STARTER_PROMPTS,
  ANALYSIS_THREADS_API_URL,
  createAnalysisContextSnapshot,
  createAnalysisThread,
  deleteAnalysisThread,
  fetchAnalysisThreads,
  loadAnalysisThread,
  sendAnalysisMessage,
  updateAnalysisThread,
  useAnalysisUserKey,
} from '../lib/analysisChat';

const LARGE_DESKTOP_MEDIA_QUERY = '(min-width: 1500px)';

function formatDate(value?: string | number | null) {
  if (!value) return 'recent';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'recent' : parsed.toLocaleString();
}

function getMessageText(message: Message) {
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((item) => (typeof item === 'object' && item && 'text' in item ? String((item as { text?: unknown }).text ?? '') : ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function looksLikeOpenUI(text: string) {
  return /(^|\n)\s*root\s*=/.test(text) || /(^|\n)\s*[A-Z][A-Za-z0-9_]*\s*=/.test(text) || /<\s*[A-Z][A-Za-z0-9]*/.test(text);
}

function useLargeDesktop() {
  const [isLargeDesktop, setIsLargeDesktop] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(LARGE_DESKTOP_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(LARGE_DESKTOP_MEDIA_QUERY);
    const sync = (event?: MediaQueryListEvent) => setIsLargeDesktop(event?.matches ?? mediaQuery.matches);

    sync();
    mediaQuery.addEventListener('change', sync);
    return () => mediaQuery.removeEventListener('change', sync);
  }, []);

  return isLargeDesktop;
}

class AnalysisRenderBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('OpenUI render failed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function SetupState({ explorer }: { explorer: TraceExplorerState }) {
  return (
    <div className="analysis-shell">
      <AppTopbar
        currentView="chat"
        runIds={explorer.runsQuery.data ?? []}
        selectedRunId={explorer.selectedRunId}
        onRunChange={(runId) => explorer.updateParam('run_id', runId)}
        statusSlot={<span className="topbar-status-chip">Chat setup</span>}
      />
      <div className="analysis-workspace analysis-workspace--empty">
        <section className="analysis-empty-card">
          <div className="analysis-empty-icon">⌘</div>
          <h2>Chat API endpoint required</h2>
          <p>
            Add <code>VITE_INSIGHTS_API_BASE_URL</code> to your local <code>.env</code> file if you are not using the default localhost path.
          </p>
          {explorer.selectedRunId && <p>Current run context is ready: <code>{explorer.selectedRunId}</code></p>}
        </section>
      </div>
    </div>
  );
}

function OpenUIMessage({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  if (!content.trim()) {
    return <div className="analysis-event-pill analysis-event-pill--pending">Assistant is preparing a response…</div>;
  }

  if (!looksLikeOpenUI(content)) {
    return (
      <div className="analysis-message-text analysis-markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  const fallback = <pre className="analysis-message-json">{content}</pre>;

  return (
    <AnalysisRenderBoundary fallback={fallback}>
      <div className="analysis-message-component analysis-render-frame">
        <Renderer response={content} library={analysisLibrary} isStreaming={isStreaming} />
      </div>
    </AnalysisRenderBoundary>
  );
}

function Transcript({ messages, isRunning }: { messages: Message[]; isRunning: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [messages, isRunning]);

  return (
    <div ref={scrollRef} className="analysis-transcript">
      {messages.length === 0 ? (
        <div className="analysis-empty-thread">
          <span className="empty-icon">◎</span>
          <p>Ask about traces, anomalies, evidence, or master-entity context for the selected run.</p>
        </div>
      ) : (
        messages.map((message, index) => {
          const text = getMessageText(message);
          const isStreamingMessage = isRunning && index === messages.length - 1 && message.role === 'assistant';
          return (
            <article key={message.id} className={`analysis-message analysis-message--${message.role}`}>
              <div className="analysis-message-meta">
                <span className="analysis-message-role">{message.role}</span>
                <span className="analysis-message-time">{'createdAt' in message ? formatDate((message as { createdAt?: string }).createdAt) : 'recent'}</span>
              </div>
              <div className="analysis-message-body">
                {message.role === 'assistant' ? (
                  <OpenUIMessage content={text} isStreaming={isStreamingMessage} />
                ) : (
                  <div className="analysis-message-text">{text || 'No visible content in this message.'}</div>
                )}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}

function ThreadRail({
  threads,
  selectedThreadId,
  isLoading,
  isRunning,
  onSelect,
  onNewThread,
  onDelete,
  onSuggestion,
  onClose,
  selectedRunId,
}: {
  threads: Thread[];
  selectedThreadId: string | null;
  isLoading: boolean;
  isRunning: boolean;
  onSelect: (threadId: string) => void;
  onNewThread: () => void;
  onDelete: (threadId: string) => void;
  onSuggestion: (prompt: string) => void;
  onClose: () => void;
  selectedRunId: string;
}) {
  return (
    <div className="analysis-sidebar">
      <div className="analysis-rail-head">
        <div>
          <div className="analysis-rail-label">Chat Threads</div>
          <div className="analysis-rail-sub">run · {selectedRunId || 'not selected'}</div>
        </div>
        <div className="analysis-rail-head-actions">
          <button type="button" className="analysis-ghost-button" onClick={onNewThread} disabled={isRunning}>
            + new
          </button>
          <button type="button" className="analysis-ghost-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="analysis-thread-list">
        {isLoading ? (
          <div className="analysis-thread-empty">Loading threads…</div>
        ) : threads.length > 0 ? (
          threads.map((thread) => (
            <div key={thread.id} className={`analysis-thread-row${thread.id === selectedThreadId ? ' analysis-thread-row--active' : ''}`}>
              <button type="button" className="analysis-thread-select" onClick={() => onSelect(thread.id)} disabled={isRunning}>
                <strong>{thread.title || thread.id.slice(0, 12)}</strong>
                <span>{formatDate(thread.createdAt)}</span>
              </button>
              <button type="button" className="analysis-thread-delete" onClick={() => onDelete(thread.id)} disabled={isRunning || thread.id !== selectedThreadId}>
                remove
              </button>
            </div>
          ))
        ) : (
          <div className="analysis-thread-empty">No stored threads yet for this browser user.</div>
        )}
      </div>

      <div className="analysis-rail-section">
        <div className="analysis-rail-label">Quick Prompts</div>
        <div className="analysis-prompt-list">
          {ANALYSIS_STARTER_PROMPTS.map((prompt) => (
            <button key={prompt} type="button" className="analysis-prompt-chip" onClick={() => onSuggestion(prompt)} disabled={isRunning}>
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalysisCanvas({ explorer, latestAssistantText, isRunning, onClose }: { explorer: TraceExplorerState; latestAssistantText: string; isRunning: boolean; onClose: () => void }) {
  const hasPinnedFilters = Boolean(
    explorer.moduleFilter || explorer.statusFilter || explorer.decisionSourceFilter || explorer.searchInput,
  );

  return (
    <div className="analysis-canvas-shell">
      <div className="analysis-rail-head">
        <div>
          <div className="analysis-rail-label">Evidence Canvas</div>
          <div className="analysis-rail-sub">Run-scoped context, active filters, and rendered response</div>
        </div>
        <button type="button" className="analysis-ghost-button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="analysis-canvas">
        <section className="analysis-card">
          <div className="analysis-card-head">
            <div>
              <div className="analysis-card-kicker">Current Scope</div>
              <h3 className="analysis-card-title">Free-form run analysis</h3>
            </div>
          </div>
          <p className="analysis-story-block">
            Chat stays scoped to the selected run and does not pin a source record or master entity unless you explicitly ask it to.
          </p>
          {hasPinnedFilters ? (
            <div className="analysis-context-strip">
              {explorer.moduleFilter && <span className="analysis-pill">module · {explorer.moduleFilter}</span>}
              {explorer.statusFilter && <span className="analysis-pill">status · {explorer.statusFilter}</span>}
              {explorer.decisionSourceFilter && <span className="analysis-pill">decision source · {explorer.decisionSourceFilter}</span>}
              {explorer.searchInput && <span className="analysis-pill">query · {explorer.searchInput}</span>}
            </div>
          ) : (
            <div className="analysis-empty-thread analysis-empty-canvas">
              <p>No explorer filters are pinned into chat right now.</p>
            </div>
          )}
        </section>

        <section className="analysis-card analysis-card--component">
          <div className="analysis-card-head">
            <div>
              <div className="analysis-card-kicker">Latest Generated UI</div>
              <h3 className="analysis-card-title">Assistant output</h3>
            </div>
          </div>
          {latestAssistantText ? (
            <div className="analysis-canvas-component">
              <OpenUIMessage content={latestAssistantText} isStreaming={isRunning} />
            </div>
          ) : (
            <div className="analysis-empty-thread analysis-empty-canvas">
              <p>No generated output yet. Ask a question to populate this canvas.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AnalysisWorkspace({ explorer }: { explorer: TraceExplorerState }) {
  const { messages, isRunning, threadError, processMessage, cancelMessage } = useThread();
  const { threads, isLoadingThreads, loadThreads, selectedThreadId, selectThread, switchToNewThread, deleteThread } = useThreadList();
  const [composer, setComposer] = useState('');
  const isLargeDesktop = useLargeDesktop();
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(isLargeDesktop);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    setIsLeftDrawerOpen(isLargeDesktop);
  }, [isLargeDesktop]);

  const latestAssistantText = useMemo(() => {
    return [...messages].reverse().find((message) => message.role === 'assistant') ? getMessageText([...messages].reverse().find((message) => message.role === 'assistant') as Message) : '';
  }, [messages]);

  const currentThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;

  const submitPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || isRunning) return;
    setComposer('');
    await processMessage({ role: 'user', content: trimmed });
  };

  const handleDeleteThread = (threadId: string) => {
    deleteThread(threadId);
    if (threadId === selectedThreadId) {
      switchToNewThread();
    }
  };

  const isDrawerBackdropVisible = (!isLargeDesktop && (isLeftDrawerOpen || isRightDrawerOpen)) || (isLargeDesktop && isRightDrawerOpen);

  return (
    <div className="analysis-shell">
      <AppTopbar
        currentView="chat"
        runIds={explorer.runsQuery.data ?? []}
        selectedRunId={explorer.selectedRunId}
        onRunChange={(runId) => explorer.updateParam('run_id', runId)}
        statusSlot={<span className="topbar-status-chip">{currentThread?.title || explorer.selectedRunId || 'AI chat'}</span>}
      />

      <div className="analysis-workspace">
        <div className="analysis-toolbar">
          <div className="analysis-toolbar-copy">
            <div className="analysis-rail-label">Run-scoped chat</div>
            <div className="analysis-rail-sub">Ask free-form questions about the selected run without preselecting a source record or entity.</div>
          </div>
          <div className="analysis-toolbar-actions">
            <button type="button" className={`analysis-ghost-button${isLeftDrawerOpen ? ' analysis-toolbar-toggle--active' : ''}`} onClick={() => setIsLeftDrawerOpen((value) => !value)}>
              Threads
            </button>
            <button type="button" className={`analysis-ghost-button${isRightDrawerOpen ? ' analysis-toolbar-toggle--active' : ''}`} onClick={() => setIsRightDrawerOpen((value) => !value)}>
              Evidence
            </button>
            <button type="button" className="analysis-ghost-button" onClick={() => switchToNewThread()} disabled={isRunning}>
              New thread
            </button>
            {isRunning && (
              <button type="button" className="analysis-submit-button" onClick={cancelMessage}>
                Stop
              </button>
            )}
          </div>
        </div>

        <div className={`analysis-stage${isLargeDesktop && isLeftDrawerOpen ? ' analysis-stage--with-left-drawer' : ''}`}>
          {isDrawerBackdropVisible && <button type="button" className="analysis-drawer-backdrop" onClick={() => { setIsLeftDrawerOpen(false); setIsRightDrawerOpen(false); }} aria-label="Close drawers" />}

          <aside className={`analysis-drawer analysis-drawer--left${isLeftDrawerOpen ? ' analysis-drawer--open' : ''}`}>
            <ThreadRail
              threads={threads}
              selectedThreadId={selectedThreadId}
              isLoading={isLoadingThreads}
              isRunning={isRunning}
              onSelect={(threadId) => {
                selectThread(threadId);
                if (!isLargeDesktop) setIsLeftDrawerOpen(false);
              }}
              onNewThread={() => {
                switchToNewThread();
                if (!isLargeDesktop) setIsLeftDrawerOpen(false);
              }}
              onDelete={handleDeleteThread}
              onSuggestion={(prompt) => void submitPrompt(prompt)}
              onClose={() => setIsLeftDrawerOpen(false)}
              selectedRunId={explorer.selectedRunId}
            />
          </aside>

          <main className="analysis-chat-panel">
            {threadError && (
              <div className="analysis-chat-head">
                <span className="analysis-pill">error · {threadError.message}</span>
              </div>
            )}

            <Transcript messages={messages} isRunning={isRunning} />

            <div className="analysis-composer">
              <textarea
                className="analysis-composer-input"
                rows={4}
                placeholder={explorer.selectedRunId ? 'Ask about this run… Cmd/Ctrl+Enter' : 'Pick a run… Cmd/Ctrl+Enter'}
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    void submitPrompt(composer);
                  }
                }}
              />
            </div>
          </main>

          <aside className={`analysis-drawer analysis-drawer--right${isRightDrawerOpen ? ' analysis-drawer--open' : ''}`}>
            <AnalysisCanvas
              explorer={explorer}
              latestAssistantText={latestAssistantText}
              isRunning={isRunning}
              onClose={() => setIsRightDrawerOpen(false)}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

export function AnalysisPage({ explorer }: { explorer: TraceExplorerState }) {
  const userKey = useAnalysisUserKey();
  const contextSnapshot = useMemo(() => createAnalysisContextSnapshot(explorer), [explorer]);

  if (!ANALYSIS_CHAT_API_URL || !ANALYSIS_THREADS_API_URL) {
    return <SetupState explorer={explorer} />;
  }

  return (
    <ChatProvider
      processMessage={({ threadId, messages, abortController }) =>
        sendAnalysisMessage({
          threadId,
          messages,
          abortController,
          userKey,
          context: contextSnapshot,
        })
      }
      fetchThreadList={(cursor) => fetchAnalysisThreads(userKey, cursor)}
      createThread={(firstMessage) => createAnalysisThread(userKey, firstMessage as UserMessage, contextSnapshot)}
      loadThread={(threadId) => loadAnalysisThread(userKey, threadId)}
      updateThread={(thread) => updateAnalysisThread(userKey, thread)}
      deleteThread={(threadId) => deleteAnalysisThread(userKey, threadId)}
      streamProtocol={openAIAdapter()}
    >
      <AnalysisWorkspace explorer={explorer} />
    </ChatProvider>
  );
}
