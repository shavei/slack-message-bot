import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { normalizeSlackMessage, slackApi } from "@/lib/slack";

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const url = new URL(request.url);
  const page = clamp(url.searchParams.get("page"), 1, 100);
  const count = clamp(url.searchParams.get("count"), 50, 100);
  const extraQuery = url.searchParams.get("q")?.trim();
  const from = `from:<@${session.user.id}>`;
  const query = extraQuery ? `${from} ${extraQuery}` : from;

  const result = await slackApi("search.messages", session.userToken, {
    query,
    page: String(page),
    count: String(count),
    sort: "timestamp",
    sort_dir: "desc"
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "slack_error" }, { status: 502 });
  }

  return NextResponse.json({
    query,
    pagination: result.messages?.pagination || {},
    messages: (result.messages?.matches || []).map(normalizeSlackMessage)
  });
}

function clamp(value, fallback, max) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}
