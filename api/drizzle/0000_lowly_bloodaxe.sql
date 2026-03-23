CREATE TYPE "public"."build_job_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."deployment_status" AS ENUM('queued', 'building', 'ready', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."deployment_log_stream" AS ENUM('stdout', 'stderr', 'system');--> statement-breakpoint
CREATE TABLE "build_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"status" "build_job_status" DEFAULT 'queued' NOT NULL,
	"claimed_by" text,
	"lease_until" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployment_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"stream" "deployment_log_stream" DEFAULT 'system' NOT NULL,
	"sequence" integer NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "deployment_status" DEFAULT 'queued' NOT NULL,
	"git_ref" text NOT NULL,
	"commit_sha" text,
	"error_message" text,
	"preview_url" text,
	"artifact_url" text,
	"build_started_at" timestamp with time zone,
	"build_finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"repo_url" text NOT NULL,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"root_directory" text,
	"install_command" text,
	"build_command" text,
	"output_directory" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "build_jobs" ADD CONSTRAINT "build_jobs_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_logs" ADD CONSTRAINT "deployment_logs_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "build_jobs_deployment_id_unique" ON "build_jobs" USING btree ("deployment_id");--> statement-breakpoint
CREATE INDEX "build_jobs_status_idx" ON "build_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "build_jobs_lease_until_idx" ON "build_jobs" USING btree ("lease_until");--> statement-breakpoint
CREATE INDEX "deployment_logs_deployment_sequence_idx" ON "deployment_logs" USING btree ("deployment_id","sequence");--> statement-breakpoint
CREATE INDEX "deployments_project_created_at_idx" ON "deployments" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "deployments_status_idx" ON "deployments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_unique" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "projects_repo_url_idx" ON "projects" USING btree ("repo_url");