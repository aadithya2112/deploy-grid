"use client"

import { useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ProjectSearchFormProps {
  initialQuery: string
}

export function ProjectSearchForm({ initialQuery }: ProjectSearchFormProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  function navigateWithQuery(nextQuery: string) {
    const trimmed = nextQuery.trim()
    const target = trimmed
      ? `/dashboard?${new URLSearchParams({ query: trimmed }).toString()}`
      : "/dashboard"

    startTransition(() => {
      router.push(target)
    })
  }

  return (
    <form
      action="/dashboard"
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        const raw = formData.get("query")
        navigateWithQuery(typeof raw === "string" ? raw : "")
      }}
      className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-5"
    >
      <label htmlFor="project-search" className="sr-only">
        Find a project
      </label>
      <div className="relative min-w-0 flex-1">
        {isPending ? (
          <Loader2
            className="pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 animate-spin text-primary motion-reduce:animate-none dark:text-chart-2"
            aria-hidden="true"
          />
        ) : (
          <Search
            className="pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <Input
          ref={inputRef}
          key={initialQuery}
          id="project-search"
          type="search"
          name="query"
          defaultValue={initialQuery}
          placeholder="Find a project or repository…"
          className="h-9 border-0 bg-transparent pl-7 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
      <div className="flex items-center gap-1.5">
        {initialQuery ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.value = ""
              }
              navigateWithQuery("")
            }}
          >
            <X className="size-3.5" aria-hidden="true" />
            Clear
          </Button>
        ) : null}
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={isPending}
          aria-busy={isPending || undefined}
        >
          {isPending ? (
            <>
              <Loader2
                className="size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span>Searching…</span>
            </>
          ) : (
            "Search"
          )}
        </Button>
      </div>
    </form>
  )
}
