CREATE TYPE "public"."project_env_target" AS ENUM('all', 'preview', 'production');--> statement-breakpoint
CREATE TABLE "project_env_vars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"target" "project_env_target" DEFAULT 'all' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_env_vars" ADD CONSTRAINT "project_env_vars_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_env_vars_project_key_target_unique" ON "project_env_vars" USING btree ("project_id","key","target");--> statement-breakpoint
CREATE INDEX "project_env_vars_project_idx" ON "project_env_vars" USING btree ("project_id");