import { NextResponse } from "next/server";
import { getSlackBotConfig } from "@/lib/config";
import { listMessages } from "@/lib/messageStore";

export async function GET() {
  const config = getSlackBotConfig();
  const messages = await listMessages(config.slackChannelId);

  return NextResponse.json({
    messages: messages.map((message) => ({
      id: message.id,
      ts: message.slack_ts,
      text: message.text,
      datetime: message.sent_at,
      channel: { id: message.channel_id, name: message.channel_id },
      createdAt: message.created_at
    }))
  });
}