"use client"

import { useState } from "react"
import { KeyRound, Plus, Trash2 } from "lucide-react"

import {
  deleteProjectEnvVarAction,
  upsertProjectEnvVarAction,
} from "@/app/projects/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/ui/submit-button"
import type { ProjectEnvVarSnapshot } from "@/lib/types"

interface ProjectEnvVarsCardProps {
  projectId: string
  envVars: ProjectEnvVarSnapshot[]
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"

export function ProjectEnvVarsCard({
  projectId,
  envVars,
}: ProjectEnvVarsCardProps) {
  const [adding, setAdding] = useState(false)

  return (
    <section
      id="environment"
      className="scroll-mt-20 space-y-3"
      aria-labelledby="environment-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound
            className="size-4 text-primary dark:text-chart-2"
            aria-hidden="true"
          />
          <h2
            id="environment-heading"
            className="font-heading text-sm font-semibold tracking-tight"
          >
            Environment variables
          </h2>
          <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {envVars.length} {envVars.length === 1 ? "variable" : "variables"}
          </span>
        </div>
        <Button
          type="button"
          variant={adding ? "ghost" : "outline"}
          size="sm"
          onClick={() => setAdding((current) => !current)}
        >
          {adding ? (
            "Close"
          ) : (
            <>
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Add variable</span>
            </>
          )}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {adding ? (
          <form
            action={upsertProjectEnvVarAction}
            className="space-y-4 border-b border-border bg-muted/20 p-5"
          >
            <input type="hidden" name="projectId" value={projectId} />
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px]">
              <div className="space-y-1.5">
                <Label htmlFor="env-key" className="text-xs">
                  Key
                </Label>
                <Input
                  id="env-key"
                  name="key"
                  placeholder="VITE_API_URL"
                  pattern="[A-Za-z_][A-Za-z0-9_]*"
                  title="Letters, numbers, and underscores only (must not start with a number)"
                  required
                  className="h-9 bg-background font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="env-value" className="text-xs">
                  Value
                </Label>
                <Input
                  id="env-value"
                  name="value"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  required
                  className="h-9 bg-background font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="env-target" className="text-xs">
                  Target
                </Label>
                <select
                  id="env-target"
                  name="target"
                  defaultValue="all"
                  className={selectClass}
                >
                  <option value="all">All builds</option>
                  <option value="preview">Preview</option>
                  <option value="production">Production</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                Encrypted at rest and injected into future builds.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdding(false)}
                >
                  Cancel
                </Button>
                <SubmitButton size="sm" pendingText="Saving…">
                  Save variable
                </SubmitButton>
              </div>
            </div>
          </form>
        ) : null}

        {envVars.length ? (
          <dl className="divide-y divide-border">
            {envVars.map((variable) => (
              <div
                key={variable.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <dt className="flex flex-wrap items-center gap-2 font-mono text-xs break-all">
                  <span className="font-medium text-foreground">
                    {variable.key}
                  </span>
                  <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">
                    {variable.target}
                  </span>
                </dt>
                <dd className="flex items-center gap-3">
                  <span className="font-mono text-xs break-all text-muted-foreground">
                    {variable.maskedValue}
                  </span>
                  <form action={deleteProjectEnvVarAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="key" value={variable.key} />
                    <input
                      type="hidden"
                      name="target"
                      value={variable.target}
                    />
                    <SubmitButton
                      size="sm"
                      variant="ghost"
                      pendingText="Deleting…"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${variable.key}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      <span>Delete</span>
                    </SubmitButton>
                  </form>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No environment variables.
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Values are masked to keep your project secrets private. Changes apply to
        new deployments.
      </p>
    </section>
  )
}
