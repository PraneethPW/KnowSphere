CREATE TABLE knowsphere.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    name text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE knowsphere.sessions (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES knowsphere.users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON knowsphere.sessions(user_id);
CREATE TABLE knowsphere.spaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES knowsphere.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX spaces_owner_idx ON knowsphere.spaces(owner_id);
CREATE TABLE knowsphere.documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id uuid NOT NULL REFERENCES knowsphere.spaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text NOT NULL,
    content_hash text NOT NULL,
    format text NOT NULL,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','ready','failed','cancelled')),
    progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    error text,
    attempts integer NOT NULL DEFAULT 0,
    available_at timestamptz NOT NULL DEFAULT now(),
    lease_until timestamptz,
    lease_token uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(space_id, content_hash)
);
CREATE INDEX documents_jobs_idx ON knowsphere.documents(status, available_at, lease_until);
CREATE INDEX documents_space_idx ON knowsphere.documents(space_id, created_at DESC);
CREATE TABLE knowsphere.chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES knowsphere.documents(id) ON DELETE CASCADE,
    ordinal integer NOT NULL,
    content text NOT NULL,
    processed boolean NOT NULL DEFAULT false,
    search tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    UNIQUE(document_id, ordinal)
);
CREATE INDEX chunks_search_idx ON knowsphere.chunks USING gin(search);
CREATE TABLE knowsphere.entities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id uuid NOT NULL REFERENCES knowsphere.spaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    canonical text NOT NULL,
    kind text NOT NULL,
    UNIQUE(space_id, canonical)
);
CREATE INDEX entities_space_idx ON knowsphere.entities(space_id);
CREATE TABLE knowsphere.mentions (
    entity_id uuid NOT NULL REFERENCES knowsphere.entities(id) ON DELETE CASCADE,
    chunk_id uuid NOT NULL REFERENCES knowsphere.chunks(id) ON DELETE CASCADE,
    description text NOT NULL,
    evidence text NOT NULL,
    PRIMARY KEY(entity_id, chunk_id)
);
CREATE INDEX mentions_chunk_idx ON knowsphere.mentions(chunk_id);
CREATE TABLE knowsphere.relationships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id uuid NOT NULL REFERENCES knowsphere.entities(id) ON DELETE CASCADE,
    target_id uuid NOT NULL REFERENCES knowsphere.entities(id) ON DELETE CASCADE,
    chunk_id uuid NOT NULL REFERENCES knowsphere.chunks(id) ON DELETE CASCADE,
    label text NOT NULL,
    evidence text NOT NULL,
    confidence real NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    CHECK(source_id <> target_id),
    UNIQUE(source_id, target_id, chunk_id, label)
);
CREATE INDEX relationships_chunk_idx ON knowsphere.relationships(chunk_id);
CREATE TABLE knowsphere.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id uuid NOT NULL REFERENCES knowsphere.spaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    run_token uuid,
    running_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_space_idx ON knowsphere.conversations(space_id, created_at DESC);
CREATE TABLE knowsphere.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES knowsphere.conversations(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user','assistant')),
    content text NOT NULL,
    citations jsonb NOT NULL DEFAULT '[]',
    model text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON knowsphere.messages(conversation_id, created_at);
CREATE TABLE knowsphere.events (
    id bigserial PRIMARY KEY,
    space_id uuid NOT NULL REFERENCES knowsphere.spaces(id) ON DELETE CASCADE,
    kind text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_space_idx ON knowsphere.events(space_id, id);
CREATE TABLE knowsphere.rate_limits (
    key text PRIMARY KEY,
    count integer NOT NULL DEFAULT 1,
    expires_at timestamptz NOT NULL
);
CREATE TABLE knowsphere.worker_health (
    id text PRIMARY KEY,
    heartbeat_at timestamptz NOT NULL DEFAULT now()
);
