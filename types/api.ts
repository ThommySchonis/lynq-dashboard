/** Generic for dynamic route params in Next.js 16 app router */
export type RouteContext<T extends Record<string, string> = Record<string, string>> = {
  params: Promise<T>
}

/** Common API error response shape */
export interface ApiErrorResponse {
  error: string
  code?: string
}
