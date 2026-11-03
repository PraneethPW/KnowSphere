import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { ActivityEvent } from "./types";

type LiveState = {
  connected: boolean;
  lastHeartbeat: number | null;
  lastChange: number | null;
  events: ActivityEvent[];
  received: number;
  historyError: unknown;
  reconnect: () => void;
};
const LiveContext = createContext<LiveState | null>(null);
export const useLive = () => useContext(LiveContext)!;
export function LiveProvider({
  spaceId,
  children,
}: {
  spaceId: string;
  children: ReactNode;
}) {
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [lastHeartbeat, setHeartbeat] = useState<number | null>(null);
  const [lastChange, setChange] = useState<number | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [received, setReceived] = useState(0);
  const [historyError, setHistoryError] = useState<unknown>(null);
  const [generation, reconnect] = useState(0);
  const cursor = useRef(0);
  const heartbeat = useRef(0);
  useEffect(() => {
    let active = true;
    setConnected(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let graphDirty = false;
    const refresh = (graph = false) => {
      graphDirty ||= graph;
      if (timer) return;
      timer = setTimeout(() => {
        for (const key of [
          "overview",
          "documents",
          "operations",
          "conversations",
          "activity",
          "thread",
          "document",
        ])
          void client.invalidateQueries({ queryKey: [key, spaceId] });
        if (graphDirty)
          for (const key of ["graph", "entity"])
            void client.invalidateQueries({ queryKey: [key, spaceId] });
        graphDirty = false;
        timer = undefined;
      }, 180);
    };
    // Start history reads after the stream cursor is established. Merge events that
    // arrive while history is in flight, including events around reconnect boundaries.
    const loadHistory = () => {
      setHistoryError(null);
      void api<ActivityEvent[]>(`/spaces/${spaceId}/activity?limit=100`)
        .then((rows) => {
          if (!active) return;
          setEvents((previous) =>
            [...new Map([...rows, ...previous].map((e) => [e.id, e])).values()]
              .sort((a, b) => b.id - a.id)
              .slice(0, 100),
          );
        })
        .catch((error) => {
          if (active) setHistoryError(error);
        });
    };
    const stream = new EventSource(
      `/api/spaces/${spaceId}/events${cursor.current ? `?after=${cursor.current}` : ""}`,
    );
    stream.addEventListener("ready", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      cursor.current = Math.max(cursor.current, Number(data.cursor) || 0);
      setConnected(true);
      heartbeat.current = Date.now();
      setHeartbeat(heartbeat.current);
      refresh(true);
      loadHistory();
    });
    stream.addEventListener("heartbeat", () => {
      setConnected(true);
      heartbeat.current = Date.now();
      setHeartbeat(heartbeat.current);
    });
    stream.addEventListener("change", (e) => {
      const message = e as MessageEvent;
      const row = JSON.parse(message.data) as ActivityEvent;
      row.id = Number(message.lastEventId);
      cursor.current = Math.max(cursor.current, row.id);
      setEvents((previous) =>
        previous.some((x) => x.id === row.id)
          ? previous
          : [row, ...previous].slice(0, 100),
      );
      setReceived((n) => n + 1);
      setChange(Date.now());
      heartbeat.current = Date.now();
      setHeartbeat(heartbeat.current);
      refresh(row.kind === "graph.updated");
    });
    stream.addEventListener("expired", () =>
      window.dispatchEvent(new Event("knowsphere:expired")),
    );
    stream.onerror = () => setConnected(false);
    const recovery = setInterval(() => refresh(true), 60_000);
    const watchdog = setInterval(() => {
      if (heartbeat.current && Date.now() - heartbeat.current > 15_000)
        setConnected(false);
    }, 5000);
    return () => {
      active = false;
      stream.close();
      clearInterval(recovery);
      clearInterval(watchdog);
      clearTimeout(timer);
    };
  }, [spaceId, client, generation]);
  return (
    <LiveContext.Provider
      value={{
        connected,
        lastHeartbeat,
        lastChange,
        events,
        received,
        historyError,
        reconnect: () => reconnect((n) => n + 1),
      }}
    >
      {children}
    </LiveContext.Provider>
  );
}
export function eventLabel(e: ActivityEvent) {
  if (e.payload.deleted_document_id) return "Source removed · graph reconciled";
  if (e.kind === "graph.updated") return "Graph published";
  if (e.kind === "document.created") return "Source queued";
  if (e.kind === "conversation.updated") return "Cited answer saved";
  if (e.payload.stage === "extracting")
    return `AI extracting · passage ${e.payload.chunk}`;
  if (e.payload.stage === "checkpoint")
    return `Evidence checkpoint · ${e.payload.chunks_done}/${e.payload.chunks_total} passages`;
  if (e.payload.stage === "chunking")
    return "Worker claimed · passages prepared";
  if (e.payload.retrying) return "Provider retry scheduled";
  return `Ingestion ${e.payload.status || "updated"}`;
}
