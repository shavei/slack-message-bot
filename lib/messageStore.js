import postgres from "postgres";
import { getPostgresUrl } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

let sqlClient;
let ensured = false;

export async function ensureMessagesTable() {
  const sql = getSqlClient();
  if (!sql) return;
  if (ensured) return;

  await sql`
    create table if not exists public.messages (
      id uuid primary key default gen_random_uuid(),
      channel_id text not null,
      slack_ts text not null,
      text text not null default '',
      sent_at timestamptz not null,
      created_at timestamptz not null default now(),
      unique (channel_id, slack_ts)
    )
  `;
  await sql`create index if not exists messages_sent_at_idx on public.messages (sent_at desc)`;
  await sql`create index if not exists messages_channel_id_idx on public.messages (channel_id)`;
  await ensureIssuesTable(sql);
  ensured = true;
}

async function ensureIssuesTable(sql = getSqlClient()) {
  if (!sql) return;

  await sql`
    create table if not exists public.issues (
      id uuid primary key default gen_random_uuid(),
      message_id uuid not null references public.messages(id) on delete cascade,
      channel_id text not null,
      slack_ts text not null,
      title text not null,
      description text not null default '',
      category text not null default 'general',
      severity text not null default 'medium',
      status text not null default 'new',
      suggested_fix text not null default '',
      source text not null default 'slack',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (channel_id, slack_ts)
    )
  `;
  await sql`alter table public.issues add column if not exists ai_summary text not null default ''`;
  await sql`alter table public.issues add column if not exists reproduction_steps jsonb not null default '[]'::jsonb`;
  await sql`alter table public.issues add column if not exists likely_area text not null default ''`;
  await sql`alter table public.issues add column if not exists open_questions jsonb not null default '[]'::jsonb`;
  await sql`alter table public.issues add column if not exists ai_confidence numeric not null default 0`;
  await sql`alter table public.issues add column if not exists triaged_at timestamptz`;
  await sql`create index if not exists issues_status_idx on public.issues (status)`;
  await sql`create index if not exists issues_category_idx on public.issues (category)`;
  await sql`create index if not exists issues_created_at_idx on public.issues (created_at desc)`;
}

export async function findExistingTimestamps(channelId, timestamps) {
  if (timestamps.length === 0) return new Set();

  const sql = getSqlClient();
  if (sql) {
    await ensureMessagesTable();
    const rows = await sql`
      select slack_ts
      from public.messages
      where channel_id = ${channelId}
      and slack_ts in ${sql(timestamps)}
    `;
    return new Set(rows.map((row) => row.slack_ts));
  }

  const { data, error } = await supabaseAdmin()
    .from("messages")
    .select("slack_ts")
    .eq("channel_id", channelId)
    .in("slack_ts", timestamps);

  if (error) throw new Error(error.message);
  return new Set((data || []).map((row) => row.slack_ts));
}

export async function insertMessages(messages) {
  if (messages.length === 0) return;

  const sql = getSqlClient();
  if (sql) {
    await ensureMessagesTable();
    await sql`
      insert into public.messages ${sql(messages, "channel_id", "slack_ts", "text", "sent_at")}
      on conflict (channel_id, slack_ts) do nothing
    `;
    return;
  }

  const { error } = await supabaseAdmin().from("messages").insert(messages);
  if (error) throw new Error(error.message);
}

export async function listMessages(channelId) {
  const sql = getSqlClient();
  if (sql) {
    await ensureMessagesTable();
    return sql`
      select id, channel_id, slack_ts, text, sent_at, created_at
      from public.messages
      where channel_id = ${channelId}
      order by sent_at desc
      limit 100
    `;
  }

  const { data, error } = await supabaseAdmin()
    .from("messages")
    .select("id, channel_id, slack_ts, text, sent_at, created_at")
    .eq("channel_id", channelId)
    .order("sent_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function refreshIssueCandidates(channelId) {
  const sql = getSqlClient();
  if (!sql) return { created: 0, total: 0 };

  await ensureMessagesTable();
  const messages = await sql`
    select id, channel_id, slack_ts, text, sent_at
    from public.messages
    where channel_id = ${channelId}
    and length(trim(text)) > 0
    and text not ilike '%has joined the channel%'
    order by sent_at desc
    limit 200
  `;

  let created = 0;
  for (const message of messages) {
    const issue = classifyIssue(message.text);
    const result = await sql`
      insert into public.issues ${sql(
        [{
          message_id: message.id,
          channel_id: message.channel_id,
          slack_ts: message.slack_ts,
          title: issue.title,
          description: message.text,
          category: issue.category,
          severity: issue.severity,
          status: 'new',
          suggested_fix: issue.suggestedFix,
          source: 'slack'
        }],
        "message_id", "channel_id", "slack_ts", "title", "description", "category", "severity", "status", "suggested_fix", "source"
      )}
      on conflict (channel_id, slack_ts) do nothing
      returning id
    `;
    created += result.length;
  }

  const count = await sql`select count(*)::int as total from public.issues where channel_id = ${channelId}`;
  return { created, total: count[0]?.total || 0 };
}

export async function listIssues(channelId) {
  const sql = getSqlClient();
  if (!sql) return [];

  await ensureMessagesTable();
  await refreshIssueCandidates(channelId);

  return sql`
    select id, message_id, channel_id, slack_ts, title, description, category, severity, status, suggested_fix,
      ai_summary, reproduction_steps, likely_area, open_questions, ai_confidence, triaged_at, created_at, updated_at
    from public.issues
    where channel_id = ${channelId}
    order by
      case severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
      created_at desc
    limit 100
  `;
}

export async function listUntriagedIssues(channelId, limit = 10) {
  const sql = getSqlClient();
  if (!sql) return [];

  await ensureMessagesTable();
  await refreshIssueCandidates(channelId);

  return sql`
    select id, title, description, category, severity, suggested_fix
    from public.issues
    where channel_id = ${channelId}
    and triaged_at is null
    order by created_at desc
    limit ${limit}
  `;
}

export async function saveAITriage(issueId, triage) {
  const sql = getSqlClient();
  if (!sql) return;

  await ensureMessagesTable();
  await sql`
    update public.issues
    set title = ${triage.title},
      category = ${triage.category},
      severity = ${triage.severity},
      ai_summary = ${triage.summary},
      reproduction_steps = ${sql.json(triage.reproductionSteps)},
      likely_area = ${triage.likelyArea},
      suggested_fix = ${triage.suggestedFix},
      open_questions = ${sql.json(triage.questions)},
      ai_confidence = ${triage.confidence},
      triaged_at = now(),
      updated_at = now()
    where id = ${issueId}
  `;
}

export async function checkDatabase() {
  await ensureMessagesTable();
  const sql = getSqlClient();
  if (sql) await sql`select 1`;
  return { ok: true, mode: sql ? "postgres" : "supabase" };
}

function classifyIssue(text) {
  const normalized = text.toLowerCase();
  const title = makeTitle(text);
  const category = pickCategory(normalized);
  const severity = pickSeverity(normalized);
  return { title, category, severity, suggestedFix: suggestFix(category, severity) };
}

function makeTitle(text) {
  const cleaned = text.replace(/<@[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Untitled issue";
  return cleaned.length > 82 ? `${cleaned.slice(0, 79)}...` : cleaned;
}

function pickCategory(text) {
  if (matches(text, ["login", "auth", "password", "permission", "token", "session"])) return "auth";
  if (matches(text, ["database", "db", "supabase", "query", "sql", "migration", "record"])) return "database";
  if (matches(text, ["api", "endpoint", "request", "response", "server", "500", "404"])) return "backend";
  if (matches(text, ["button", "screen", "ui", "page", "mobile", "layout", "css", "style"])) return "frontend";
  if (matches(text, ["slow", "lag", "timeout", "performance", "loading", "hang"])) return "performance";
  return "general";
}

function pickSeverity(text) {
  if (matches(text, ["production down", "down", "data loss", "security", "blocked", "critical"])) return "critical";
  if (matches(text, ["crash", "broken", "cannot", "can't", "failed", "error", "urgent"])) return "high";
  if (matches(text, ["bug", "issue", "wrong", "missing", "not working"])) return "medium";
  return "low";
}

function suggestFix(category, severity) {
  const prefix = severity === "critical" ? "Treat as urgent: reproduce, isolate blast radius, and ship the smallest rollback or hotfix. " : "Start by reproducing the report and capturing expected vs actual behavior. ";
  const suggestions = {
    auth: "Check auth scopes, session expiry, redirect URLs, and permission checks around the failing action.",
    database: "Inspect the query, table permissions, migrations, and recent schema changes before changing app code.",
    backend: "Check server logs, request payloads, response status codes, and validation paths for this endpoint.",
    frontend: "Reproduce on desktop and mobile, then inspect component state, disabled states, layout constraints, and console errors.",
    performance: "Measure the slow step first, then look for repeated requests, unbounded queries, or expensive rendering.",
    general: "Clarify reproduction steps, affected users, expected behavior, actual behavior, and screenshots or logs."
  };
  return `${prefix}${suggestions[category]}`;
}

function matches(text, terms) {
  return terms.some((term) => text.includes(term));
}

function getSqlClient() {
  const url = getPostgresUrl();
  if (!url) return null;

  if (!sqlClient) {
    sqlClient = postgres(url, { ssl: "require", max: 1, idle_timeout: 20, connect_timeout: 10, prepare: false });
  }

  return sqlClient;
}