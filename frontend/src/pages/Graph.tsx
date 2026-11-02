import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  Eye,
  Filter,
  GitBranch,
  List,
  Maximize,
  Minimize,
  Network,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { api, downloadGraph } from "../api";
import type { EntityDetail } from "../types";
import { KIND_COLORS } from "../types";
import {
  Empty,
  ErrorBox,
  number,
  SectionHeading,
  SourceButton,
  Spinner,
  useToast,
} from "../components/UI";
import { VisualBoundary } from "../Landing";
import { useWorkspace } from "../Workspace";
import { useGraph } from "./Dashboard";

const GraphScene = lazy(() => import("../components/GraphScene"));
function EntityInspector({ id, onClose }: { id: string; onClose: () => void }) {
  const { space, openDocument } = useWorkspace();
  const query = useQuery({
    queryKey: ["entity", space.id, id],
    queryFn: () => api<EntityDetail>(`/spaces/${space.id}/entities/${id}`),
  });
  return (
    <aside className="entity-inspector">
      <div className="inspector-heading">
        <span className="eyebrow">FOLLOW THE EVIDENCE</span>
        <button
          className="icon-button"
          aria-label="Close entity details"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>
      {query.isPending ? (
        <Spinner label="Tracing sources" />
      ) : query.error ? (
        <ErrorBox error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <>
            <span
              className="entity-kind"
              style={{ color: KIND_COLORS[query.data.kind] }}
            >
              <i style={{ background: KIND_COLORS[query.data.kind] }} />
              {query.data.kind}
            </span>
            <h2>{query.data.name}</h2>
            <p className="entity-description">
              {query.data.sources[0]?.description}
            </p>
            <div className="inspector-section">
              <h3>
                Source evidence <span>{query.data.sources.length}</span>
              </h3>
              {query.data.sources.slice(0, 12).map((s) => (
                <div className="evidence-card" key={s.chunk_id}>
                  <blockquote>“{s.evidence}”</blockquote>
                  <SourceButton
                    title={s.title}
                    onClick={() => openDocument(s.document_id)}
                  />
                </div>
              ))}
            </div>
            <div className="inspector-section">
              <h3>
                Connections <span>{query.data.relationships.length}</span>
              </h3>
              {query.data.relationships.length ? (
                query.data.relationships.slice(0, 20).map((r, i) => (
                  <div className="relationship-card" key={i}>
                    <div>
                      <strong>{r.source}</strong>
                      <span>{r.label}</span>
                      <strong>{r.target}</strong>
                    </div>
                    <p>“{r.evidence}”</p>
                    <small>
                      AI extraction confidence:{" "}
                      {(r.confidence * 100).toFixed(0)}% · not independently
                      verified
                    </small>
                    <SourceButton
                      title={r.title}
                      onClick={() => openDocument(r.document_id)}
                    />
                  </div>
                ))
              ) : (
                <p className="muted">
                  No relationships were supported by the source excerpts.
                </p>
              )}
            </div>
          </>
        )
      )}
    </aside>
  );
}
export default function GraphPage() {
  const graph = useGraph(),
    { space } = useWorkspace(),
    toast = useToast(),
    container = useRef<HTMLDivElement>(null);
  const [params, setParams] = useSearchParams(),
    [search, setSearch] = useState(""),
    [kind, setKind] = useState("all");
  const [confidence, setConfidence] = useState(0),
    [filters, setFilters] = useState(false),
    [labels, setLabels] = useState(true),
    [view, setView] = useState<"3d" | "list">("3d"),
    [reset, setReset] = useState(0),
    [fullscreen, setFullscreen] = useState(false);
  const selected = params.get("entity") || "";
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const setSelected = (id: string) => setParams(id ? { entity: id } : {});
  const nodes = useMemo(
    () =>
      graph.data?.nodes.filter(
        (n) =>
          (kind === "all" || n.kind === kind) &&
          n.name.toLowerCase().includes(search.toLowerCase()),
      ) || [],
    [graph.data, kind, search],
  );
  const links = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    return (
      graph.data?.links.filter(
        (l) =>
          ids.has(l.source) && ids.has(l.target) && l.confidence >= confidence,
      ) || []
    );
  }, [graph.data, nodes, confidence]);
  async function exportGraph() {
    try {
      await downloadGraph(space.id);
      toast("Complete knowledge graph exported.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed.");
    }
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreen(false);
      } else {
        await container.current?.requestFullscreen();
        setFullscreen(true);
      }
    } catch {
      toast("Fullscreen is unavailable in this browser.");
    }
  }
  const list = (
    <div className="entity-grid">
      {nodes.map((n) => (
        <button
          key={n.id}
          className={`entity-list-card ${selected === n.id ? "active" : ""}`}
          onClick={() => setSelected(n.id)}
        >
          <span>
            <i style={{ background: KIND_COLORS[n.kind] }} />
            {n.kind}
          </span>
          <h3>{n.name}</h3>
          <div>
            {n.degree} connections <ArrowUpRight size={15} />
          </div>
        </button>
      ))}
    </div>
  );
  return (
    <>
      <SectionHeading
        eyebrow="A UNIVERSE OF CONNECTED IDEAS"
        title="Follow your curiosity."
        description="Move through your knowledge. Select an entity to trace the evidence behind it."
        action={
          <button
            className="button button-secondary"
            onClick={() => void exportGraph()}
          >
            <ArrowDownToLine size={16} /> Export graph
          </button>
        }
      />
      <section className="graph-shell" ref={container}>
        <div className="graph-toolbar">
          <div className="input-icon graph-search">
            <Search size={16} />
            <input
              placeholder="Find an entity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search entities"
              autoFocus={params.has("search")}
            />
            {search && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="graph-tool-actions">
            <button
              className={`tool-button ${filters ? "active" : ""}`}
              onClick={() => setFilters(!filters)}
              aria-expanded={filters}
            >
              <Filter size={15} />
              <span>Filters</span>
            </button>
            <div className="view-toggle">
              <button
                className={view === "3d" ? "active" : ""}
                onClick={() => setView("3d")}
                aria-label="View 3D graph"
              >
                <Box size={16} />
                <span>3D</span>
              </button>
              <button
                className={view === "list" ? "active" : ""}
                onClick={() => setView("list")}
                aria-label="View entity list"
              >
                <List size={16} />
                <span>List</span>
              </button>
            </div>
          </div>
        </div>
        {filters && (
          <div className="graph-filters">
            <label>
              Entity type
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="all">All types</option>
                {Object.keys(KIND_COLORS).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Minimum extraction confidence{" "}
              <strong>{Math.round(confidence * 100)}%</strong>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
              />
            </label>
            <button
              className="text-link"
              onClick={() => {
                setKind("all");
                setConfidence(0);
                setSearch("");
              }}
            >
              Reset filters <RotateCcw size={13} />
            </button>
          </div>
        )}
        <div className="graph-content">
          {graph.isPending ? (
            <Spinner label="Loading your knowledge graph" />
          ) : graph.error ? (
            <ErrorBox error={graph.error} retry={() => void graph.refetch()} />
          ) : !graph.data?.nodes.length ? (
            <Empty
              icon={<Network size={44} />}
              title="The first dot is yours to place."
              description="Index a source to create real entities and relationships. Your knowledge graph grows from the documents you bring."
              action={
                <Link className="button button-primary" to="/app/library">
                  Add your first source <ArrowUpRight size={16} />
                </Link>
              }
            />
          ) : !nodes.length ? (
            <Empty
              icon={<Search size={32} />}
              title="No entities match your filters."
              description="Try a broader search or select another entity type."
            />
          ) : (
            <>
              <div
                className={`graph-viewport ${selected ? "has-selection" : ""}`}
              >
                {view === "3d" ? (
                  <VisualBoundary
                    fallback={
                      <div className="webgl-fallback">
                        <p>
                          3D rendering isn’t available on this device. Explore
                          the entities below.
                        </p>
                        {list}
                      </div>
                    }
                  >
                    <Suspense
                      fallback={<Spinner label="Preparing 3D exploration" />}
                    >
                      <GraphScene
                        nodes={nodes}
                        links={links}
                        selected={selected}
                        onSelect={setSelected}
                        labels={labels}
                        reset={reset}
                      />
                    </Suspense>
                  </VisualBoundary>
                ) : (
                  list
                )}
                {view === "3d" && (
                  <>
                    <div className="graph-corner-title">
                      <span className="eyebrow">
                        {space.name.toUpperCase()}
                      </span>
                      <span>
                        <i /> {number(nodes.length)} entities ·{" "}
                        {number(links.length)} relationships
                      </span>
                    </div>
                    <div className="graph-view-controls">
                      <button
                        className={`icon-button ${labels ? "active" : ""}`}
                        title="Toggle labels"
                        aria-label="Toggle entity labels"
                        onClick={() => setLabels(!labels)}
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        className="icon-button"
                        title="Reset view"
                        aria-label="Reset graph camera"
                        onClick={() => setReset(reset + 1)}
                      >
                        <RotateCcw size={17} />
                      </button>
                      <button
                        className="icon-button"
                        title="Fullscreen"
                        aria-label="Toggle graph fullscreen"
                        onClick={() => void toggleFullscreen()}
                      >
                        {fullscreen ? (
                          <Minimize size={17} />
                        ) : (
                          <Maximize size={17} />
                        )}
                      </button>
                    </div>
                    <div className="graph-help">
                      Drag to orbit <span>·</span> Scroll to zoom <span>·</span>{" "}
                      Select to discover
                    </div>
                  </>
                )}
              </div>
              {selected && (
                <EntityInspector
                  id={selected}
                  onClose={() => setSelected("")}
                />
              )}
            </>
          )}
        </div>
        <div className="graph-legend">
          <div>
            {Object.entries(KIND_COLORS).map(([k, c]) => (
              <span key={k}>
                <i style={{ background: c }} />
                {k}
              </span>
            ))}
          </div>
          <span>
            <GitBranch size={13} />{" "}
            {graph.data?.truncated
              ? "Showing a subset · Export for the full graph"
              : "Source-backed relationships"}
          </span>
        </div>
      </section>
    </>
  );
}
