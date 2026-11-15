ALTER TABLE deployment_details ADD COLUMN artifact_bytes bigint NOT NULL DEFAULT 0;
--> statement-breakpoint
INSERT INTO deployment_details(deployment_id,settings,expires_at)
SELECT d.id,jsonb_build_object('rootDirectory',p.root_directory,'installCommand',p.install_command,'buildCommand',p.build_command,'outputDirectory',p.output_directory),now()+interval '7 days'
FROM deployments d JOIN projects p ON p.id=d.project_id
ON CONFLICT(deployment_id) DO NOTHING;
