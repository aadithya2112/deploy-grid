import "@testing-library/jest-dom/vitest"

import type React from "react"
import { vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
    children: React.ReactNode
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  UserButton: () => <div data-testid="user-button">User</div>,
  SignIn: () => <div>Sign in</div>,
  SignUp: () => <div>Sign up</div>,
}))
