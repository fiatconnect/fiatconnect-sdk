export function fetchWithTimeout(fetchFn: typeof fetch, timeout: number) {
  return async function (
    input: URL | RequestInfo,
    init?: RequestInit | undefined,
  ): Promise<Response> {
    const controller = new AbortController()
    const id = setTimeout(() => {
      controller.abort()
    }, timeout)
    const response = await fetchFn(input, {
      ...init,
      signal: controller.signal,
    })
    clearTimeout(id)
    return response
  }
}
