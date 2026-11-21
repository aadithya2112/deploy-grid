"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCcw } from "lucide-react"

import type { HealthSnapshot } from "@/lib/types"
import { cn } from "@/lib/utils"

interface HealthRouteResponse {
  apiBaseUrl: string
  health: HealthSnapshot
}

interface HealthCardState {
  apiBaseUrl: string | null
  error: string | null
  health: HealthSnapshot | null
  isLoading: boolean
}

const initialState: HealthCardState = {
  apiBaseUrl: null,
  error: null,
  health: null,
  isLoading: true,
}

export function ApiHealthCard() {
  const [state, setState] = useState<HealthCardState>(initialState)
  const controllerRef = useRef<AbortController | null>(null)

  const loadHealth = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setState((previous) => ({ ...previous, isLoading: true }))

    try {
      const response = await fetch("/api/health", {
        cache: "no-store",
        signal: controller.signal,
      })

      if (!response.ok) {
        let message = `Request failed with ${response.status}`

        try {
          const body = (await response.json()) as { error?: string }
          if (body.error) {
            message = body.error
          }
        } catch {
          // Keep the fallback message when the response is not valid JSON.
        }

        throw new Error(message)
      }

      const body = (await response.json()) as HealthRouteResponse

      setState({
        apiBaseUrl: body.apiBaseUrl,
        error: null,
        health: body.health,
        isLoading: false,
      })
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      setState({
        apiBaseUrl: null,
        error:
          error instanceof Error ? error.message : "Unable to load health",
        health: null,
        isLoading: false,
      })
    }
  }, [])

  useEffect(() => {
    void loadHealth()

    return () => controllerRef.current?.abort()
  }, [loadHealth])

  const connected = state.health?.status === "ok"

  return (
    <div
      aria-live="polite"
      aria-label="API connection"
      className="rounded-lg border border-border/80 bg-background/60 px-3 py-2.5 text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              state.isLoading
                ? "animate-pulse bg-muted-foreground/60 motion-reduce:animate-none"
                : connected
                  ? "bg-emerald-500"
                  : "bg-destructive"
            )}
            aria-hidden="true"
          />
          <span className="truncate font-medium text-foreground">
            {state.isLoading
              ? "Checking API…"
              : connected
                ? "API connected"
                : "API unavailable"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void loadHealth()}
          disabled={state.isLoading}
          aria-label="Recheck API connection"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCcw
            className={cn(
              "size-3",
              state.isLoading && "animate-spin motion-reduce:animate-none"
            )}
            aria-hidden="true"
          />
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
        {state.isLoading
          ? "Checking service health"
          : connected
            ? "Database & queue ready"
            : "Click to retry connection"}
      </p>
    </div>
  )
}
