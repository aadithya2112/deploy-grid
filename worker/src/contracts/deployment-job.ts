export interface DeploymentJobMessage {
  buildJobId: string;
  deploymentId: string;
  projectId: string;
  repoUrl: string;
  gitRef: string;
  rootDirectory: string | null;
  installCommand: string | null;
  buildCommand: string | null;
  outputDirectory: string | null;
}
