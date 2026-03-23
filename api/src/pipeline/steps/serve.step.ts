import { join } from "node:path";
import type { BuildContext, BuildStep } from "../build.pipeline.ts";

const outputDirectories = ["dist", "build", "out"];

export class ServeStep implements BuildStep {
  async execute(ctx: BuildContext): Promise<void> {
    for (const directory of outputDirectories) {
      const outputPath = join(ctx.projectPath, directory);

      if (await Bun.file(outputPath).exists()) {
        ctx.outputPath = outputPath;
        return;
      }
    }
  }
}
