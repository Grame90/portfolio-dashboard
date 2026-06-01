"use client";

import { useEffect, useState } from "react";

interface TelegramPost {
  id: string;
  channel: string;
  link: string;
  date: string;
  text: string;
  photo?: string;
  views?: string;
}

interface TelegramFeedProps {
  channel: string;
  title?: string;
  /** Cap on rendered posts. Default 50 (effectively no cap for 24h windows). */
  limit?: number;
  /** Max card height (overflow scrolls). Default 480px. */
  maxHeight?: number;
  /** Auto-refresh interval in seconds. Default 300 (5 min). 0 disables. */
  refreshSeconds?: number;
  /** Deprecated, no longer used (full text always shown). */
  textPreviewChars?: number;
  /** Show post photos. Default true. */
  showPhotos?: boolean;
  /** Time window in hours: only posts newer than this. Default 24. 0 = no filter. */
  sinceHours?: number;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return "только что";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} мин`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} ч`;
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// Auto-link bare URLs in the post text so they're clickable.
function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--accent-light)", textDecoration: "none" }}
        onClick={(e) => e.stopPropagation()}
      >{part.length > 40 ? part.slice(0, 40) + "…" : part}</a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function TelegramFeed({
  channel,
  title = `Канал @${channel}`,
  limit = 50,
  maxHeight = 480,
  refreshSeconds = 300,
  showPhotos = true,
  sinceHours = 24,
}: TelegramFeedProps) {
  const [posts, setPosts] = useState<TelegramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  async function load() {
    try {
      const url = `/api/telegram-feed?channel=${encodeURIComponent(channel)}&sinceHours=${sinceHours}`;
      const res = await fetch(url);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setUpdatedAt(data.fetchedAt ?? new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (refreshSeconds > 0) {
      const id = setInterval(load, refreshSeconds * 1000);
      return () => clearInterval(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, refreshSeconds, sinceHours]);

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 8, flexWrap: "wrap", gap: 4,
      }}>
        <div className="card-title" style={{ marginBottom: 0 }}>{title}</div>
        <a
          href={`https://t.me/${channel}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 10, color: "var(--accent-light)", textDecoration: "none" }}
        >Открыть в Telegram →</a>
      </div>

      {loading && posts.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "8px 0" }}>
          Загружаю посты…
        </div>
      )}

      {error && (
        <div style={{ color: "#ef4444", fontSize: 11, padding: "8px 0" }}>
          Ошибка: {error}
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "8px 0" }}>
          {sinceHours > 0 ? `За последние ${sinceHours} ч нет новостей` : "Нет постов"}
        </div>
      )}

      {posts.length > 0 && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 8,
          maxHeight, overflowY: "auto", paddingRight: 4,
        }}>
          {posts.slice(0, limit).map((p) => (
            <div
              key={p.id}
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 12px",
                color: "var(--text-primary)",
              }}
            >
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 6, fontSize: 10, color: "var(--text-muted)",
              }}>
                <span style={{ fontWeight: 600, color: "var(--accent-light)" }}>
                  @{p.channel}
                </span>
                <span>
                  {relativeTime(p.date)}
                  {p.views && <span style={{ marginLeft: 6 }}>· 👁 {p.views}</span>}
                </span>
              </div>

              {showPhotos && p.photo && (
                <div style={{
                  width: "100%", aspectRatio: "16 / 9",
                  backgroundImage: `url("${p.photo}")`,
                  backgroundSize: "cover", backgroundPosition: "center",
                  borderRadius: 6, marginBottom: 6,
                }} />
              )}

              {p.text && (
                <div style={{
                  fontSize: 13, lineHeight: 1.5,
                  color: "var(--text-secondary)",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {linkify(p.text)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {updatedAt && !loading && (
        <div style={{ marginTop: 8, fontSize: 9, color: "var(--text-muted)", textAlign: "right" }}>
          Обновлено: {new Date(updatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}
