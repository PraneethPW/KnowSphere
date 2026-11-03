import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, FileText, Search } from "lucide-react";
import { api } from "../api";
import type { GraphData, SearchPassage } from "../types";
import { useWorkspace } from "../Workspace";
import { Empty, ErrorBox, Modal, Spinner } from "./UI";
export default function SearchConsole({ onClose }: { onClose: () => void }) {
  const { space } = useWorkspace(),
    navigate = useNavigate();
  const [input, setInput] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(timer);
  }, [input]);
  const passages = useQuery({
    queryKey: ["search", space.id, query],
    queryFn: () =>
      api<SearchPassage[]>(
        `/spaces/${space.id}/search?q=${encodeURIComponent(query)}`,
      ),
    enabled: query.length >= 2,
  });
  const graph = useQuery({
    queryKey: ["graph", space.id],
    queryFn: () => api<GraphData>(`/spaces/${space.id}/graph`),
  });
  const entities =
    query.length >= 2
      ? graph.data?.nodes
          .filter((n) => n.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 6) || []
      : [];
  function go(path: string) {
    onClose();
    navigate(path);
  }
  return (
    <Modal title="Search console" onClose={onClose} wide>
      <div className="console-input">
        <Search size={20} />
        <input
          maxLength={500}
          data-autofocus
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search entities and source passages…"
          aria-label="Search your knowledge"
        />
        <kbd>ESC</kbd>
      </div>
      <p className="small-print">
        Searches indexed sources in {space.name}. Passage results include
        graph-connected context.
      </p>
      {query.length < 2 ? (
        <Empty
          icon={<Search size={28} />}
          title="Locate your next lead"
          description="Enter at least two characters to search your actual indexed knowledge."
        />
      ) : (
        <>
          {entities.length > 0 && (
            <div className="search-entities">
              <span className="eyebrow">ENTITIES</span>
              {entities.map((n) => (
                <button
                  key={n.id}
                  onClick={() => go(`/app/graph?entity=${n.id}`)}
                >
                  <span>
                    {n.name}
                    <small>
                      {n.kind} · {n.degree} links
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
          )}
          {passages.isFetching ? (
            <Spinner label="Retrieving source passages" />
          ) : passages.error ? (
            <ErrorBox error={passages.error} />
          ) : (
            <div className="search-passages">
              <span className="eyebrow">
                SOURCE PASSAGES · {passages.data?.length || 0}
              </span>
              {passages.data?.map((p) => (
                <button
                  key={p.id}
                  onClick={() => go(`/app/library?document=${p.document_id}`)}
                >
                  <strong>
                    <FileText size={15} />
                    {p.title}
                    <small>PASSAGE {p.ordinal + 1}</small>
                  </strong>
                  <p>
                    {p.content.slice(0, 440)}
                    {p.content.length > 440 ? "…" : ""}
                  </p>
                </button>
              ))}
              {!passages.data?.length && (
                <p className="muted">
                  No indexed passages match. Try a named entity or a broader
                  phrase.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
