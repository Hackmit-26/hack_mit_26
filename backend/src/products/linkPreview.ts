import { AppError } from '../lib/errors.js';

export type LinkPreview = {
  title: string;
  imageUrl: string | null;
  priceCents: number | null;
  merchant: string | null;
};

const TIMEOUT_MS = 5_000;
/** Open Graph tags live in <head>; no need to hold a whole product page in memory. */
const MAX_CHARS = 512 * 1024;

const USER_AGENT = 'Mozilla/5.0 (compatible; SocialShoppingBot/1.0)';

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function metaContent(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*?content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${escaped}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    const content = match?.[1]?.trim();
    if (content) return decodeEntities(content);
  }
  return undefined;
}

/** Open Graph prices are decimal strings in major units; money is integer cents from here on. */
function parsePriceCents(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = /\d+(?:[.,]\d+)?/.exec(raw.replace(/,(?=\d{3}\b)/g, ''));
  if (!match) return null;
  const amount = Number.parseFloat(match[0].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function absolutise(value: string | undefined, base: URL): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

/**
 * Best-effort paste-a-link preview (§8.5). Never hangs: the fetch is aborted after 5s, and every
 * failure surfaces as an AppError because callers wrap this and fall back to manual entry.
 */
export async function linkPreview(url: string): Promise<LinkPreview> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError('VALIDATION_ERROR', 400, `"${url}" is not a valid URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new AppError('VALIDATION_ERROR', 400, 'Only http and https links are supported');
  }

  let response: Response;
  try {
    response = await fetch(parsed, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    });
  } catch (err) {
    const reason = err instanceof Error && err.name === 'TimeoutError' ? 'timed out' : 'failed';
    throw new AppError('VALIDATION_ERROR', 422, `Fetching ${parsed.hostname} ${reason}`);
  }

  if (!response.ok) {
    throw new AppError('VALIDATION_ERROR', 422, `${parsed.hostname} responded ${response.status}`);
  }

  let html: string;
  try {
    html = (await response.text()).slice(0, MAX_CHARS);
  } catch {
    throw new AppError('VALIDATION_ERROR', 422, `Could not read the page at ${parsed.hostname}`);
  }

  const hostname = parsed.hostname.replace(/^www\./, '');
  const titleTag = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();

  return {
    title: metaContent(html, 'og:title') ?? (titleTag ? decodeEntities(titleTag) : hostname),
    imageUrl:
      absolutise(metaContent(html, 'og:image'), parsed) ??
      absolutise(metaContent(html, 'og:image:secure_url'), parsed),
    priceCents:
      parsePriceCents(metaContent(html, 'og:price:amount')) ??
      parsePriceCents(metaContent(html, 'product:price:amount')),
    merchant: metaContent(html, 'og:site_name') ?? hostname,
  };
}
