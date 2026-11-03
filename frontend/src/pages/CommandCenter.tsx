import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Crosshair,
  FileText,
  GitBranch,
  Network,
  Plus,
  Radio,
} from "lucide-react";
import { motion } from "framer-motion";
import { useWorkspace } from "../Workspace";
import { useGraph, useOverview } from "./Dashboard";
import { useLive } from "../live";
import { KIND_COLORS } from "../types";
import { ErrorBox, number, Spinner } from "../components/UI";
import { EventFeed, Pipeline } from "./Operations";
export default function CommandCenter() {
  const { space, user } = useWorkspace(),
    graph = useGraph(),
    stats = useOverview(),
    live = useLive(),
    navigate = useNavigate();
  const nodes = useMemo(
    () =>
      [...(graph.data?.nodes || [])]
        .sort((a, b) => b.centrality - a.centrality)
        .slice(0, 70),
    [graph.data],
  );
  const positions = useMemo(
    () =>
      new Map(
        nodes.map((n, i) => {
          const angle = i * 2.399963;
          const r =
            i === 0 ? 0 : 30 + Math.sqrt(i / Math.max(nodes.length, 1)) * 152;
          return [
            n.id,
            [350 + Math.cos(angle) * r * 1.35, 205 + Math.sin(angle) * r] as [
              number,
              number,
            ],
          ];
        }),
      ),
    [nodes],
  );
  return (
    <>
      <div className="command-heading">
        <div>
          <span className="eyebrow">
            <Crosshair size={13} /> COMMAND / {space.name.toUpperCase()}
          </span>
          <h1>
            Knowledge is
            <br />
            <em>your advantage.</em>
          </h1>
          <p>
            Operator {user.name.split(" ")[0]}, your mission space is ready.
          </p>
        </div>
        <div className="command-action">
          <span className="module-tag">KNOWSPHERE // INTELLIGENCE SYSTEM</span>
          <Link className="button button-primary" to="/app/library?add=1">
            <Plus size={17} /> Launch ingestion <ArrowUpRight size={17} />
          </Link>
          <span className="command-note">
            YOUR SOURCES. VERIFIED CONNECTIONS.
          </span>
        </div>
      </div>
      {stats.error && (
        <ErrorBox error={stats.error} retry={() => void stats.refetch()} />
      )}
      <div className="stats-grid cockpit-stats">
        {[
          {
            label: "INDEXED SOURCES",
            value: stats.data?.ready_documents,
            icon: FileText,
            note: stats.data
              ? `${stats.data.documents} sources in hangar`
              : "Reading inventory",
          },
          {
            label: "GRAPH ENTITIES",
            value: stats.data?.entities,
            icon: Crosshair,
            note: "From validated source quotes",
          },
          {
            label: "RELATIONSHIPS",
            value: stats.data?.relationships,
            icon: GitBranch,
            note: "Traceable to original passages",
          },
          {
            label: "ACTIVE JOBS",
            value: stats.data?.active_jobs,
            icon: Activity,
            note: stats.data?.failed_jobs
              ? `${stats.data.failed_jobs} need attention`
              : "Durable worker pipeline",
          },
        ].map((s, i) => (
          <motion.div
            className="stat-card"
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div>
              <span>{s.label}</span>
              <s.icon size={16} />
            </div>
            <strong key={s.value}>{number(s.value)}</strong>
            <small>{s.note}</small>
            <span className="stat-serial">0{i + 1} / TELEMETRY</span>
          </motion.div>
        ))}
      </div>
      <div className="command-grid">
        <section className="panel tactical-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">TACTICAL OVERVIEW</span>
              <h2>Intelligence radar</h2>
            </div>
            <span
              className={`radar-state ${live.connected ? "signal-good" : "signal-warn"}`}
            >
              <Radio size={13} />
              {live.connected ? "LIVE SYNC" : "RECONNECTING"}
            </span>
          </div>
          {graph.isPending ? (
            <Spinner label="Acquiring graph data" />
          ) : graph.error ? (
            <ErrorBox error={graph.error} />
          ) : (
            <div className="radar-map">
              <svg
                viewBox="0 0 700 410"
                aria-label={`Live overview of ${nodes.length} entities`}
              >
                <defs>
                  <radialGradient id="radarGlow">
                    <stop stopColor="#0e6474" stopOpacity=".2" />
                    <stop offset="1" stopColor="#071221" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <rect width="700" height="410" fill="url(#radarGlow)" />
                <g className="radar-reticle" fill="none" stroke="#1a394d">
                  {[50, 100, 150, 190].map((r) => (
                    <circle key={r} cx="350" cy="205" r={r} />
                  ))}
                  <path
                    d="M0 205h700M350 0v410M160 15l380 380M160 395L540 15"
                    strokeDasharray="3 8"
                  />
                </g>
                <g className="radar-sweep">
                  <path
                    d="M350 205L350 15A190 190 0 0 1 484 71Z"
                    fill="#37e8f20b"
                  />
                  <path d="M350 205L350 15" stroke="#38e8f2" opacity=".35" />
                </g>
                {graph.data?.links
                  .filter(
                    (l) => positions.has(l.source) && positions.has(l.target),
                  )
                  .slice(0, 180)
                  .map((l) => (
                    <line
                      key={l.id}
                      x1={positions.get(l.source)![0]}
                      y1={positions.get(l.source)![1]}
                      x2={positions.get(l.target)![0]}
                      y2={positions.get(l.target)![1]}
                      stroke="#36a7c3"
                      strokeOpacity=".25"
                    />
                  ))}
                {nodes.map((n, i) => {
                  const [x, y] = positions.get(n.id)!;
                  return (
                    <g
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Inspect ${n.name}`}
                      onClick={() => navigate(`/app/graph?entity=${n.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/app/graph?entity=${n.id}`);
                        }
                      }}
                      className="radar-node"
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={i === 0 ? 11 : 4 + Math.min(n.degree, 8) * 0.4}
                        fill={KIND_COLORS[n.kind]}
                      />
                      <circle
                        cx={x}
                        cy={y}
                        r={i === 0 ? 19 : 10}
                        fill="none"
                        stroke={KIND_COLORS[n.kind]}
                        opacity=".2"
                      />
                      {i < 9 && (
                        <text x={x + 13} y={y + 4} fill="#bfdce9" fontSize="10">
                          {n.name.length > 23
                            ? n.name.slice(0, 22) + "…"
                            : n.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
              {!nodes.length && (
                <div className="radar-empty">
                  <Crosshair size={38} />
                  <strong>AWAITING YOUR FIRST SOURCE</strong>
                  <p>No indexed signals in this mission space.</p>
                  <Link className="text-link" to="/app/library?add=1">
                    Upload a source <ArrowUpRight size={14} />
                  </Link>
                </div>
              )}
              <div className="radar-corner">
                <span>SECTOR / {space.id.slice(0, 8).toUpperCase()}</span>
                <span>
                  {nodes.length}/{number(graph.data?.total_entities)} ENTITIES
                  ON RADAR
                </span>
              </div>
            </div>
          )}
          <div className="radar-footer">
            <span>
              <Network size={14} />
              {number(graph.data?.communities)} communities ·{" "}
              {number(graph.data?.components)} components
            </span>
            <Link to="/app/graph">
              Enter tactical graph <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
        <aside className="command-rail">
          <section className="comms-card">
            <span className="eyebrow">INTELLIGENCE COMMS / AI</span>
            <div className="comms-symbol">
              <GitBranch size={34} />
            </div>
            <h2>
              Interrogate
              <br />
              your knowledge.
            </h2>
            <p>
              Ask across your indexed sources. Watch retrieval and generation.
              Inspect every citation.
            </p>
            <Link className="button button-primary" to="/app/chat">
              Open comms <ArrowUpRight size={16} />
            </Link>
          </section>
          <div className="quick-modules">
            <Link to="/app/operations">
              <Activity size={18} />
              <span>
                LIVE OPERATIONS<small>Checkpoint and event monitor</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
            <Link to="/app/insights">
              <Crosshair size={18} />
              <span>
                GRAPH ANALYSIS<small>Rankings, clusters, communities</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </aside>
      </div>
      <div className="command-lower">
        <Pipeline compact />
        <EventFeed compact />
      </div>
    </>
  );
}
