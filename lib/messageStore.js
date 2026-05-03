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
  ensured = true;
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
    const rows = await sql`
      select id, channel_id, slack_ts, text, sent_at, created_at
      from public.messages
      where channel_id = ${channelId}
      order by sent_at desc
      limit 100
    `;
    return rows;
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

export async function checkDatabase() {
  await ensureMessagesTable();
  const sql = getSqlClient();
  if (sql) await sql`select 1`;
  return { ok: true, mode: sql ? "postgres" : "supabase" };
}

function getSqlClient() {
  const url = getPostgresUrl();
  if (!url) return null;

  if (!sqlClient) {
    sqlClient = postgres(url, {
      ssl: "require",
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false
    });
  }

  return sqlClient;
}