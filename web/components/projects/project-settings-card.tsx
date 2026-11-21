"use client"

import { useState } from "react"
import { Pencil, Settings2 } from "lucide-react"

import { updateProjectSettingsAction } from "@/app/projects/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/ui/submit-button"
import type { ProjectSnapshot } from "@/lib/types"

interface ProjectSettingsCardProps {
  project: ProjectSnapshot
}

export function ProjectSettingsCard({ project }: ProjectSettingsCardProps) {
  const [editing, setEditing] = useState(false)

  const settings = [
    ["Default branch", project.defaultBranch],
    ["Root directory", project.rootDirectory ?? "Repository root"],
    ["Install command", project.installCommand ?? "Automatic"],
    ["Build command", project.buildCommand ?? "Automatic"],
    ["Output directory", project.outputDirectory ?? "dist"],
  ] as const

  return (
    <aside
      id="configuration"
      className="min-w-0 scroll-mt-20 rounded-xl border border-border bg-card p-5"
      aria-label="Project configuration"
    >
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-border pb-3.5">
        <div className="flex items-center gap-2">
          <Settings2
            className="size-4 text-primary dark:text-chart-2"
            aria-hidden="true"
          />
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            Build settings
          </h2>
        </div>
        {!editing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3" aria-hidden="true" />
            <span>Edit</span>
          </Button>
        ) : null}
      </div>

      {editing ? (
        <form action={updateProjectSettingsAction} className="space-y-3.5">
          <input type="hidden" name="projectId" value={project.id} />
          <div className="space-y-1">
            <Label htmlFor="settings-defaultBranch" className="text-xs">
              Default branch
            </Label>
            <Input
              id="settings-defaultBranch"
              name="defaultBranch"
              defaultValue={project.defaultBranch}
              required
              className="h-8 font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="settings-rootDirectory" className="text-xs">
              Root directory
            </Label>
            <Input
              id="settings-rootDirectory"
              name="rootDirectory"
              defaultValue={project.rootDirectory ?? ""}
              placeholder="Repository root"
              className="h-8 font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="settings-installCommand" className="text-xs">
              Install command
            </Label>
            <Input
              id="settings-installCommand"
              name="installCommand"
              defaultValue={project.installCommand ?? ""}
              placeholder="Automatic"
              className="h-8 font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="settings-buildCommand" className="text-xs">
              Build command
            </Label>
            <Input
              id="settings-buildCommand"
              name="buildCommand"
              defaultValue={project.buildCommand ?? ""}
              placeholder="Automatic"
              className="h-8 font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="settings-outputDirectory" className="text-xs">
              Output directory
            </Label>
            <Input
              id="settings-outputDirectory"
              name="outputDirectory"
              defaultValue={project.outputDirectory ?? ""}
              placeholder="dist"
              className="h-8 font-mono text-xs"
            />
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground">
            Leave optional fields blank for automatic detection. Changes apply
            to future deployments.
          </p>
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <SubmitButton size="sm" pendingText="Saving…">
              Save settings
            </SubmitButton>
          </div>
        </form>
      ) : (
        <dl className="divide-y divide-border/70">
          {settings.map(([label, value]) => (
            <div key={label} className="py-3 first:pt-0 last:pb-0">
              <dt className="text-[11px] text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-mono text-xs leading-5 break-all text-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </aside>
  )
}
