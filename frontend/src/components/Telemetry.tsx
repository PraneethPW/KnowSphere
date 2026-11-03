import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Radio, Timer, Zap } from "lucide-react";
import { useLive } from "../live";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { SystemInfo } from "../types";

export function useClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function Connection() {
  const { connected } = useLive();
  return (
    <Link
      to="/app/operations"
      className={`connection ${connected ? "is-live" : ""}`}
    >
      <i />
      {connected ? "UPLINK LIVE" : "RECONNECTING"}
    </Link>
  );
}
export function Telemetry() {
  const { connected, lastHeartbeat, lastChange, received } = useLive();
  const now = useClock();
  const system = useQuery({
    queryKey: ["system"],
    queryFn: () => api<SystemInfo>("/system"),
    refetchInterval: 15_000,
  });
  return (
    <div className="telemetry-strip">
      <Link to="/app/operations">
        <Radio size={13} />
        <span>EVENT BUS</span>
        <strong className={connected ? "signal-good" : "signal-warn"}>
          {connected ? "CONNECTED" : "RECONNECTING"}
        </strong>
      </Link>
      <Link to="/app/settings">
        <Zap size={13} />
        <span>WORKER</span>
        <strong
          className={
            system.data?.worker === "online" ? "signal-good" : "signal-warn"
          }
        >
          {system.data?.worker?.toUpperCase() || "CHECKING"}
        </strong>
      </Link>
      <span>
        <Activity size={13} />
        <span>RECEIVED</span>
        <strong>{received} EVENTS</strong>
      </span>
      <span
        title={
          lastChange
            ? new Date(lastChange).toLocaleString()
            : "No changes received in this session"
        }
      >
        <Timer size={13} />
        <span>HEARTBEAT</span>
        <strong>
          {lastHeartbeat
            ? `${Math.max(0, Math.floor((now - lastHeartbeat) / 1000))}s AGO`
            : "AWAITING"}
        </strong>
      </span>
      <time>
        {new Date(now).toLocaleTimeString([], { hour12: false })}
        <small> LOCAL</small>
      </time>
    </div>
  );
}
