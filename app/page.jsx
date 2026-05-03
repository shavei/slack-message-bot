"use client";

import { useEffect, useMemo, useState } from "react";

export default function Home() {
  const [config, setConfig] = useState(null);
  const [me, setMe] = useState(null);
  const [messages, setMessages] = useState([]);
  const [summary, setSummary] = useState("Checking connection...");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const isConnected = Boolean(me?.user?.id);

  useEffect(() => {
    async function load() {
      const configData = await getJson("/api/config");
      setConfig(configData);

      const meData = await getJson("/api/me", true);
      if (meData?.user) {
        setMe(meData);
        await loadMessages("");
      } else {
        setSummary("Connect Slack to read messages sent by your own Slack user account.");
      }
    }

    load().catch((error) => setSummary(error.message));
  }, []);

  const connectionLabel = useMemo(() => {
    if (!config?.configured) return "Missing environment variables";
    if (!isConnected) return "Not connected";
    return `${me.user.name || me.user.id} in ${me.team?.name || me.team?.id}`;
  }, [config, isConnected, me]);

  async function loadMessages(nextQuery = query) {
    setBusy(true);
    setSummary("Loading your sent messages...");
    setMessages([]);

    try {
      const params = new URLSearchParams({ count: "50", q: nextQuery.trim() });
      const data = await getJson(`/api/messages?${params}`);
      setMessages(data.messages);
      const total = data.pagination?.total_count;
      setSummary(`${data.messages.length} shown${total ? ` from ${total} matching sent messages` : ""}`);
    } catch (error) {
      setSummary(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await fetch("/api/logout", { method: "POST" });
    setMe(null);
    setMessages([]);
    setSummary("Disconnected from Slack.");
  }

  async function syncSlack() {
    setSyncing(true);
    setSummary("Refreshing Slack chat into Supabase...");

    try {
      const result = await postJson("/api/sync-slack");
      setSummary(
        `Refresh complete: scanned ${result.scanned}, saved ${result.inserted}, skipped ${result.skipped}.`
      );
    } catch (error) {
      setSummary(error.message);
    } finally {
      setSyncing(false);
    }
  }

  function submitSearch(event) {
    event.preventDefault();
    loadMessages();
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Slack archive</p>
          <h1>Your sent messages</h1>
        </div>
        <div className="connection">{connectionLabel}</div>
      </section>

      <section className="controls">
        <form className="search-row" onSubmit={submitSearch}>
          <label htmlFor="query">Filter</label>
          <input
            id="query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="words, in:#channel, after:2026-01-01"
          />
          <button type="submit" disabled={!isConnected || busy}>
            Search
          </button>
        </form>
        <div className="toolbar">
          <a className="button" aria-disabled={!config?.configured} href="/api/slack/start">
            Connect Slack
          </a>
          <button type="button" disabled={!isConnected || busy} onClick={() => loadMessages()}>
            Refresh
          </button>
          <button type="button" disabled={!isConnected || busy || syncing} onClick={syncSlack}>
            Refresh Chat
          </button>
          <button type="button" disabled={!isConnected || busy} onClick={disconnect}>
            Disconnect
          </button>
        </div>
      </section>

      <section className="summary">{summary}</section>

      <section className="message-list">
        {messages.length === 0 ? (
          <div className="empty">Slack messages will appear here after you connect.</div>
        ) : (
          messages.map((message) => (
            <article className="message-card" key={`${message.channel.id}-${message.ts}`}>
              <div className="message-meta">
                <span className="channel">#{message.channel.name}</span>
                <time dateTime={message.datetime || ""}>{formatDate(message.datetime)}</time>
              </div>
              <p className="message-text">{message.text || "(empty message)"}</p>
              {message.permalink ? (
                <a className="permalink" href={message.permalink} target="_blank" rel="noreferrer">
                  Open in Slack
                </a>
              ) : null}
            </article>
          ))
        )}
      </section>
    </main>
  );
}

async function getJson(url, tolerateError = false) {
  const response = await fetch(url);
  if (!response.ok) {
    if (tolerateError) return null;
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || error.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

async function postJson(url) {
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || error.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
