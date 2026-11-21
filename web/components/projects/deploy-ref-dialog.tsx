"use client"

import { useState } from "react"
import { GitBranch, Rocket } from "lucide-react"

import { deployProjectAction } from "@/app/projects/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/ui/submit-button"

interface DeployRefDialogProps {
  projectId: string
  defaultBranch: string
}

export function DeployRefDialog({
  projectId,
  defaultBranch,
}: DeployRefDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <GitBranch className="size-3.5" aria-hidden="true" />
          <span>Deploy ref</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deploy a branch or commit</DialogTitle>
          <DialogDescription>
            Queue a new build from any branch, tag, or commit SHA in this
            repository.
          </DialogDescription>
        </DialogHeader>
        <form action={deployProjectAction} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <div className="space-y-1.5">
            <Label htmlFor="deploy-git-ref">Branch, tag, or commit SHA</Label>
            <Input
              id="deploy-git-ref"
              name="gitRef"
              defaultValue={defaultBranch}
              placeholder="main"
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton size="sm" pendingText="Starting deploy…">
              <Rocket className="size-3.5" aria-hidden="true" />
              <span>Start deployment</span>
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
