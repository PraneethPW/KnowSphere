import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  History,
  MessageSquare,
  Plus,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, streamChat } from "../api";
import type { Citation, Conversation, Message } from "../types";
import {
  ErrorBox,
  Modal,
  SectionHeading,
  SourceButton,
  Spinner,
  useToast,
} from "../components/UI";
import { useWorkspace } from "../Workspace";
import { useGraph } from "./Dashboard";

export default function ChatPage() {
  const { space, openDocument } = useWorkspace(),
    client = useQueryClient(),
    toast = useToast();
  const [params, setParams] = useSearchParams(),
    conversationId = params.get("conversation");
  const [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null),
    [historyOpen, setHistoryOpen] = useState(false),
    [citations, setCitations] = useState<Citation[] | null>(null),
    [removing, setRemoving] = useState<Conversation | null>(null),
    [deleteBusy, setDeleteBusy] = useState(false);
  const controller = useRef<AbortController | null>(null),
    nearBottom = useRef(true),
    scrolling = useRef<HTMLDivElement>(null),
    streaming = useRef(false);
  const graph = useGraph();
  const ideas = [...(graph.data?.nodes || [])]
    .sort((a, b) => b.centrality - a.centrality)
    .slice(0, 3);
  const suggestions = ideas.map((node, i) =>
    i === 0
      ? `What do my sources say about ${node.name}?`
      : `How does ${node.name} connect to ${ideas[0].name}?`,
  );
  const conversations = useQuery({
    queryKey: ["conversations", space.id],
    queryFn: () => api<Conversation[]>(`/spaces/${space.id}/conversations`),
  });
  const thread = useQuery({
    queryKey: ["thread", space.id, conversationId],
    queryFn: () =>
      api<{ messages: Message[] }>(
        `/spaces/${space.id}/conversations/${conversationId}`,
      ),
    enabled: !!conversationId,
  });
  useEffect(() => {
    if (thread.data && !streaming.current) setMessages(thread.data.messages);
  }, [thread.data]);
  useEffect(() => {
    if (!conversationId && !streaming.current) setMessages([]);
  }, [conversationId]);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (nearBottom.current && scrolling.current)
      scrolling.current.scrollTo({ top: scrolling.current.scrollHeight });
  }, [messages]);
  async function send(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    streaming.current = true;
    setError(null);
    nearBottom.current = true;
    const assistantId = crypto.randomUUID();
    setMessages((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        citations: [],
      },
      { id: assistantId, role: "assistant", content: "", citations: [] },
    ]);
    const abort = new AbortController();
    controller.current = abort;
    let activeId = conversationId;
    let completed = false;
    try {
      await streamChat(
        `/spaces/${space.id}/chat`,
        { message, conversation_id: conversationId },
        abort.signal,
        (eventName, data) => {
          if (eventName === "context") {
            activeId = String(data.conversation_id);
            if (!conversationId)
              setParams({ conversation: activeId }, { replace: true });
            setMessages((previous) =>
              previous.map((m) =>
                m.id === assistantId
                  ? { ...m, citations: data.citations as Citation[] }
                  : m,
              ),
            );
          }
          if (eventName === "token")
            setMessages((previous) =>
              previous.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + String(data.text) }
                  : m,
              ),
            );
          if (eventName === "done") {
            completed = true;
            setMessages((previous) =>
              previous.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      citations: data.citations as Citation[],
                      model: String(data.model),
                    }
                  : m,
              ),
            );
          }
        },
      );
    } catch (e) {
      setMessages((previous) =>
        previous.map((m) =>
          m.id === assistantId ? { ...m, failed: true } : m,
        ),
      );
      setError(
        abort.signal.aborted
          ? new Error(
              "Generation stopped. The unfinished answer was not saved.",
            )
          : e,
      );
      if (!activeId) setInput(message);
    } finally {
      streaming.current = false;
      setBusy(false);
      controller.current = null;
      void client.invalidateQueries({ queryKey: ["conversations", space.id] });
      // Reload persisted answers; retain explicit partial failures until the next visit.
      if (activeId)
        void client.invalidateQueries({
          queryKey: ["thread", space.id, activeId],
          exact: true,
          refetchType: completed ? "active" : "none",
        });
    }
  }
  function newConversation() {
    if (busy) return;
    setParams({});
    setMessages([]);
    setError(null);
    setInput("");
    setHistoryOpen(false);
  }
  function selectConversation(id: string) {
    if (busy) return;
    setMessages([]);
    setParams({ conversation: id });
    setError(null);
    setHistoryOpen(false);
    void client.invalidateQueries({ queryKey: ["thread", space.id, id] });
  }
  async function removeConversation() {
    if (!removing) return;
    setDeleteBusy(true);
    try {
      await api(`/spaces/${space.id}/conversations/${removing.id}`, {
        method: "DELETE",
      });
      if (removing.id === conversationId) newConversation();
      await client.invalidateQueries({ queryKey: ["conversations", space.id] });
      setRemoving(null);
      toast("Conversation removed.");
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Could not remove this conversation.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Answer copied.");
    } catch {
      toast("Clipboard is unavailable in this browser.");
    }
  }
  return (
    <>
      <SectionHeading
        eyebrow="FOLLOW A BETTER QUESTION"
        title="Ask your knowledge."
        description="Connected context. Clear answers. Sources you can follow."
        action={
          <div className="heading-actions">
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              <History size={16} /> History
            </button>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={newConversation}
            >
              <Plus size={16} /> New conversation
            </button>
          </div>
        }
      />
      <section className="chat-shell">
        {historyOpen && (
          <aside className="chat-history">
            <div className="panel-heading">
              <h3>Your conversations</h3>
              <button
                className="icon-button"
                onClick={() => setHistoryOpen(false)}
                aria-label="Close conversation history"
              >
                <X size={17} />
              </button>
            </div>
            {conversations.isPending ? (
              <Spinner />
            ) : conversations.error ? (
              <ErrorBox error={conversations.error} />
            ) : conversations.data?.length ? (
              conversations.data.map((c) => (
                <div
                  className={`history-row ${c.id === conversationId ? "active" : ""}`}
                  key={c.id}
                >
                  <button
                    disabled={busy}
                    onClick={() => selectConversation(c.id)}
                  >
                    <MessageSquare size={14} />
                    <span>{c.title}</span>
                  </button>
                  <button
                    className="icon-button"
                    disabled={busy}
                    onClick={() => setRemoving(c)}
                    aria-label={`Remove conversation ${c.title}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            ) : (
              <p className="muted">
                Your saved conversations will appear here.
              </p>
            )}
          </aside>
        )}
        <div className="chat-area">
          <div className="chat-topline">
            <span>
              <Sparkles size={15} /> KNOWSPHERE RESEARCH ASSISTANT
            </span>
            <span>
              <Check size={12} /> SOURCE-GROUNDED
            </span>
          </div>
          <div
            className="chat-scroll"
            ref={scrolling}
            onScroll={() => {
              const el = scrolling.current;
              if (el)
                nearBottom.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 180;
            }}
          >
            {thread.isPending && conversationId && !busy && !messages.length ? (
              <Spinner label="Opening conversation" />
            ) : thread.error && !busy && !messages.length ? (
              <ErrorBox
                error={thread.error}
                retry={() => void thread.refetch()}
              />
            ) : !messages.length ? (
              <div className="chat-welcome">
                <div className="chat-welcome-icon">
                  <Sparkles size={28} />
                </div>
                <span className="eyebrow">
                  EVERY QUESTION IS A NEW CONNECTION.
                </span>
                <h2>What are you curious about?</h2>
                <p>
                  Ask about the ideas, people, and connections in your indexed
                  sources. I’ll bring the relevant passages together.
                </p>
                <div className="chat-suggestions">
                  {suggestions.map((text) => (
                    <button key={text} onClick={() => setInput(text)}>
                      {text}
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
                <small>
                  <BookOpen size={13} /> Add and index a source before asking
                  your first question.
                </small>
              </div>
            ) : (
              <div className="messages">
                {messages.map((message, i) => (
                  <article
                    className={`message message-${message.role} ${message.failed ? "message-failed" : ""}`}
                    key={message.id}
                  >
                    <div
                      className={`message-avatar ${message.role === "assistant" ? "assistant-avatar" : ""}`}
                    >
                      {message.role === "assistant" ? (
                        <Sparkles size={16} />
                      ) : (
                        "You"
                      )}
                    </div>
                    <div className="message-body">
                      <div className="message-byline">
                        {message.role === "assistant" ? "KnowSphere" : "You"}
                        {message.role === "assistant" && (
                          <span>
                            {busy && i === messages.length - 1
                              ? "RESEARCHING"
                              : message.failed
                                ? "UNFINISHED · NOT SAVED"
                                : "GROUNDED IN YOUR SOURCES"}
                          </span>
                        )}
                      </div>
                      {message.content ? (
                        <div className="markdown">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ children, href }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : busy && i === messages.length - 1 ? (
                        <div
                          className="thinking"
                          aria-label="Finding relevant context"
                        >
                          <i />
                          <i />
                          <i />
                          <span>Connecting the context…</span>
                        </div>
                      ) : (
                        <p className="muted">
                          No complete answer was returned.
                        </p>
                      )}
                      {message.role === "assistant" && message.content && (
                        <div className="message-tools">
                          {message.citations.length > 0 && (
                            <button
                              onClick={() => setCitations(message.citations)}
                            >
                              <BookOpen size={13} />
                              {message.citations.length}{" "}
                              {busy && i === messages.length - 1
                                ? "retrieved sources"
                                : "sources"}
                              <ChevronRight size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => void copy(message.content)}
                            aria-label="Copy answer"
                          >
                            <Copy size={13} /> Copy
                          </button>
                          {message.model && (
                            <span>{message.model.split("/").pop()}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className="chat-composer-area">
            {!!error && <ErrorBox error={error} />}
            <form className="chat-composer" onSubmit={send}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about your sources…"
                aria-label="Your question"
                rows={2}
                maxLength={3000}
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!busy) e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <div className="composer-bottom">
                <span>
                  <GitBranchIcon /> Connected to {space.name}
                </span>
                {busy ? (
                  <button
                    type="button"
                    className="send-button stop-button"
                    aria-label="Stop generating"
                    onClick={() => controller.current?.abort()}
                  >
                    <Square size={14} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="send-button"
                    disabled={input.trim().length < 2}
                    aria-label="Send question"
                  >
                    <ArrowUp size={19} />
                  </button>
                )}
              </div>
            </form>
            <p className="chat-disclaimer">
              AI can make mistakes. Follow the citations and check the original
              source. Enter to send, Shift + Enter for a new line.
            </p>
          </div>
        </div>
      </section>
      {citations && (
        <Modal
          title="Follow the sources"
          onClose={() => setCitations(null)}
          wide
        >
          <p className="muted">
            Passages retrieved from your indexed documents. A citation shows
            provenance; check the source to assess the claim.
          </p>
          <div className="citation-list">
            {citations.map((c) => (
              <div className="citation-card" key={c.index}>
                <span className="citation-number">[{c.index}]</span>
                <div>
                  <h3>{c.title}</h3>
                  <small>Excerpt {c.ordinal + 1}</small>
                  <blockquote>{c.excerpt}</blockquote>
                  <SourceButton
                    title="Open original source"
                    onClick={() => {
                      setCitations(null);
                      openDocument(c.document_id);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {removing && (
        <Modal
          title="Remove this conversation?"
          onClose={() => {
            if (!deleteBusy) setRemoving(null);
          }}
        >
          <p className="muted">
            “{removing.title}” and its saved messages will be removed.
          </p>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              disabled={deleteBusy}
              onClick={() => setRemoving(null)}
            >
              Keep conversation
            </button>
            <button
              className="button button-danger"
              disabled={deleteBusy}
              onClick={() => void removeConversation()}
            >
              {deleteBusy ? "Removing…" : "Remove conversation"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function GitBranchIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="4" cy="3" r="2" />
      <circle cx="12" cy="5" r="2" />
      <circle cx="4" cy="13" r="2" />
      <path d="M4 5v6m0-3c5 0 8 1 8-1" />
    </svg>
  );
}
