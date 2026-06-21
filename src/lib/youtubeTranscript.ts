/** YouTube URL parsing and transcript fetch (via server proxy to avoid CORS). */

export function extractYoutubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export async function fetchYoutubeTranscript(
  youtubeUrl: string,
  settings?: { authProxyBase?: string; llmProxyUrl?: string; authToken?: string },
): Promise<string | null> {
  const base = (settings?.authProxyBase ?? settings?.llmProxyUrl?.replace(/\/v1\/?$/, '') ?? 'http://localhost:8787')
    .replace(/\/$/, '');
  const headers: Record<string, string> = {};
  if (settings?.authToken) headers.Authorization = `Bearer ${settings.authToken}`;
  try {
    const res = await fetch(
      `${base}/v1/youtube/transcript?url=${encodeURIComponent(youtubeUrl)}`,
      { headers },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { transcript?: string };
    return data.transcript?.trim() || null;
  } catch {
    return null;
  }
}
