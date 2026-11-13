CREATE TABLE project_releases (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  deployment_id uuid REFERENCES deployments(id) ON DELETE SET NULL,
  github_installation_id bigint,
  github_repository text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE deployment_details (
  deployment_id uuid PRIMARY KEY REFERENCES deployments(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'preview' CHECK (environment IN ('preview', 'production')),
  settings jsonb NOT NULL DEFAULT '{}',
  artifact_prefix text,
  framework text,
  routing text CHECK (routing IN ('spa', 'static')),
  metrics jsonb NOT NULL DEFAULT '{}',
  pull_request integer,
  event_key text UNIQUE,
  expires_at timestamptz,
  deleted_at timestamptz
);
--> statement-breakpoint
CREATE INDEX deployment_details_expiry_idx ON deployment_details(expires_at) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE TABLE release_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deployment_id uuid NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE github_deliveries (
  id text PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
