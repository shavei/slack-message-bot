import { NextResponse } from "next/server";
import { getSlackBotConfig } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const config = getSlackBotConfig();
  const { data, error } = await supabaseAdmin()
    .from("messages")
    .select("id, channel_id, slack_ts, text, sent_at, created_at")
    .eq("channel_id", config.slackChannelId)
    .order("sent_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    messages: (data || []).map((message) => ({
      id: message.id,
      ts: message.slack_ts,
      text: message.text,
      datetime: message.sent_at,
      channel: { id: message.channel_id, name: message.channel_id },
      createdAt: message.created_at
    }))
  });
}