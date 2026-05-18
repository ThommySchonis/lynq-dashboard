/**
 * Type-safe wrapper for request.json(). Avoids inline `as` assertions
 * by returning a properly typed Promise.
 *
 * Usage:
 *   const body = await parseBody<CreateUserBody>(request)
 */
export async function parseBody<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>
}

/**
 * Type-safe wrapper for Response.json(). Avoids inline `as` assertions
 * on fetch responses.
 *
 * Usage:
 *   const data = await parseJson<{ orders: Order[] }>(response)
 */
export async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}
