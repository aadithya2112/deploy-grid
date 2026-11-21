"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface RefreshButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm" | "lg" | "icon"
  label?: string
  pendingLabel?: string
  className?: string
}

export function RefreshButton({
  variant = "ghost",
  size = "sm",
  label = "Refresh",
  pendingLabel = "Refreshing…",
  className,
}: RefreshButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={isPending}
      aria-busy={isPending || undefined}
      onClick={() => {
        startTransition(() => {
          router.refresh()
        })
      }}
    >
      <RefreshCcw
        className={cn(
          "size-3.5",
          isPending && "animate-spin motion-reduce:animate-none"
        )}
        aria-hidden="true"
      />
      <span>{isPending ? pendingLabel : label}</span>
    </Button>
  )
}
