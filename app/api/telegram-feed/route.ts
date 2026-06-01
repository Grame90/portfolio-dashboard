// Telegram public channel feed.
//
// Scrapes https://t.me/s/{channel} (the public web preview) and returns the
// latest posts as JSON. No bot, no auth — works for any public channel.
//
// Usage: GET /api/telegram-feed?channel=markettwits
//
// Cache-Control: public, max-age=300 — Vercel CDN caches for 5 minutes so
// upstream Telegram isn't hammered.

import { NextRequest, NextResponse } from "next/server";

interface TelegramPost {
  id: string;             // "markettwits/12345"
  channel: string;
  link: string;           // https://t.me/markettwits/12345
  date: string;           // ISO timestamp
  text: string;           // plain text (no HTML)
  photo?: string;         // background-image URL if the post has a photo
  views?: string;         // e.g. "12.5K"
}

const ALLOWED_CHANNELS = new Set([
  "markettwits",
  // add more here as users request them
]);

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

function stripHtml(html: string): string {
  // Replace <br> with newlines for readability.
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?[^>]+>/g, "")
      .trim(),
  );
}

function parsePosts(html: string, channel: string): TelegramPost[] {
  const posts: TelegramPost[] = [];

  // Each post is a div with class "tgme_widget_message"
  const messageRe = /<div class="tgme_widget_message[^"]*"[^>]*data-post="([^"]+)"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
  const matches = Array.from(html.matchAll(messageRe));

  for (const m of matches) {
    const block = m[0];
    const dataPost = m[1]; // "markettwits/12345"

    // Text: inside <div class="tgme_widget_message_text js-message_text"…>…</div>
    const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const text = textMatch ? stripHtml(textMatch[1]) : "";

    // Date: <time datetime="2026-05-30T12:00:00+00:00" …>
    const dateMatch = block.match(/<time[^>]*datetime="([^"]+)"/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString();

    // Photo: <a class="tgme_widget_message_photo_wrap" … style="background-image:url('URL')">
    const photoMatch = block.match(/background-image:url\(['"]?([^'")]+)['"]?\)/);
    const photo = photoMatch ? photoMatch[1] : undefined;

    // Views: <span class="tgme_widget_message_views">12.5K</span>
    const viewsMatch = block.match(/<span class="tgme_widget_message_views">([^<]+)<\/span>/);
    const views = viewsMatch ? viewsMatch[1] : undefined;

    if (!text && !photo) continue; // skip empty posts

    posts.push({
      id: dataPost,
      channel,
      link: `https://t.me/${dataPost}`,
      date,
      text,
      photo,
      views,
    });
  }

  // Telegram returns posts oldest → newest. Reverse so newest is first.
  return posts.reverse();
}

export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get("channel")?.toLowerCase().trim();
  if (!channel) {
    return NextResponse.json({ error: "Missing ?channel" }, { status: 400 });
  }
  if (!ALLOWED_CHANNELS.has(channel)) {
    return NextResponse.json({ error: `Channel "${channel}" not in allowlist` }, { status: 403 });
  }

  // Time-window filter: "?sinceHours=24" → only posts from last 24h.
  // Default 24, 0 disables filtering.
  const sinceHoursRaw = req.nextUrl.searchParams.get("sinceHours");
  const sinceHours = sinceHoursRaw === null
    ? 24
    : Number.isFinite(Number(sinceHoursRaw)) && Number(sinceHoursRaw) >= 0
      ? Number(sinceHoursRaw)
      : 24;

  try {
    const res = await fetch(`https://t.me/s/${encodeURIComponent(channel)}`, {
      headers: {
        // t.me serves a stub page to bots; use a real-browser UA to get the
        // posts rendered.
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "ru,en;q=0.8",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Telegram returned ${res.status}` }, { status: 502 });
    }
    const html = await res.text();
    let posts = parsePosts(html, channel);

    if (sinceHours > 0) {
      const cutoff = Date.now() - sinceHours * 3600 * 1000;
      posts = posts.filter((p) => {
        const t = new Date(p.date).getTime();
        return Number.isFinite(t) && t >= cutoff;
      });
    }

    posts = posts.slice(0, 100);

    return NextResponse.json(
      { channel, sinceHours, count: posts.length, posts, fetchedAt: new Date().toISOString() },
      {
        headers: {
          // CDN caches for 5 minutes; stale-while-revalidate keeps it fast.
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Fetch failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}
