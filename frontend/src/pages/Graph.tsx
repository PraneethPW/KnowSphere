import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  Crosshair,
  Route as RouteIcon,
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
import { shortestPath } from "../graph-tools";
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
            <Link
              className="button button-primary inspector-ask"
              to={`/app/chat?question=${encodeURIComponent(`What do my sources say about ${query.data.name}?`)}`}
            >
              Research this entity <ArrowUpRight size={14} />
            </Link>
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
  const [community, setCommunity] = useState("all"),
    [isolate, setIsolate] = useState(false);
  const [tracing, setTracing] = useState(false),
    [pathFrom, setPathFrom] = useState(""),
    [pathTo, setPathTo] = useState("");
  const selected = params.get("entity") || "";
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!graph.data) return;
    const next = new Set(graph.data.nodes.map((n) => n.id));
    if (known.current)
      setFresh(new Set([...next].filter((id) => !known.current!.has(id))));
    known.current = next;
    const timer = setTimeout(() => setFresh(new Set()), 12_000);
    return () => clearTimeout(timer);
  }, [graph.data]);
  const neighbors = useMemo(
    () =>
      new Set([
        selected,
        ...(graph.data?.links || [])
          .filter(
            (l) =>
              l.confidence >= confidence &&
              (l.source === selected || l.target === selected),
          )
          .flatMap((l) => [l.source, l.target]),
      ]),
    [selected, graph.data, confidence],
  );
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
          (community === "all" || n.community === Number(community)) &&
          (!isolate || !selected || neighbors.has(n.id)) &&
          n.name.toLowerCase().includes(search.toLowerCase()),
      ) || [],
    [graph.data, kind, search, community, isolate, selected, neighbors],
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
  const path = useMemo(
    () => shortestPath(links, pathFrom, pathTo),
    [links, pathFrom, pathTo],
  );
  const pathEdges = path
    .slice(1)
    .map((id, i) =>
      links.find(
        (l) =>
          (l.source === path[i] && l.target === id) ||
          (l.target === path[i] && l.source === id),
      )!,
    );
  const name = (id: string) =>
    graph.data?.nodes.find((n) => n.id === id)?.name || id;
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
          className={`entity-list-card ${selected === n.id ? "active" : ""} ${fresh.has(n.id) ? "fresh-node" : ""}`}
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
        eyebrow="TACTICAL / CONNECTION INTELLIGENCE"
        title="Tactical graph"
        description="Investigate neighborhoods, trace connection paths, and inspect the source behind every relationship."
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
              className={`tool-button ${tracing ? "active" : ""}`}
              onClick={() => setTracing(!tracing)}
              aria-expanded={tracing}
            >
              <RouteIcon size={15} />
              <span>Trace path</span>
            </button>
            <button
              className={`tool-button ${isolate ? "active" : ""}`}
              disabled={!selected}
              onClick={() => setIsolate(!isolate)}
              aria-pressed={isolate}
            >
              <Crosshair size={15} />
              <span>Isolate</span>
            </button>
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
        {fresh.size > 0 && (
          <div className="graph-live-update" role="status">
            <span className="live-dot" />
            {fresh.size} new entities published from your sources
          </div>
        )}
        {tracing && (
          <div className="path-console">
            <div className="path-selectors">
              <label>
                FROM
                <select
                  value={pathFrom}
                  onChange={(e) => setPathFrom(e.target.value)}
                >
                  <option value="">Select entity</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </label>
              <RouteIcon size={20} />
              <label>
                TO
                <select
                  value={pathTo}
                  onChange={(e) => setPathTo(e.target.value)}
                >
                  <option value="">Select entity</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </label>
              <span className="tiny-tag">UNDIRECTED / VISIBLE GRAPH</span>
            </div>
            {pathFrom && pathTo && (
              <div className="path-result">
                {path.length ? (
                  <>
                    <div className="path-chain">
                      {path.map((id, i) => (
                        <span key={id}>
                          {i > 0 && <ArrowUpRight size={13} />}
                          <button onClick={() => setSelected(id)}>
                            {name(id)}
                          </button>
                        </span>
                      ))}
                    </div>
                    {pathEdges.length > 0 && (
                      <div className="path-evidence">
                        {pathEdges.map((l) => (
                          <div key={l.id}>
                            <strong>
                              {name(l.source)} → {l.label} → {name(l.target)}
                            </strong>
                            <p>“{l.evidence}”</p>
                            <Link to={`/app/library?document=${l.document_id}`}>
                              {l.title} <ArrowUpRight size={12} />
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                    <small>
                      {path.length - 1} hops. Connection paths show extracted
                      relationships; they do not establish causation.
                    </small>
                  </>
                ) : (
                  <p>
                    No path in the current filters. Broaden the filters or
                    choose another pair.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
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
              Community
              <select
                value={community}
                onChange={(e) => setCommunity(e.target.value)}
              >
                <option value="all">All communities</option>
                {[...new Set(graph.data?.nodes.map((n) => n.community))]
                  .sort((a, b) => a - b)
                  .map((c) => (
                    <option key={c} value={c}>
                      Community {c + 1}
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
                setCommunity("all");
                setIsolate(false);
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
                        fresh={fresh}
                        path={tracing ? path : []}
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
