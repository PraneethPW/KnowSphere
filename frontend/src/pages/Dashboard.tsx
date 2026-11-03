import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Boxes,
  CircleDot,
  GitBranch,
  Layers3,
  LockKeyhole,
  Network,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api, downloadGraph, post } from "../api";
import type { GraphData, OverviewData, SystemInfo } from "../types";
import { KIND_COLORS } from "../types";
import {
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
export { default as Overview } from "./CommandCenter";

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
        eyebrow="ANALYSIS / PATTERN INTELLIGENCE"
        title="Graph analysis"
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
        eyebrow="SYSTEM / SERVICE DIAGNOSTICS"
        title="System control"
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
                    <small>
                      Answers: {system.data.model}
                      <br />
                      Extraction: {system.data.extraction_model}
                    </small>
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
