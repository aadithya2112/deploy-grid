import type { BuildContext, BuildStep } from "../build.pipeline.ts";
import { Shell } from "../../infrastructure/shell.ts";

export class InstallDepsStep implements BuildStep {
  async execute(ctx: BuildContext): Promise<void> {
    await Shell.run("bun", ["install"], {
      cwd: ctx.projectPath,
    });
  }
}
