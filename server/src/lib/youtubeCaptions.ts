/** Server-side YouTube caption fetch (avoids browser CORS). */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export function extractVideoId(url: string): string | null {
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

function parseJsonObjectFrom(html: string, marker: string): unknown | null {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  let i = idx + marker.length;
  while (i < html.length && html[i] !== '{') i += 1;
  if (i >= html.length) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let j = i; j < html.length; j += 1) {
    const ch = html[j]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(i, j + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

type CaptionTrack = { baseUrl?: string; languageCode?: string; kind?: string };

function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  const manual = tracks.find((t) => t.kind !== 'asr' && t.baseUrl);
  return manual ?? tracks.find((t) => t.baseUrl);
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function captionsFromXml(xml: string): string {
  const parts: string[] = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const line = decodeXmlEntities(m[1]!.replace(/\n/g, ' ').trim());
    if (line) parts.push(line);
  }
  return parts.join(' ');
}

function captionsFromJson3(raw: string): string {
  try {
    const data = JSON.parse(raw) as { events?: { segs?: { utf8?: string }[] }[] };
    const parts: string[] = [];
    for (const ev of data.events ?? []) {
      for (const seg of ev.segs ?? []) {
        const t = seg.utf8?.replace(/\n/g, ' ').trim();
        if (t && t !== '\n') parts.push(t);
      }
    }
    return parts.join(' ');
  } catch {
    return '';
  }
}

export async function fetchYoutubeTranscriptText(videoId: string): Promise<string | null> {
  const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
  });
  if (!watchRes.ok) return null;
  const html = await watchRes.text();

  const player =
    parseJsonObjectFrom(html, 'ytInitialPlayerResponse = ') ??
    parseJsonObjectFrom(html, 'var ytInitialPlayerResponse = ');
  if (!player || typeof player !== 'object') return null;

  const tracks = (
    (player as { captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } } })
      .captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  );
  const track = pickCaptionTrack(tracks);
  if (!track?.baseUrl) return null;

  const captionUrl = track.baseUrl.includes('fmt=')
    ? track.baseUrl
    : `${track.baseUrl}${track.baseUrl.includes('?') ? '&' : '?'}fmt=json3`;

  const capRes = await fetch(captionUrl, { headers: { 'User-Agent': UA } });
  if (!capRes.ok) return null;
  const body = await capRes.text();
  const text = body.trim().startsWith('{') ? captionsFromJson3(body) : captionsFromXml(body);
  return text.trim() || null;
}
