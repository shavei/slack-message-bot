"use client";

import { useEffect, useMemo, useState } from "react";

export default function Home() {
  const [config, setConfig] = useState(null);
  const [me, setMe] = useState(null);
  const [messages, setMessages] = useState([]);
  const [issues, setIssues] = useState([]);
  const [summary, setSummary] = useState("Checking connection...");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState("issues");

  const isConnected = Boolean(me?.user?.id);
  const botReady = Boolean(config?.botConfigured);

  useEffect(() => {
    async function load() {
      const configData = await getJson("/api/config");
      setConfig(configData);

      if (configData.botConfigured) {
        await loadIssues();
      } else {
        setSummary(`Missing bot sync settings: ${configData.missingBot.join(", ")}`);
      }

      const meData = await getJson("/api/me", true);
      if (meData?.user) setMe(meData);
    }

    load().catch((error) => setSummary(error.message));
  }, []);

  const connectionLabel = useMemo(() => {
    if (!config) return "Checking";
    if (botReady && isConnected) return "Bot ready + user connected";
    if (botReady) return "Bug hub ready";
    return "Setup needed";
  }, [botReady, config, isConnected]);

  const stats = useMemo(() => {
    const open = issues.filter((issue) => issue.status !== "resolved").length;
    const high = issues.filter((issue) => ["critical", "high"].includes(issue.severity)).length;
    const categories = new Set(issues.map((issue) => issue.category)).size;
    return { open, high, categories };
  }, [issues]);

  async function loadIssues() {
    setBusy(true);
    setView("issues");
    setSummary("Loading issue hub...");

    try {
      const data = await getJson("/api/issues");
      setIssues(data.issues);
      setSummary(`${data.issues.length} issue candidates ready for triage.`);
    } catch (error) {
      setSummary(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadMessages() {
    setBusy(true);
    setView("chat");
    setSummary("Loading synced Slack chat...");

    try {
      const data = await getJson("/api/synced-messages");
      setMessages(data.messages);
      setSummary(`${data.messages.length} synced messages loaded.`);
    } catch (error) {
      setSummary(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadSentMessages(nextQuery = query) {
    setBusy(true);
    setView("search");
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
    setSummary("Disconnected from Slack user search.");
  }

  async function syncSlack() {
    setSyncing(true);
    setView("issues");
    setSummary("Syncing Slack and preparing issue candidates...");

    try {
      const result = await postJson("/api/sync-slack");
      const data = await getJson("/api/issues");
      setIssues(data.issues);
      setSummary(
        `Sync complete: ${result.inserted} new messages, ${result.issuesCreated} new issue candidates.`
      );
    } catch (error) {
      setSummary(error.message);
    } finally {
      setSyncing(false);
    }
  }

  function submitSearch(event) {
    event.preventDefault();
    loadSentMessages();
  }

  const visibleItems = view === "issues" ? issues : messages;

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Slack bug hub</p>
          <h1>{view === "issues" ? "Issue triage" : view === "chat" ? "Slack feed" : "Sent messages"}</h1>
        </div>
        <div className={`status-pill ${botReady ? "ready" : "warn"}`}>{connectionLabel}</div>
      </section>

      <section className="stats-row">
        <div><strong>{stats.open}</strong><span>Open candidates</span></div>
        <div><strong>{stats.high}</strong><span>High priority</span></div>
        <div><strong>{stats.categories}</strong><span>Categories</span></div>
      </section>

      <section className="controls">
        <form className="search-row" onSubmit={submitSearch}>
          <label htmlFor="query">Search</label>
          <input
            id="query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your own sent Slack messages"
          />
          <button type="submit" disabled={!isConnected || busy}>
            Search Mine
          </button>
        </form>
        <div className="toolbar">
          <button className="primary" type="button" disabled={!botReady || busy || syncing} onClick={syncSlack}>
            {syncing ? "Syncing..." : "Sync Bugs"}
          </button>
          <button type="button" disabled={!botReady || busy || syncing} onClick={loadIssues}>
            Issues
          </button>
          <button type="button" disabled={!botReady || busy || syncing} onClick={loadMessages}>
            Feed
          </button>
          <a className="button ghost" aria-disabled={!config?.configured} href="/api/slack/start">
            Connect User
          </a>
          <button type="button" disabled={!isConnected || busy} onClick={disconnect}>
            Disconnect
          </button>
        </div>
      </section>

      <section className="summary">
        <span>{summary}</span>
        <span className="count-badge">{visibleItems.length} shown</span>
      </section>

      {view === "issues" ? <IssueList issues={issues} /> : <MessageList messages={messages} view={view} />}
    </main>
  );
}

function IssueList({ issues }) {
  if (issues.length === 0) {
    return <div className="empty">Click Sync Bugs to turn Slack reports into issue candidates.</div>;
  }

  return (
    <section className="issue-list">
      {issues.map((issue) => (
        <article className="issue-card" key={issue.id}>
          <div className="issue-head">
            <div>
              <div className="issue-tags">
                <span className={`tag severity ${issue.severity}`}>{issue.severity}</span>
                <span className="tag">{issue.category}</span>
                <span className="tag muted">{issue.status}</span>
              </div>
              <h2>{issue.title}</h2>
            </div>
            <time dateTime={issue.createdAt || ""}>{formatDate(issue.createdAt)}</time>
          </div>
          <p className="issue-description">{issue.description}</p>
          <div className="fix-box">
            <span>Potential fix</span>
            <p>{issue.suggestedFix}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function MessageList({ messages, view }) {
  if (messages.length === 0) {
    return (
      <section className="message-list">
        <div className="empty">
          {view === "chat" ? "Click Sync Bugs to pull messages from Slack." : "Connect Slack user search to see your sent messages."}
        </div>
      </section>
    );
  }

  return (
    <section className="message-list">
      {messages.map((message) => (
        <article className="message-card" key={`${message.channel.id}-${message.ts}`}>
          <div className="message-meta">
            <span className="channel">{message.channel.name}</span>
            <time dateTime={message.datetime || ""}>{formatDate(message.datetime)}</time>
          </div>
          <p className="message-text">{message.text || "(empty message)"}</p>
          {message.permalink ? (
            <a className="permalink" href={message.permalink} target="_blank" rel="noreferrer">
              Open in Slack
            </a>
          ) : null}
        </article>
      ))}
    </section>
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