import { dirname } from "node:path";
import type { BuildContext, BuildStep } from "../build.pipeline.ts";
import { Shell } from "../../infrastructure/shell.ts";

export class CloneRepoStep implements BuildStep {
  async execute(ctx: BuildContext): Promise<void> {
    await Shell.run("mkdir", ["-p", dirname(ctx.projectPath)]);
    await Shell.run("git", [
      "-c",
      "init.templateDir=/dev/null",
      "clone",
      ctx.repoUrl,
      ctx.projectPath,
    ]);
  }
}
