import { NextResponse } from "next/server";
import { getSlackBotConfig } from "@/lib/config";
import { findExistingTimestamps, insertMessages, refreshIssueCandidates } from "@/lib/messageStore";
import { slackApi } from "@/lib/slack";

export async function POST() {
  const config = getSlackBotConfig();
  const result = await slackApi("conversations.history", config.slackBotToken, {
    method: "POST",
    body: new URLSearchParams({
      channel: config.slackChannelId,
      limit: "50"
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

  await insertMessages(newMessages);
  const issues = await refreshIssueCandidates(config.slackChannelId);

  return NextResponse.json({
    scanned: messages.length,
    inserted: newMessages.length,
    skipped: messages.length - newMessages.length,
    issuesCreated: issues.created,
    issuesTotal: issues.total,
    hasMore: Boolean(result.has_more),
    nextCursor: result.response_metadata?.next_cursor || null
  });
}

function slackTimestampToIso(ts) {
  return new Date(Number(ts.split(".")[0]) * 1000).toISOString();
}