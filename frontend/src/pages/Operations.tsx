import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronDown,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Terminal,
  UploadCloud,
} from "lucide-react";
import { api } from "../api";
import type { ActivityEvent, Operation } from "../types";
import { useWorkspace } from "../Workspace";
import { eventLabel, useLive } from "../live";
import { ErrorBox, number, SectionHeading, Spinner } from "../components/UI";
import { useClock } from "../components/Telemetry";
export function useOperations() {
  const { space } = useWorkspace();
  return useQuery({
    queryKey: ["operations", space.id],
    queryFn: () => api<Operation[]>(`/spaces/${space.id}/operations`),
  });
}
export function EventFeed({ compact = false }: { compact?: boolean }) {
  const { space } = useWorkspace(),
    live = useLive(),
    navigate = useNavigate();
  const [paused, setPaused] = useState<ActivityEvent[] | null>(null),
    [filter, setFilter] = useState("all"),
    [older, setOlder] = useState<ActivityEvent[]>([]),
    [loading, setLoading] = useState(false),
    [end, setEnd] = useState(false),
    [error, setError] = useState<unknown>(null);
  const all = [
    ...new Map([...live.events, ...older].map((e) => [e.id, e])).values(),
  ].sort((a, b) => b.id - a.id);
  const rows = (paused || all)
    .filter(
      (e) =>
        filter === "all" ||
        (filter === "graph"
          ? e.kind === "graph.updated"
          : filter === "answers"
            ? e.kind === "conversation.updated"
            : e.kind.startsWith("document.")),
    )
    .slice(0, compact ? 5 : undefined);
  async function more() {
    setLoading(true);
    setError(null);
    try {
      const before = all.at(-1)?.id;
      const data = await api<ActivityEvent[]>(
        `/spaces/${space.id}/activity?limit=100${before ? `&before=${before}` : ""}`,
      );
      setOlder((p) => [...p, ...data]);
      setEnd(data.length < 100);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }
  function inspect(e: ActivityEvent) {
    if (e.payload.document_id)
      navigate(`/app/library?document=${e.payload.document_id}`);
    else if (e.payload.conversation_id)
      navigate(`/app/chat?conversation=${e.payload.conversation_id}`);
    else navigate("/app/graph");
  }
  return (
    <section className={`panel event-console ${compact ? "compact" : ""}`}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">DURABLE EVENT LOG</span>
          <h2>
            <Terminal size={18} /> Mission activity
          </h2>
        </div>
        {compact ? (
          <Link className="text-link" to="/app/operations">
            Open log <ArrowUpRight size={14} />
          </Link>
        ) : (
          <button
            className={`tool-button ${paused ? "active" : ""}`}
            onClick={() => setPaused(paused ? null : all)}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}{" "}
            {paused ? "Resume feed" : "Pause feed"}
          </button>
        )}
      </div>
      {!compact && (
        <div className="event-filters">
          {[
            ["all", "All events"],
            ["ingestion", "Ingestion"],
            ["graph", "Graph"],
            ["answers", "Answers"],
          ].map(([key, label]) => (
            <button
              className={filter === key ? "active" : ""}
              key={key}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
          <span>
            {paused
              ? "DISPLAY PAUSED · CAPTURE CONTINUES"
              : live.connected
                ? "STREAM CONNECTED"
                : "RECONNECTING"}
          </span>
        </div>
      )}
      {!!error && <ErrorBox error={error} />}
      {!!live.historyError && (
        <ErrorBox error={live.historyError} retry={live.reconnect} />
      )}
      <div className="mission-events">
        {rows.length ? (
          rows.map((e) => (
            <button
              className={`mission-event ${e.kind === "graph.updated" ? "event-publish" : ""}`}
              key={e.id}
              onClick={() => inspect(e)}
            >
              <time>
                {new Date(e.created_at).toLocaleTimeString([], {
                  hour12: false,
                })}
              </time>
              <i />
              <div>
                <strong>{eventLabel(e)}</strong>
                <span>
                  {e.payload.title ||
                    (e.payload.progress !== undefined
                      ? `${e.payload.progress}% committed`
                      : e.kind)}
                </span>
              </div>
              <span className="event-id">#{e.id}</span>
              <ArrowUpRight size={13} />
            </button>
          ))
        ) : (
          <div className="compact-empty">
            <Radio size={26} />
            <p>
              No matching events. Add a source to start a live ingestion run.
            </p>
          </div>
        )}
      </div>
      {!compact && !end && (
        <button
          className="load-log"
          disabled={loading || !!paused}
          onClick={() => void more()}
        >
          {loading ? "Loading history…" : "Load earlier events"}
          <ChevronDown size={14} />
        </button>
      )}
      {!compact && (
        <p className="small-print">
          Events are retained for seven days. Pausing freezes this display;
          processing continues.
        </p>
      )}
    </section>
  );
}
export function Pipeline({ compact = false }: { compact?: boolean }) {
  const query = useOperations(),
    now = useClock();
  const rows = (query.data || [])
    .filter(
      (d) => !compact || ["processing", "queued", "failed"].includes(d.status),
    )
    .slice(0, compact ? 3 : 200);
  return (
    <section className="panel pipeline-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">INGESTION TELEMETRY</span>
          <h2>
            <Activity size={18} />{" "}
            {compact ? "Active pipeline" : "Processing pipeline"}
          </h2>
        </div>
        <span className="tiny-tag">CHECKPOINTED</span>
      </div>
      {query.isPending ? (
        <Spinner label="Reading worker checkpoints" />
      ) : query.error ? (
        <ErrorBox error={query.error} retry={() => void query.refetch()} />
      ) : rows.length ? (
        <div className="pipeline-list">
          {rows.map((d) => {
            const stages = [
              true,
              d.chunks_total > 0 && d.chunks_done > 0,
              d.chunks_total > 0 && d.chunks_done === d.chunks_total,
              d.status === "ready",
            ];
            return (
              <article className={`pipeline-job job-${d.status}`} key={d.id}>
                <div className="pipeline-title">
                  <Link to={`/app/library?document=${d.id}`}>
                    {d.title}
                    <ArrowUpRight size={13} />
                  </Link>
                  <span className={`status-badge status-${d.status}`}>
                    {d.status === "processing" && <Activity size={11} />}{" "}
                    {d.status.toUpperCase()}
                  </span>
                </div>
                <div className="pipeline-stages">
                  {["QUEUED", "EXTRACT", "EVIDENCE", "PUBLISH"].map(
                    (label, i) => (
                      <span key={label} className={stages[i] ? "done" : ""}>
                        <i>{stages[i] ? <Check size={9} /> : i + 1}</i>
                        {label}
                      </span>
                    ),
                  )}
                </div>
                <div
                  className="pipeline-track"
                  role="progressbar"
                  aria-label={`Ingestion of ${d.title}`}
                  aria-valuenow={d.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${d.progress}%` }} />
                </div>
                <div className="pipeline-metrics">
                  <span>
                    <b>
                      {d.chunks_done}/{d.chunks_total}
                    </b>{" "}
                    passages checked
                  </span>
                  <span>
                    <b>{number(d.verified_mentions)}</b> evidenced mentions
                  </span>
                  <span>
                    <b>{number(d.verified_relationships)}</b> relations
                  </span>
                  <span>{d.progress}%</span>
                </div>
                {d.error && <p className="document-error">{d.error}</p>}
                {d.status === "queued" && d.attempts > 0 && (
                  <p className="retry-note">
                    Provider retry in{" "}
                    {Math.max(
                      0,
                      Math.ceil(
                        (new Date(d.available_at).getTime() - now) / 1000,
                      ),
                    )}
                    s · attempt {d.attempts}/3
                  </p>
                )}
                {d.status === "processing" && (
                  <p className="small-print">
                    Worker processing · last checkpoint{" "}
                    {Math.max(
                      0,
                      Math.floor(
                        (now - new Date(d.updated_at).getTime()) / 1000,
                      ),
                    )}
                    s ago. Graph publishes after all evidence checks finish.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="compact-empty">
          <Check size={24} />
          <p>
            {compact
              ? "Pipeline idle. New sources will appear here automatically."
              : "No source jobs yet. Upload a document to launch ingestion."}
          </p>
        </div>
      )}
    </section>
  );
}
export default function Operations() {
  const live = useLive(),
    query = useOperations();
  const active = query.data?.filter((d) =>
    ["processing", "queued"].includes(d.status),
  ).length;
  return (
    <>
      <SectionHeading
        eyebrow="OPS / LIVE CONTROL"
        title="Mission operations"
        description="Watch real worker checkpoints, graph publications, and saved answers as they happen."
        action={
          <Link className="button button-primary" to="/app/library?add=1">
            <UploadCloud size={16} /> Launch ingestion
          </Link>
        }
      />
      <div className="ops-status">
        <div>
          <Radio size={20} />
          <span className={live.connected ? "signal-good" : "signal-warn"}>
            {live.connected ? "LIVE EVENT UPLINK" : "RECONNECTING TO UPLINK"}
          </span>
          <small>
            {number(active)} queued / processing · {live.received} events
            received this session
          </small>
        </div>
        <button className="tool-button" onClick={live.reconnect}>
          <RefreshCw size={14} /> Reconnect
        </button>
      </div>
      <Pipeline />
      <EventFeed />
    </>
  );
}
