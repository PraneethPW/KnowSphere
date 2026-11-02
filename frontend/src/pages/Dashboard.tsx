import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Boxes,
  Check,
  ChevronRight,
  CircleDot,
  FileText,
  GitBranch,
  Layers3,
  LockKeyhole,
  MessageSquare,
  Network,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { api, downloadGraph, post } from "../api";
import type { Document, GraphData, OverviewData, SystemInfo } from "../types";
import { KIND_COLORS } from "../types";
import {
  date,
  Empty,
  ErrorBox,
  number,
  SectionHeading,
  Spinner,
  useToast,
} from "../components/UI";
import { useWorkspace } from "../Workspace";

export function useOverview() {
  const { space } = useWorkspace();
  return useQuery({
    queryKey: ["overview", space.id],
    queryFn: () => api<OverviewData>(`/spaces/${space.id}/overview`),
  });
}
export function useGraph() {
  const { space } = useWorkspace();
  return useQuery({
    queryKey: ["graph", space.id],
    queryFn: () => api<GraphData>(`/spaces/${space.id}/graph`),
  });
}
export function Overview() {
  const { space, user } = useWorkspace(),
    stats = useOverview(),
    graph = useGraph();
  const documents = useQuery({
    queryKey: ["documents", space.id],
    queryFn: () => api<Document[]>(`/spaces/${space.id}/documents`),
  });
  const navigate = useNavigate();
  const topNodes = [...(graph.data?.nodes || [])]
    .sort((a, b) => b.centrality - a.centrality)
    .slice(0, 5);
  return (
    <>
      <SectionHeading
        eyebrow="A LITTLE CURIOSITY GOES A LONG WAY"
        title={`Welcome to your sphere, ${user.name.split(" ")[0]}.`}
        description="A connected view of everything you’re learning."
        action={
          <Link className="button button-primary" to="/app/library">
            <Plus size={17} /> Add a source
          </Link>
        }
      />
      {stats.error && (
        <ErrorBox error={stats.error} retry={() => void stats.refetch()} />
      )}
      <div className="stats-grid">
        {[
          {
            title: "Indexed sources",
            value: stats.data?.ready_documents,
            total: stats.data
              ? `${stats.data.documents} total documents`
              : "From your source library",
            icon: FileText,
          },
          {
            title: "Connected entities",
            value: stats.data?.entities,
            total: "Ideas, people, places & more",
            icon: CircleDot,
          },
          {
            title: "Relationships",
            value: stats.data?.relationships,
            total: "Backed by source evidence",
            icon: GitBranch,
          },
          {
            title: "Active jobs",
            value: stats.data?.active_jobs,
            total: stats.data?.failed_jobs
              ? `${stats.data.failed_jobs} need your attention`
              : "Live ingestion progress",
            icon: Activity,
          },
        ].map((s, i) => (
          <motion.div
            className="stat-card"
            key={s.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <div>
              <span>{s.title}</span>
              <s.icon size={17} />
            </div>
            <strong>{number(s.value)}</strong>
            <small>{s.total}</small>
          </motion.div>
        ))}
      </div>
      <div className="overview-columns">
        <section className="panel graph-preview">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">EXPAND YOUR PERSPECTIVE</span>
              <h2>Your knowledge, connected.</h2>
            </div>
            <Link
              className="icon-button"
              to="/app/graph"
              aria-label="Open knowledge graph"
            >
              <ArrowUpRight size={20} />
            </Link>
          </div>
          {graph.isPending ? (
            <Spinner label="Reading your graph" />
          ) : graph.error ? (
            <ErrorBox error={graph.error} retry={() => void graph.refetch()} />
          ) : graph.data?.nodes.length ? (
            <div className="graph-overview-real">
              <div className="constellation-list">
                {topNodes.map((n, i) => (
                  <button
                    key={n.id}
                    onClick={() => navigate(`/app/graph?entity=${n.id}`)}
                    className={`constellation-item position-${i}`}
                  >
                    <i style={{ background: KIND_COLORS[n.kind] }} />
                    <span>{n.name}</span>
                    <small>{n.degree} connections</small>
                  </button>
                ))}
              </div>
              <div className="graph-overview-info">
                <span>
                  {number(graph.data.communities)} communities in the visible
                  graph
                </span>
                <Link to="/app/graph">
                  Explore in 3D <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ) : (
            <Empty
              icon={<Network size={40} />}
              title="Your universe starts with a source."
              description="Add a document to reveal its entities and the relationships that connect them."
              action={
                <Link className="button button-secondary" to="/app/library">
                  Bring your first source <ArrowUpRight size={16} />
                </Link>
              }
            />
          )}
        </section>
        <section className="panel ask-preview">
          <span className="eyebrow">
            <Sparkles size={14} /> ASK KNOWSPHERE
          </span>
          <h2>
            Better questions.
            <br />
            <span>Connected answers.</span>
          </h2>
          <p>
            Ask across your sources. Follow the evidence. Find an answer with
            context.
          </p>
          <div className="prompt-preview">
            <MessageSquare size={18} />
            <span>What connects the ideas in my research?</span>
          </div>
          <Link className="button button-primary" to="/app/chat">
            Start a conversation <ArrowUpRight size={16} />
          </Link>
          <small>
            <ShieldCheck size={13} /> Cited passages, inspectable sources.
          </small>
        </section>
      </div>
      <div className="overview-columns lower">
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent sources</h2>
            <Link className="text-link" to="/app/library">
              View library <ArrowRight size={14} />
            </Link>
          </div>
          {documents.isPending ? (
            <Spinner />
          ) : documents.error ? (
            <ErrorBox
              error={documents.error}
              retry={() => void documents.refetch()}
            />
          ) : documents.data?.length ? (
            <div className="recent-list">
              {documents.data.slice(0, 5).map((d) => (
                <button
                  className="recent-row"
                  key={d.id}
                  onClick={() => navigate(`/app/library?document=${d.id}`)}
                >
                  <span className="file-icon">
                    <FileText size={18} />
                  </span>
                  <div>
                    <strong>{d.title}</strong>
                    <small>
                      {d.format.toUpperCase()} · {date(d.created_at)}
                    </small>
                  </div>
                  <span className={`status-badge status-${d.status}`}>
                    {d.status === "ready" ? (
                      <Check size={11} />
                    ) : d.status === "processing" ? (
                      <Activity size={11} />
                    ) : null}
                    {d.status}
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <div className="compact-empty">
              <BookOpen size={24} />
              <p>No sources yet. Your library is ready when you are.</p>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Live activity</h2>
            <span className="tiny-tag">FROM YOUR SPACE</span>
          </div>
          {stats.data?.recent_activity.length ? (
            <div className="activity-list">
              {stats.data.recent_activity.slice(0, 6).map((e) => (
                <div className="activity-item" key={e.id}>
                  <span className="activity-dot" />
                  <div>
                    <strong>
                      {e.kind === "document.created"
                        ? "Source added"
                        : e.kind === "graph.updated"
                          ? "Graph updated"
                          : e.kind === "conversation.updated"
                            ? "Answer saved"
                            : "Ingestion progress updated"}
                    </strong>
                    <p>
                      {e.payload.title ||
                        (e.payload.status === "ready"
                          ? "Source indexed and ready to explore"
                          : e.payload.progress !== undefined
                            ? `${e.payload.progress}% processed`
                            : "Your space has new activity")}
                    </p>
                  </div>
                  <small>
                    {new Date(e.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <div className="compact-empty">
              <Zap size={24} />
              <p>
                Activity will appear here as you build your knowledge space.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function Insights() {
  const graph = useGraph(),
    navigate = useNavigate();
  const ranked = [...(graph.data?.nodes || [])]
    .sort((a, b) => b.centrality - a.centrality)
    .slice(0, 10);
  const kinds = Object.entries(
    (graph.data?.nodes || []).reduce<Record<string, number>>(
      (all, n) => ({ ...all, [n.kind]: (all[n.kind] || 0) + 1 }),
      {},
    ),
  ).sort((a, b) => b[1] - a[1]);
  const communities = Object.entries(
    (graph.data?.nodes || []).reduce<Record<string, typeof ranked>>(
      (all, n) => {
        (all[n.community] ||= []).push(n);
        return all;
      },
      {},
    ),
  ).sort((a, b) => b[1].length - a[1].length);
  return (
    <>
      <SectionHeading
        eyebrow="FOLLOW THE PATTERNS"
        title="A different kind of discovery."
        description="Data-driven graph analysis reveals what’s central, what’s connected, and what stands apart."
      />
      {graph.isPending ? (
        <Spinner label="Analyzing the graph" />
      ) : graph.error ? (
        <ErrorBox error={graph.error} retry={() => void graph.refetch()} />
      ) : !ranked.length ? (
        <div className="panel">
          <Empty
            icon={<Boxes size={38} />}
            title="Patterns need a starting point."
            description="Index your first document to discover communities and influential concepts in your graph."
            action={
              <Link to="/app/library" className="button button-primary">
                Add a source <Plus size={16} />
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {graph.data?.truncated && (
            <div className="notice">
              Analysis covers the visible graph: up to 600 entities and 4,000
              relationships.
            </div>
          )}
          <div className="insight-stats">
            <div className="panel">
              <Layers3 />
              <strong>{number(graph.data?.communities)}</strong>
              <span>Detected communities</span>
            </div>
            <div className="panel">
              <Network />
              <strong>{number(graph.data?.components)}</strong>
              <span>Connected components</span>
            </div>
            <div className="panel">
              <Users />
              <strong>{number(graph.data?.nodes.length)}</strong>
              <span>Entities analyzed</span>
            </div>
          </div>
          <div className="overview-columns">
            <section className="panel">
              <div className="panel-heading">
                <h2>Ideas at the center</h2>
                <span className="tiny-tag">PAGERANK</span>
              </div>
              <p className="panel-description">
                Influence within the visible graph. This measures connectivity,
                not factual reliability.
              </p>
              <div className="ranking-list">
                {ranked.map((n, i) => (
                  <button
                    key={n.id}
                    onClick={() => navigate(`/app/graph?entity=${n.id}`)}
                  >
                    <span className="rank-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <i style={{ background: KIND_COLORS[n.kind] }} />
                    <div>
                      <strong>{n.name}</strong>
                      <div className="rank-track">
                        <span
                          style={{
                            width: `${(n.centrality / (ranked[0]?.centrality || 1)) * 100}%`,
                            background: KIND_COLORS[n.kind],
                          }}
                        />
                      </div>
                    </div>
                    <span>{(n.centrality * 100).toFixed(1)}%</span>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>The shape of your knowledge</h2>
                <CircleDot size={17} />
              </div>
              <p className="panel-description">
                Entity types extracted from your indexed sources.
              </p>
              <div className="kind-bars">
                {kinds.map(([kind, count]) => (
                  <div key={kind}>
                    <div>
                      <span>
                        <i style={{ background: KIND_COLORS[kind] }} />
                        {kind}
                      </span>
                      <strong>{count}</strong>
                    </div>
                    <div className="kind-track">
                      <span
                        style={{
                          width: `${(count / (graph.data?.nodes.length || 1)) * 100}%`,
                          background: KIND_COLORS[kind],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="panel community-panel">
            <div className="panel-heading">
              <h2>Connected communities</h2>
              <span className="tiny-tag">LOUVAIN ALGORITHM</span>
            </div>
            <p className="panel-description">
              Groups formed by connection density. Names below come directly
              from their entities.
            </p>
            <div className="community-grid">
              {communities.slice(0, 12).map(([id, nodes]) => (
                <button
                  key={id}
                  className="community-card"
                  onClick={() => navigate(`/app/graph?entity=${nodes[0].id}`)}
                >
                  <span className="eyebrow">COMMUNITY {Number(id) + 1}</span>
                  <h3>
                    {
                      [...nodes].sort((a, b) => b.centrality - a.centrality)[0]
                        .name
                    }
                  </h3>
                  <p>
                    {nodes
                      .slice(0, 3)
                      .map((n) => n.name)
                      .join(" · ")}
                  </p>
                  <div>
                    {nodes.length} entities <ArrowUpRight size={15} />
                  </div>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

export function SettingsPage() {
  const { space, user } = useWorkspace(),
    client = useQueryClient(),
    toast = useToast(),
    navigate = useNavigate();
  const system = useQuery({
    queryKey: ["system"],
    queryFn: () => api<SystemInfo>("/system"),
    refetchInterval: 30_000,
  });
  async function exportData() {
    try {
      await downloadGraph(space.id);
      toast("Graph exported with source evidence.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed.");
    }
  }
  async function revoke() {
    try {
      await post("/auth/logout-all");
      client.clear();
      navigate("/auth");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Sign out failed.");
    }
  }
  return (
    <>
      <SectionHeading
        eyebrow="YOUR WORKSPACE, UNDER THE HOOD"
        title="Settings & system status."
        description="Connection health, account details, and the tools behind your research."
      />
      {system.error && (
        <ErrorBox error={system.error} retry={() => void system.refetch()} />
      )}
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Connected services</h2>
            <Activity size={17} />
          </div>
          {system.isPending ? (
            <Spinner />
          ) : (
            system.data && (
              <>
                <div className="service-row">
                  <div>
                    <strong>PostgreSQL database</strong>
                    <small>Persistent storage</small>
                  </div>
                  <span className="service-state">
                    <i />
                    {system.data.database}
                  </span>
                </div>
                <div className="service-row">
                  <div>
                    <strong>OpenRouter AI</strong>
                    <small>{system.data.model}</small>
                  </div>
                  <span
                    className={`service-state ${!system.data.ai_configured ? "offline" : ""}`}
                  >
                    <i />
                    {system.data.ai_configured
                      ? "Key configured"
                      : "Not configured"}
                  </span>
                </div>
                <div className="service-row">
                  <div>
                    <strong>Ingestion worker</strong>
                    <small>
                      {system.data.worker_last_seen
                        ? `Last heartbeat ${new Date(system.data.worker_last_seen).toLocaleTimeString()}`
                        : "No worker heartbeat received"}
                    </small>
                  </div>
                  <span
                    className={`service-state ${system.data.worker !== "online" ? "offline" : ""}`}
                  >
                    <i />
                    {system.data.worker}
                  </span>
                </div>
                <p className="small-print">
                  Key presence does not verify provider access. Failed AI
                  requests appear in the library or conversation. Free-model
                  availability and quotas are controlled by OpenRouter.
                </p>
              </>
            )
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Your account</h2>
            <LockKeyhole size={17} />
          </div>
          <div className="account-details">
            <label>
              Name<strong>{user.name}</strong>
            </label>
            <label>
              Email<strong>{user.email}</strong>
            </label>
            <label>
              Current space<strong>{space.name}</strong>
            </label>
          </div>
          <button
            className="button button-secondary"
            onClick={() => void revoke()}
          >
            Sign out of all sessions <ArrowUpRight size={15} />
          </button>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>How discovery works</h2>
            <GitBranch size={17} />
          </div>
          <div className="method-card">
            <span className="eyebrow">RETRIEVAL</span>
            <p>{system.data?.retrieval || "Loading configuration…"}</p>
          </div>
          <div className="method-card">
            <span className="eyebrow">GRAPH ANALYSIS</span>
            <p>
              {system.data?.graph_algorithms.join(" · ") ||
                "Loading configuration…"}
            </p>
          </div>
          <div className="method-card">
            <span className="eyebrow">SOURCE VALIDATION</span>
            <p>
              Extracted quotes must occur in their source passage. This checks
              provenance; it does not independently establish truth.
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Your data</h2>
            <ShieldCheck size={17} />
          </div>
          <p className="muted">
            Export the complete indexed graph, including relationship evidence
            and source IDs. Remove individual sources from your library to
            remove their graph evidence.
          </p>
          <button
            className="button button-secondary"
            onClick={() => void exportData()}
          >
            Export knowledge graph <ArrowUpRight size={15} />
          </button>
          <div className="data-limits">
            <span className="eyebrow">WORKSPACE LIMITS</span>
            <p>
              {system.data
                ? `${number(system.data.limits.documents_per_space)} documents per space · ${number(system.data.limits.document_characters)} characters per document · ${system.data.limits.upload_bytes / 1_000_000} MB per upload`
                : "Loading…"}
            </p>
          </div>
          <p className="small-print">
            Document text is stored in PostgreSQL and relevant excerpts are sent
            to OpenRouter for AI processing. Passwords use Argon2id; session
            tokens are stored only as hashes.
          </p>
        </section>
      </div>
    </>
  );
}
