export interface BuildContext {
  deploymentId: string;
  repoUrl: string;
  projectPath: string;
  outputPath?: string;
}

export interface BuildStep {
  execute(ctx: BuildContext): Promise<void>;
}

export class BuildPipeline {
  constructor(private readonly steps: BuildStep[]) {}

  async run(ctx: BuildContext): Promise<void> {
    for (const step of this.steps) {
      await step.execute(ctx);
    }
  }
}
