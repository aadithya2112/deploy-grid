import { vi } from "vitest"

export class RedirectError extends Error {
  constructor(public readonly location: string) {
    super(`redirect:${location}`)
    this.name = "RedirectError"
  }
}

export class NotFoundError extends Error {
  constructor() {
    super("notFound")
    this.name = "NotFoundError"
  }
}

export const refreshMock = vi.fn()

export const redirectMock = vi.fn((location: string) => {
  throw new RedirectError(location)
})

export const notFoundMock = vi.fn(() => {
  throw new NotFoundError()
})

export const useRouterMock = vi.fn(() => ({
  refresh: refreshMock,
}))

export function resetNavigationMocks() {
  refreshMock.mockReset()
  redirectMock.mockClear()
  notFoundMock.mockClear()
  useRouterMock.mockClear()
}
