"use client"

import type { ReactNode } from "react"
import { useLinkStatus } from "next/link"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface LinkPendingIndicatorProps {
  fallback?: ReactNode
  className?: string
}

export function LinkPendingIndicator({
  fallback = null,
  className,
}: LinkPendingIndicatorProps) {
  const { pending } = useLinkStatus()

  if (!pending) {
    return <>{fallback}</>
  }

  return (
    <>
      <Loader2
        className={cn(
          "size-3.5 shrink-0 animate-spin text-primary motion-reduce:animate-none dark:text-chart-2",
          className
        )}
        aria-hidden="true"
      />
      <span className="sr-only">Loading…</span>
    </>
  )
}
