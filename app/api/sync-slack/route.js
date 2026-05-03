import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getSession } from "@/lib/session";
import { slackApi } from "@/lib/slack";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const config = getConfig();
  const result = await slackApi("conversations.history", config.slackBotToken, {
    method: "POST",
    body: new URLSearchParams({
      channel: config.slackChannelId,
      limit: "15"
    })
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "slack_error" }, { status: 502 });
  }

  const messages = result.messages || [];
  const timestamps = messages.map((message) => message.ts).filter(Boolean);
  const existingTimestamps = await findExistingTimestamps(config.slackChannelId, timestamps);
  const newMessages = messages
    .filter((message) => message.ts && !existingTimestamps.has(message.ts))
    .map((message) => ({
      channel_id: config.slackChannelId,
      slack_ts: message.ts,
      text: message.text || "",
      sent_at: slackTimestampToIso(message.ts)
    }));

  if (newMessages.length > 0) {
    const { error } = await supabaseAdmin().from("messages").insert(newMessages);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    scanned: messages.length,
    inserted: newMessages.length,
    skipped: messages.length - newMessages.length,
    hasMore: Boolean(result.has_more),
    nextCursor: result.response_metadata?.next_cursor || null
  });
}

async function findExistingTimestamps(channelId, timestamps) {
  if (timestamps.length === 0) return new Set();

  const { data, error } = await supabaseAdmin()
    .from("messages")
    .select("slack_ts")
    .eq("channel_id", channelId)
    .in("slack_ts", timestamps);

  if (error) throw new Error(error.message);
  return new Set((data || []).map((row) => row.slack_ts));
}

function slackTimestampToIso(ts) {
  return new Date(Number(ts.split(".")[0]) * 1000).toISOString();
}
