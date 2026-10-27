/** Public music databases ask clients to say who they are; this names the app and its public project page. */
export const USER_AGENT = "RetroBeats/0.2.4 (https://github.com/Deg028/Retro-Beats-App)"

/** The server could not be reached or answered with an error, as opposed to answering "not found". */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NetworkError"
  }
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const TRIES = 3
const TIMEOUT_MS = 12_000

/**
 * One request with a time limit and a few tries. Returns null when the server says the thing does not exist
 * (404) and throws NetworkError when it could not be asked, so the two are never confused.
 */
export async function request(url: string, method: "GET" | "HEAD" = "GET"): Promise<Response | null> {
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const stop = new AbortController()
    const timer = setTimeout(() => stop.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(url, { method, headers: { "User-Agent": USER_AGENT }, signal: stop.signal })
    } catch {
      if (attempt === TRIES - 1) throw new NetworkError("Sin conexión o el servidor no responde")
      await sleep(800 * (attempt + 1))
      continue
    } finally {
      clearTimeout(timer)
    }
    if (res.ok) return res
    if (res.status === 404) return null
    // Busy, rate limited or briefly failing: wait a little longer each time
    if ([429, 500, 502, 503, 504].includes(res.status) && attempt < TRIES - 1) {
      await sleep(1500 * (attempt + 1))
      continue
    }
    throw new NetworkError(`El servidor respondió ${res.status}`)
  }
  throw new NetworkError("El servidor no responde")
}

export async function getJson<T>(url: string): Promise<T | null> {
  const res = await request(url)
  return res ? ((await res.json()) as T) : null
}

export async function exists(url: string) {
  return (await request(url, "HEAD")) !== null
}
