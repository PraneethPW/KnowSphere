import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  FileText,
  GitBranch,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { api } from "../api";
import type { Document, SystemInfo } from "../types";
import { useWorkspace } from "../Workspace";
import { useOverview } from "./Dashboard";
import { useLive } from "../live";
import { date, Empty, ErrorBox, number, Spinner } from "../components/UI";

export default function DashboardHome() {
  const { space, user, openSearch, openDocument } = useWorkspace();
  const stats = useOverview(),
    live = useLive(),
    navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const documents = useQuery({
    queryKey: ["documents", space.id],
    queryFn: () => api<Document[]>(`/spaces/${space.id}/documents`),
  });
  const system = useQuery({
    queryKey: ["system"],
    queryFn: () => api<SystemInfo>("/system"),
    refetchInterval: 30_000,
  });
  function ask(event: FormEvent) {
    event.preventDefault();
    if (question.trim().length >= 2)
      navigate(`/app/chat?question=${encodeURIComponent(question.trim())}`);
  }
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <h1>Your workspace</h1>
          <p>
            Welcome back, {user.name.split(" ")[0]}. What would you like to
            learn?
          </p>
        </div>
        <Link className="button button-primary" to="/app/library?add=1">
          <Plus size={18} /> Add source
        </Link>
      </div>
      <section className="dashboard-ask panel" aria-labelledby="ask-title">
        <span className="product-label">
          <Sparkles size={17} /> AI answers, grounded in your sources
        </span>
        <h2 id="ask-title">Ask your documents.</h2>
        <form onSubmit={ask}>
          <label className="sr-only" htmlFor="dashboard-question">
            Question about your sources
          </label>
          <input
            id="dashboard-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={3000}
            placeholder="What would you like to know?"
            minLength={2}
            required
          />
          <button
            className="button button-primary"
            disabled={question.trim().length < 2}
          >
            Ask AI
          </button>
        </form>
        <div className="dashboard-search-link">
          <button onClick={() => openSearch(question.trim())}>
            <Search size={16} /> Search source passages instead
          </button>
          <span>ML-ranked results · Original text</span>
        </div>
      </section>
      {stats.error && (
        <ErrorBox error={stats.error} retry={() => void stats.refetch()} />
      )}
      <div className="dashboard-stats">
        {[
          {
            label: "Ready sources",
            value: stats.data?.ready_documents,
            icon: FileText,
            to: "/app/library",
          },
          {
            label: "Processing",
            value: stats.data?.active_jobs,
            icon: Activity,
            to: "/app/operations",
          },
          {
            label: "Entities",
            value: stats.data?.entities,
            icon: GitBranch,
            to: "/app/graph",
          },
          {
            label: "Connections",
            value: stats.data?.relationships,
            icon: GitBranch,
            to: "/app/graph",
          },
        ].map(({ label, value, icon: Icon, to }) => (
          <Link key={label} to={to}>
            <div>
              <Icon size={17} />
              <span>{label}</span>
            </div>
            <strong>{number(value)}</strong>
          </Link>
        ))}
      </div>
      {!!stats.data?.failed_jobs && (
        <div className="notice">
          <Link to="/app/library">
            {stats.data.failed_jobs} source(s) need attention. Open Sources to
            review or retry.
          </Link>
        </div>
      )}
      <div className="dashboard-content">
        <section className="panel recent-sources">
          <div className="panel-heading">
            <h2>Recent sources</h2>
            <Link className="text-link" to="/app/library">
              View all
            </Link>
          </div>
          {documents.isPending ? (
            <Spinner label="Loading sources" />
          ) : documents.error ? (
            <ErrorBox
              error={documents.error}
              retry={() => void documents.refetch()}
            />
          ) : !documents.data?.length ? (
            <Empty
              icon={<FileText size={30} />}
              title="Start with a source"
              description="Upload a document or paste text to use search, AI answers, and the knowledge graph."
              action={
                <Link
                  className="button button-secondary"
                  to="/app/library?add=1"
                >
                  Add your first source
                </Link>
              }
            />
          ) : (
            <div className="dashboard-source-list">
              {documents.data.slice(0, 5).map((doc) => (
                <button key={doc.id} onClick={() => openDocument(doc.id)}>
                  <FileText size={19} />
                  <span>
                    <strong>{doc.title}</strong>
                    <small>
                      {doc.format.toUpperCase()} · {date(doc.created_at)}
                    </small>
                  </span>
                  <span className={`status-badge status-${doc.status}`}>
                    {doc.status === "processing"
                      ? `${doc.progress}%`
                      : doc.status}
                  </span>
                </button>
              ))}
            </div>
          )}
          <Link className="dashboard-activity-link" to="/app/operations">
            <span
              className={`live-indicator ${live.connected ? "connected" : ""}`}
            />
            {live.connected ? "Live updates connected" : "Updates reconnecting"}
            <span>View activity</span>
          </Link>
        </section>
        <section className="panel dashboard-intelligence">
          <div className="panel-heading">
            <h2>AI & ML</h2>
            <Link className="text-link" to="/app/settings">
              Details
            </Link>
          </div>
          {system.isPending ? (
            <Spinner label="Checking services" />
          ) : system.error ? (
            <ErrorBox
              error={system.error}
              retry={() => void system.refetch()}
            />
          ) : (
            <>
              <div className="intelligence-item">
                <Search size={19} />
                <div>
                  <strong>ML passage ranking</strong>
                  <p>MiniLM ranks matching passages for search and answers.</p>
                </div>
                <span
                  className={`health-label ${system.data?.ml?.ready ? "healthy" : ""}`}
                >
                  {!system.data?.ml
                    ? "Unknown"
                    : !system.data.ml.enabled
                      ? "Disabled"
                      : system.data.ml.ready
                        ? "Ready"
                        : "Unavailable"}
                </span>
              </div>
              <div className="intelligence-item">
                <Sparkles size={19} />
                <div>
                  <strong>Cited AI answers</strong>
                  <p>Ask questions and open the supporting sources.</p>
                </div>
                <span
                  className={`health-label ${system.data?.ai_configured ? "healthy" : ""}`}
                >
                  {system.data?.ai_configured ? "Configured" : "Setup needed"}
                </span>
              </div>
              <div className="intelligence-item">
                <Activity size={19} />
                <div>
                  <strong>Document processing</strong>
                  <p>Extracts text, entities, and supported relationships.</p>
                </div>
                <span
                  className={`health-label ${system.data?.worker === "online" ? "healthy" : ""}`}
                >
                  {system.data?.worker === "online" ? "Online" : "Offline"}
                </span>
              </div>
            </>
          )}
          <Link className="dashboard-activity-link" to="/app/graph">
            <GitBranch size={16} /> Explore your knowledge graph
          </Link>
        </section>
      </div>
    </>
  );
}
