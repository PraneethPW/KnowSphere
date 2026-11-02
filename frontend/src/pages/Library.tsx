import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Check,
  Clock3,
  File,
  FileText,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { api, post } from "../api";
import type { Document, SourceDocument } from "../types";
import {
  date,
  Empty,
  ErrorBox,
  Modal,
  number,
  SectionHeading,
  Spinner,
  useToast,
} from "../components/UI";
import { useWorkspace } from "../Workspace";

export function SourceModal({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { space } = useWorkspace();
  const query = useQuery({
    queryKey: ["document", space.id, id],
    queryFn: () => api<SourceDocument>(`/spaces/${space.id}/documents/${id}`),
  });
  return (
    <Modal
      title={query.data?.title || "Source document"}
      onClose={onClose}
      wide
    >
      {query.isPending ? (
        <Spinner label="Opening the source" />
      ) : query.error ? (
        <ErrorBox error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="source-meta">
            <span className={`status-badge status-${query.data?.status}`}>
              {query.data?.status}
            </span>
            <span>
              Original extracted text · {number(query.data?.content.length)}{" "}
              characters
            </span>
          </div>
          <pre className="source-content">{query.data?.content}</pre>
        </>
      )}
    </Modal>
  );
}

function AddSource({ onClose }: { onClose: () => void }) {
  const { space } = useWorkspace(),
    client = useQueryClient(),
    toast = useToast();
  const [mode, setMode] = useState<"file" | "text">("file"),
    [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [chars, setChars] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  function selectFile(selected: File | undefined) {
    if (!selected) return;
    if (selected.size > 10_000_000) {
      setError(new Error("Files are limited to 10 MB."));
      return;
    }
    if (!/\.(pdf|txt|md|csv)$/i.test(selected.name)) {
      setError(new Error("Choose a PDF, TXT, Markdown, or CSV file."));
      return;
    }
    setFile(selected);
    setError(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "file") {
        if (!file) throw new Error("Choose a file to continue.");
        const form = new FormData();
        form.append("file", file);
        await api(`/spaces/${space.id}/documents/upload`, {
          method: "POST",
          body: form,
        });
      } else {
        const form = new FormData(event.currentTarget);
        await post(`/spaces/${space.id}/documents/text`, {
          title: form.get("title"),
          content: form.get("content"),
        });
      }
      await Promise.all(
        ["documents", "overview"].map((key) =>
          client.invalidateQueries({ queryKey: [key, space.id] }),
        ),
      );
      toast("Source added. Ingestion is queued.");
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Bring a source into your sphere"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="muted">
        We’ll extract its entities and relationships, keeping every supporting
        quote connected to the original.
      </p>
      <div className="tabs source-tabs">
        <button
          className={mode === "file" ? "active" : ""}
          disabled={busy}
          onClick={() => setMode("file")}
        >
          <UploadCloud size={15} /> Upload a file
        </button>
        <button
          className={mode === "text" ? "active" : ""}
          disabled={busy}
          onClick={() => setMode("text")}
        >
          <FileText size={15} /> Paste text
        </button>
      </div>
      <form className="form-stack" onSubmit={submit}>
        {mode === "file" ? (
          <>
            <input
              ref={input}
              className="sr-only"
              type="file"
              aria-label="Choose source document"
              accept=".pdf,.txt,.md,.csv"
              disabled={busy}
              onChange={(e) => selectFile(e.target.files?.[0])}
            />
            <button
              type="button"
              className={`dropzone ${dragging ? "dragging" : ""}`}
              disabled={busy}
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                selectFile(e.dataTransfer.files[0]);
              }}
            >
              {file ? (
                <>
                  <FileText size={34} />
                  <strong>{file.name}</strong>
                  <span>
                    {(file.size / 1000).toFixed(0)} KB · Click to choose another
                    file
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud size={36} />
                  <strong>Drop a document here</strong>
                  <span>or click to browse your files</span>
                  <small>PDF, TXT, MD, CSV · Up to 10 MB</small>
                </>
              )}
            </button>
            <p className="small-print">
              Up to 120,000 characters of text per source. Scanned PDFs need OCR
              before upload.
            </p>
          </>
        ) : (
          <>
            <label>
              Source title
              <input
                name="title"
                maxLength={180}
                placeholder="Give this source a name"
                required
                disabled={busy}
              />
            </label>
            <label>
              Source text
              <textarea
                name="content"
                rows={9}
                minLength={40}
                maxLength={120000}
                required
                placeholder="Paste the passage you want to understand…"
                onChange={(e) => setChars(e.target.value.length)}
                disabled={busy}
              />
              <span className="character-count">
                {number(chars)} / 120,000 characters
              </span>
            </label>
          </>
        )}
        {!!error && <ErrorBox error={error} />}
        <p className="upload-consent">
          This document’s text will be sent to OpenRouter for AI extraction.
        </p>
        <button
          className="button button-primary"
          type="submit"
          disabled={busy || (mode === "file" && !file)}
        >
          {busy ? (
            <Spinner label="Adding your source" />
          ) : (
            <>
              Add source & build connections <ArrowUpRight size={17} />
            </>
          )}
        </button>
      </form>
    </Modal>
  );
}

export default function Library() {
  const { space } = useWorkspace(),
    client = useQueryClient(),
    toast = useToast();
  const [params, setParams] = useSearchParams(),
    [adding, setAdding] = useState(false),
    [remove, setRemove] = useState<Document | null>(null);
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  const documents = useQuery({
    queryKey: ["documents", space.id],
    queryFn: () => api<Document[]>(`/spaces/${space.id}/documents`),
  });
  const mutation = useMutation({
    mutationFn: async ({ doc, action }: { doc: Document; action: string }) => {
      if (action === "delete")
        await api(`/spaces/${space.id}/documents/${doc.id}`, {
          method: "DELETE",
        });
      else await post(`/spaces/${space.id}/documents/${doc.id}/${action}`);
    },
    onSuccess: (_, { action }) => {
      for (const key of ["documents", "graph", "overview"])
        void client.invalidateQueries({ queryKey: [key, space.id] });
      setRemove(null);
      toast(
        action === "delete"
          ? "Source and its graph evidence removed."
          : action === "retry"
            ? "Ingestion queued again."
            : "Ingestion cancelled.",
      );
    },
  });
  const filtered =
    documents.data?.filter(
      (d) =>
        d.title.toLowerCase().includes(search.toLowerCase()) &&
        (filter === "all" ||
          (filter === "active" &&
            ["queued", "processing"].includes(d.status)) ||
          (filter === "attention" &&
            ["failed", "cancelled"].includes(d.status)) ||
          d.status === filter),
    ) || [];
  return (
    <>
      <SectionHeading
        eyebrow="THE FOUNDATION OF YOUR KNOWLEDGE"
        title="Your source library."
        description="Bring your research together. Every source adds a new perspective."
        action={
          <button
            className="button button-primary"
            onClick={() => setAdding(true)}
          >
            <Plus size={17} /> Add a source
          </button>
        }
      />
      <div className="library-summary">
        <div>
          <FileText size={17} />
          <strong>{number(documents.data?.length)}</strong>
          <span>sources in this space</span>
        </div>
        <span>
          <Activity size={14} /> Ingestion updates live
        </span>
      </div>
      <section className="panel library-panel">
        <div className="library-toolbar">
          <div className="tabs">
            {[
              ["all", "All sources"],
              ["ready", "Ready"],
              ["active", "Processing"],
              ["attention", "Needs attention"],
            ].map(([key, label]) => (
              <button
                className={filter === key ? "active" : ""}
                key={key}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="input-icon">
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a source…"
              aria-label="Search sources"
            />
          </div>
        </div>
        {mutation.error && <ErrorBox error={mutation.error} />}
        {documents.isPending ? (
          <Spinner label="Loading your sources" />
        ) : documents.error ? (
          <ErrorBox
            error={documents.error}
            retry={() => void documents.refetch()}
          />
        ) : !documents.data?.length ? (
          <Empty
            icon={<FileText size={40} />}
            title="An open space for your ideas."
            description="Start with a paper, a set of notes, or a passage you want to understand. Your first connection is one upload away."
            action={
              <button
                className="button button-primary"
                onClick={() => setAdding(true)}
              >
                <Plus size={16} /> Add your first source
              </button>
            }
          />
        ) : !filtered.length ? (
          <Empty
            icon={<Search size={32} />}
            title="No matching sources."
            description="Try a different search or status filter."
          />
        ) : (
          <>
            <div className="source-table-header">
              <span>SOURCE</span>
              <span>STATUS</span>
              <span>ADDED</span>
              <span>ACTIONS</span>
            </div>
            <div className="document-list">
              {filtered.map((d, i) => (
                <motion.article
                  key={d.id}
                  className="document-row"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 6) * 0.03 }}
                >
                  <div className="document-main">
                    <span className="file-icon">
                      <FileText size={20} />
                    </span>
                    <div>
                      <button
                        onClick={() => setParams({ document: d.id })}
                        className="document-title"
                      >
                        {d.title}
                        <ArrowUpRight size={13} />
                      </button>
                      <small>
                        {d.format.toUpperCase()} <span>·</span>{" "}
                        {number(d.characters)} characters
                      </small>
                      {d.error && <p className="document-error">{d.error}</p>}
                      {d.status === "processing" && (
                        <div
                          className="job-progress"
                          role="progressbar"
                          aria-label={`Indexing ${d.title}`}
                          aria-valuenow={d.progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <span style={{ width: `${d.progress}%` }} />
                        </div>
                      )}
                      {d.status === "queued" && d.attempts > 0 && (
                        <p className="retry-note">
                          Retry scheduled for{" "}
                          {new Date(d.available_at).toLocaleTimeString()} ·
                          attempt {d.attempts}/3
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className={`status-badge status-${d.status}`}>
                      {d.status === "ready" ? (
                        <Check size={11} />
                      ) : d.status === "processing" ? (
                        <Activity size={11} />
                      ) : (
                        <Clock3 size={11} />
                      )}
                      {d.status}
                      {d.status === "processing" && ` ${d.progress}%`}
                    </span>
                  </div>
                  <span className="document-date">{date(d.created_at)}</span>
                  <div className="document-actions">
                    {["failed", "cancelled"].includes(d.status) && (
                      <button
                        disabled={mutation.isPending}
                        className="icon-button"
                        title="Retry ingestion"
                        aria-label={`Retry ${d.title}`}
                        onClick={() =>
                          mutation.mutate({ doc: d, action: "retry" })
                        }
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                    {["queued", "processing"].includes(d.status) && (
                      <button
                        disabled={mutation.isPending}
                        className="icon-button"
                        title="Cancel ingestion"
                        aria-label={`Cancel ${d.title}`}
                        onClick={() =>
                          mutation.mutate({ doc: d, action: "cancel" })
                        }
                      >
                        <X size={16} />
                      </button>
                    )}
                    <button
                      className="icon-button delete-button"
                      title="Remove source"
                      aria-label={`Remove ${d.title}`}
                      onClick={() => {
                        setRemove(d);
                        mutation.reset();
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.article>
              ))}
            </div>
          </>
        )}
      </section>
      <div className="library-footnote">
        <File size={14} />
        <span>
          Supported formats: PDF, Markdown, TXT, CSV. Sources stay within this
          knowledge space.
        </span>
      </div>
      {adding && <AddSource onClose={() => setAdding(false)} />}
      {params.get("document") && (
        <SourceModal
          id={params.get("document")!}
          onClose={() => setParams({})}
        />
      )}
      {remove && (
        <Modal
          title="Remove this source?"
          onClose={() => {
            if (!mutation.isPending) setRemove(null);
          }}
        >
          <p className="muted">
            <strong>{remove.title}</strong> and its extracted evidence will be
            removed. Entities supported by other sources will remain.
          </p>
          {mutation.error && <ErrorBox error={mutation.error} />}
          <div className="modal-actions">
            <button
              className="button button-secondary"
              disabled={mutation.isPending}
              onClick={() => setRemove(null)}
            >
              Keep source
            </button>
            <button
              className="button button-danger"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ doc: remove, action: "delete" })}
            >
              {mutation.isPending ? "Removing…" : "Remove source"}
              <Trash2 size={15} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
