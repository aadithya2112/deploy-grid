"use client"

import type * as React from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

export interface SubmitButtonProps extends React.ComponentProps<typeof Button> {
  pendingText?: string
}

export function SubmitButton({
  children,
  pendingText,
  disabled,
  type = "submit",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button
      type={type}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? (
        <>
          <Loader2
            className="size-3.5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span>{pendingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </Button>
  )
}
