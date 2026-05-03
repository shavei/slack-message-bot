"use client";

import { useEffect, useMemo, useState } from "react";

const categoryLabels = {
  auth: "התחברות",
  database: "דאטה",
  backend: "שרת",
  frontend: "ממשק",
  performance: "ביצועים",
  devops: "דיפלוי",
  general: "כללי"
};

const severityLabels = {
  critical: "קריטי",
  high: "גבוה",
  medium: "בינוני",
  low: "נמוך"
};

export default function Home() {
  const [config, setConfig] = useState(null);
  const [me, setMe] = useState(null);
  const [messages, setMessages] = useState([]);
  const [issues, setIssues] = useState([]);
  const [summary, setSummary] = useState("בודק חיבור...");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [triaging, setTriaging] = useState(false);
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
        setSummary(`חסרות הגדרות: ${configData.missingBot.join(", ")}`);
      }

      const meData = await getJson("/api/me", true);
      if (meData?.user) setMe(meData);
    }

    load().catch((error) => setSummary(error.message));
  }, []);

  const connectionLabel = botReady ? "המערכת מחוברת" : "צריך להשלים הגדרות";

  const stats = useMemo(() => {
    const open = issues.filter((issue) => issue.status !== "resolved").length;
    const high = issues.filter((issue) => ["critical", "high"].includes(issue.severity)).length;
    const triaged = issues.filter((issue) => issue.triagedAt).length;
    return { open, high, triaged };
  }, [issues]);

  async function loadIssues() {
    setBusy(true);
    setView("issues");
    setSummary("טוען מרכז באגים...");

    try {
      const data = await getJson("/api/issues");
      setIssues(data.issues);
      setSummary(`${data.issues.length} דיווחים מוכנים למיון.`);
    } catch (error) {
      setSummary(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadMessages() {
    setBusy(true);
    setView("chat");
    setSummary("טוען הודעות מסלאק...");

    try {
      const data = await getJson("/api/synced-messages");
      setMessages(data.messages);
      setSummary(`${data.messages.length} הודעות מסונכרנות.`);
    } catch (error) {
      setSummary(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadSentMessages(nextQuery = query) {
    setBusy(true);
    setView("search");
    setSummary("מחפש הודעות ששלחת...");
    setMessages([]);

    try {
      const params = new URLSearchParams({ count: "50", q: nextQuery.trim() });
      const data = await getJson(`/api/messages?${params}`);
      setMessages(data.messages);
      setSummary(`${data.messages.length} הודעות נמצאו.`);
    } catch (error) {
      setSummary(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await fetch("/api/logout", { method: "POST" });
    setMe(null);
    setSummary("החיבור לחיפוש אישי נותק.");
  }

  async function syncSlack() {
    setSyncing(true);
    setView("issues");
    setSummary("מסנכרן הודעות מסלאק ומכין דיווחים...");

    try {
      const result = await postJson("/api/sync-slack");
      const data = await getJson("/api/issues");
      setIssues(data.issues);
      setSummary(`סנכרון הושלם: ${result.inserted} הודעות חדשות, ${result.issuesCreated} דיווחים חדשים.`);
    } catch (error) {
      setSummary(error.message);
    } finally {
      setSyncing(false);
    }
  }

  async function runTriage() {
    setTriaging(true);
    setView("issues");
    setSummary("ממיין דיווחים בעזרת מנוע חינמי מקומי...");

    try {
      const result = await postJson("/api/ai-triage");
      setIssues(result.issues);
      setSummary(`מיון הושלם: ${result.triaged} מתוך ${result.scanned} דיווחים עודכנו.`);
    } catch (error) {
      setSummary(error.message);
    } finally {
      setTriaging(false);
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
          <p className="eyebrow">מרכז באגים מסלאק</p>
          <h1>{view === "issues" ? "מיון דיווחים" : view === "chat" ? "פיד סלאק" : "הודעות אישיות"}</h1>
        </div>
        <div className={`status-pill ${botReady ? "ready" : "warn"}`}>{connectionLabel}</div>
      </section>

      <section className="stats-row">
        <div><strong>{stats.open}</strong><span>דיווחים פתוחים</span></div>
        <div><strong>{stats.high}</strong><span>עדיפות גבוהה</span></div>
        <div><strong>{stats.triaged}</strong><span>מוינו</span></div>
      </section>

      <section className="controls">
        <form className="search-row" onSubmit={submitSearch}>
          <label htmlFor="query">חיפוש</label>
          <input id="query" dir="auto" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש בהודעות האישיות שלך" />
          <button type="submit" disabled={!isConnected || busy}>חפש שלי</button>
        </form>
        <div className="toolbar">
          <button className="primary" type="button" disabled={!botReady || busy || syncing || triaging} onClick={syncSlack}>{syncing ? "מסנכרן..." : "סנכרן באגים"}</button>
          <button className="ai" type="button" disabled={!botReady || busy || syncing || triaging} onClick={runTriage}>{triaging ? "ממיין..." : "מיון חינמי"}</button>
          <button type="button" disabled={!botReady || busy || syncing || triaging} onClick={loadIssues}>דיווחים</button>
          <button type="button" disabled={!botReady || busy || syncing || triaging} onClick={loadMessages}>פיד</button>
          <a className="button ghost" aria-disabled={!config?.configured} href="/api/slack/start">חבר משתמש</a>
          <button type="button" disabled={!isConnected || busy} onClick={disconnect}>נתק</button>
        </div>
      </section>

      <section className="summary">
        <span>{summary}</span>
        <span className="count-badge">{visibleItems.length} מוצגים</span>
      </section>

      {view === "issues" ? <IssueList issues={issues} /> : <MessageList messages={messages} view={view} />}
    </main>
  );
}

function IssueList({ issues }) {
  if (issues.length === 0) return <div className="empty">לחץ על סנכרן באגים כדי להפוך הודעות מסלאק לדיווחים.</div>;

  return (
    <section className="issue-list">
      {issues.map((issue) => (
        <article className="issue-card" key={issue.id}>
          <div className="issue-head">
            <div>
              <div className="issue-tags">
                <span className={`tag severity ${issue.severity}`}>{severityLabels[issue.severity] || issue.severity}</span>
                <span className="tag">{categoryLabels[issue.category] || issue.category}</span>
                <span className="tag muted">{issue.triagedAt ? "מוין" : "חדש"}</span>
              </div>
              <h2 dir="auto">{issue.title}</h2>
            </div>
            <time dateTime={issue.createdAt || ""}>{formatDate(issue.createdAt)}</time>
          </div>
          <p className="issue-description" dir="auto">{issue.aiSummary || issue.description}</p>
          <div className="issue-grid">
            <InfoBlock label="אזור סביר" value={issue.likelyArea || "צריך עוד מידע"} />
            <InfoBlock label="ביטחון" value={issue.triagedAt ? `${Math.round((issue.aiConfidence || 0) * 100)}%` : "עדיין לא מוין"} />
          </div>
          {issue.reproductionSteps?.length ? <ListBox title="צעדי שחזור" items={issue.reproductionSteps} ordered /> : null}
          <div className="fix-box"><span>כיוון תיקון</span><p dir="auto">{issue.suggestedFix}</p></div>
          {issue.openQuestions?.length ? <ListBox title="שאלות פתוחות" items={issue.openQuestions} /> : null}
        </article>
      ))}
    </section>
  );
}

function ListBox({ title, items, ordered = false }) {
  const Tag = ordered ? "ol" : "ul";
  return <div className="questions"><span>{title}</span><Tag>{items.map((item, index) => <li dir="auto" key={`${title}-${index}`}>{item}</li>)}</Tag></div>;
}

function InfoBlock({ label, value }) {
  return <div className="info-block"><span>{label}</span><strong dir="auto">{value}</strong></div>;
}

function MessageList({ messages, view }) {
  if (messages.length === 0) {
    return <section className="message-list"><div className="empty">{view === "chat" ? "לחץ על סנכרן באגים כדי למשוך הודעות מסלאק." : "חבר חיפוש משתמש כדי לראות הודעות אישיות."}</div></section>;
  }

  return (
    <section className="message-list">
      {messages.map((message) => (
        <article className="message-card" key={`${message.channel.id}-${message.ts}`}>
          <div className="message-meta"><span className="channel">{message.channel.name}</span><time dateTime={message.datetime || ""}>{formatDate(message.datetime)}</time></div>
          <p className="message-text" dir="auto">{message.text || "(הודעה ריקה)"}</p>
          {message.permalink ? <a className="permalink" href={message.permalink} target="_blank" rel="noreferrer">פתח בסלאק</a> : null}
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
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}