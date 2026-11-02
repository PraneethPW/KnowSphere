export type User = { id: string; name: string; email: string };
export type Space = { id: string; name: string; created_at: string };
export type Document = {
  id: string;
  title: string;
  format: string;
  status: "queued" | "processing" | "ready" | "failed" | "cancelled";
  progress: number;
  error: string | null;
  attempts: number;
  characters: number;
  available_at: string;
  created_at: string;
  updated_at: string;
};
export type GraphNode = {
  id: string;
  name: string;
  kind: string;
  centrality: number;
  community: number;
  degree: number;
  mentions: number;
};
export type GraphLink = {
  id: string;
  source: string;
  target: string;
  label: string;
  evidence: string;
  confidence: number;
  document_id: string;
  title: string;
};
export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
  communities: number;
  components: number;
  truncated: boolean;
  total_entities: number;
  total_relationships: number;
};
export type OverviewData = {
  documents: number;
  ready_documents: number;
  entities: number;
  relationships: number;
  active_jobs: number;
  failed_jobs: number;
  characters: number;
  recent_activity: {
    id: number;
    kind: string;
    payload: { title?: string; status?: string; progress?: number };
    created_at: string;
  }[];
  growth: { day: string; count: number }[];
};
export type Citation = {
  index: number;
  chunk_id: string;
  document_id: string;
  title: string;
  excerpt: string;
  ordinal: number;
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  model?: string;
  failed?: boolean;
};
export type Conversation = { id: string; title: string; created_at: string };
export type SourceDocument = {
  id: string;
  title: string;
  content: string;
  status: string;
};
export type SystemInfo = {
  database: string;
  ai_configured: boolean;
  model: string;
  worker: string;
  worker_last_seen: string | null;
  registration_enabled: boolean;
  limits: {
    upload_bytes: number;
    document_characters: number;
    documents_per_space: number;
  };
  retrieval: string;
  graph_algorithms: string[];
};
export type EntityDetail = {
  id: string;
  name: string;
  kind: string;
  sources: {
    description: string;
    evidence: string;
    chunk_id: string;
    ordinal: number;
    document_id: string;
    title: string;
  }[];
  relationships: {
    label: string;
    evidence: string;
    confidence: number;
    source: string;
    target: string;
    document_id: string;
    title: string;
  }[];
};
export const KIND_COLORS: Record<string, string> = {
  concept: "#d9f99d",
  technology: "#92b9f6",
  person: "#d5a8ee",
  organization: "#f2ba8e",
  location: "#7cdbca",
  event: "#f29cb6",
};
