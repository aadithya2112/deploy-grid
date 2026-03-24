import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const deploymentStatusEnum = pgEnum("deployment_status", [
  "queued",
  "building",
  "ready",
  "failed",
  "cancelled",
]);

export const buildJobStatusEnum = pgEnum("build_job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export const logStreamEnum = pgEnum("deployment_log_stream", [
  "stdout",
  "stderr",
  "system",
]);

export const projectEnvTargetEnum = pgEnum("project_env_target", [
  "all",
  "preview",
  "production",
]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    repoUrl: text("repo_url").notNull(),
    defaultBranch: text("default_branch").notNull().default("main"),
    rootDirectory: text("root_directory"),
    installCommand: text("install_command"),
    buildCommand: text("build_command"),
    outputDirectory: text("output_directory"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("projects_clerk_user_id_idx").on(table.clerkUserId),
    uniqueIndex("projects_clerk_user_slug_unique").on(
      table.clerkUserId,
      table.slug,
    ),
    uniqueIndex("projects_clerk_user_repo_url_unique").on(
      table.clerkUserId,
      table.repoUrl,
    ),
  ],
);

export const deployments = pgTable(
  "deployments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: deploymentStatusEnum("status").notNull().default("queued"),
    gitRef: text("git_ref").notNull(),
    commitSha: text("commit_sha"),
    errorMessage: text("error_message"),
    previewUrl: text("preview_url"),
    artifactUrl: text("artifact_url"),
    buildStartedAt: timestamp("build_started_at", { withTimezone: true }),
    buildFinishedAt: timestamp("build_finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("deployments_project_created_at_idx").on(
      table.projectId,
      table.createdAt,
    ),
    index("deployments_status_idx").on(table.status),
  ],
);

export const buildJobs = pgTable(
  "build_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployments.id, { onDelete: "cascade" }),
    status: buildJobStatusEnum("status").notNull().default("queued"),
    claimedBy: text("claimed_by"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("build_jobs_deployment_id_unique").on(table.deploymentId),
    index("build_jobs_status_idx").on(table.status),
    index("build_jobs_lease_until_idx").on(table.leaseUntil),
  ],
);

export const deploymentLogs = pgTable(
  "deployment_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployments.id, { onDelete: "cascade" }),
    stream: logStreamEnum("stream").notNull().default("system"),
    sequence: integer("sequence").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("deployment_logs_deployment_sequence_idx").on(
      table.deploymentId,
      table.sequence,
    ),
  ],
);

export const projectEnvVars = pgTable(
  "project_env_vars",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    target: projectEnvTargetEnum("target").notNull().default("all"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("project_env_vars_project_key_target_unique").on(
      table.projectId,
      table.key,
      table.target,
    ),
    index("project_env_vars_project_idx").on(table.projectId),
  ],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type DeploymentRow = typeof deployments.$inferSelect;
export type NewDeploymentRow = typeof deployments.$inferInsert;
export type BuildJob = typeof buildJobs.$inferSelect;
export type NewBuildJob = typeof buildJobs.$inferInsert;
export type DeploymentLog = typeof deploymentLogs.$inferSelect;
export type NewDeploymentLog = typeof deploymentLogs.$inferInsert;
export type ProjectEnvVar = typeof projectEnvVars.$inferSelect;
export type NewProjectEnvVar = typeof projectEnvVars.$inferInsert;
