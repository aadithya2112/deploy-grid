"use client"

import { Github, Settings2 } from "lucide-react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ProjectCreateFields() {
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor="repoUrl">GitHub URL</Label>
        <div className="relative">
          <Github className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="repoUrl"
            name="repoUrl"
            type="url"
            placeholder="https://github.com/owner/repo.git"
            required
            className="h-11 rounded-xl pl-10"
          />
        </div>
      </div>

      <Accordion
        type="single"
        collapsible
        className="rounded-[20px] border border-border/70 bg-muted/[0.35] px-4"
      >
        <AccordionItem value="advanced" className="border-none">
          <AccordionTrigger className="py-4 text-sm hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-2xl border border-border/70 bg-background/80">
                <Settings2 className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Advanced settings</p>
                <p className="text-xs text-muted-foreground">
                  Override build defaults only when the repo needs custom paths or commands.
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Project name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="my-app"
                  className="h-10 rounded-xl bg-background"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="defaultBranch">Default branch</Label>
                <Input
                  id="defaultBranch"
                  name="defaultBranch"
                  placeholder="main"
                  className="h-10 rounded-xl bg-background"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rootDirectory">Root directory</Label>
                <Input
                  id="rootDirectory"
                  name="rootDirectory"
                  placeholder="apps/web"
                  className="h-10 rounded-xl bg-background"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="outputDirectory">Output directory</Label>
                <Input
                  id="outputDirectory"
                  name="outputDirectory"
                  placeholder="dist"
                  className="h-10 rounded-xl bg-background"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="installCommand">Install command</Label>
                <Input
                  id="installCommand"
                  name="installCommand"
                  placeholder="bun install"
                  className="h-10 rounded-xl bg-background"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="buildCommand">Build command</Label>
                <Input
                  id="buildCommand"
                  name="buildCommand"
                  placeholder="bun run build"
                  className="h-10 rounded-xl bg-background"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  )
}
