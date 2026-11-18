/**
 * True when an error means the server couldn't be reached at all (offline, or in development
 * the dev server stopped), as opposed to the server answering with a problem.
 */
export function isNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message.toLowerCase();
  return (
    e.name === 'ChunkLoadError' ||
    m.includes('failed to fetch') || // Chrome, Edge
    m.includes('load failed') || // Safari
    m.includes('networkerror') || // Firefox
    m.includes('network request failed') || // React Native
    m.includes('loading module') ||
    m.includes('dynamically imported module')
  );
}

/** What to tell people when the server can't be reached. */
export const OFFLINE_MESSAGE = __DEV__
  ? 'Can’t reach the CardMaxx dev server. It may have stopped: start it again, then try again.'
  : 'Can’t reach CardMaxx. Check your internet connection and try again.';

/**
 * fetch(), but an unreachable server becomes an Error with a message people can act on
 * instead of the browser's bare "Failed to fetch".
 */
export async function fetchOrExplain(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (e) {
    if (isNetworkError(e)) throw new Error(OFFLINE_MESSAGE);
    throw e;
  }
}
