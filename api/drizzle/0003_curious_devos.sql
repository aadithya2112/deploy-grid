ALTER TABLE "projects" ADD COLUMN "clerk_user_id" text;--> statement-breakpoint
DROP INDEX "projects_slug_unique";--> statement-breakpoint
DROP INDEX "projects_repo_url_unique";--> statement-breakpoint
CREATE INDEX "projects_clerk_user_id_idx" ON "projects" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_clerk_user_slug_unique" ON "projects" USING btree ("clerk_user_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_clerk_user_repo_url_unique" ON "projects" USING btree ("clerk_user_id","repo_url");
