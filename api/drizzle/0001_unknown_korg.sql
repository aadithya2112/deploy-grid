DROP INDEX "projects_repo_url_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "projects_repo_url_unique" ON "projects" USING btree ("repo_url");