import { NextResponse } from "next/server";
import { getSlackBotConfig } from "@/lib/config";
import { checkDatabase } from "@/lib/messageStore";
import { slackApi } from "@/lib/slack";

export async function GET() {
  let config;

  try {
    config = getSlackBotConfig();
  } catch (error) {
    return NextResponse.json({
      ok: false,
      checks: {
        environment: { ok: false, error: error.message },
        database: { ok: false },
        slackAuth: { ok: false },
        channelHistory: { ok: false }
      }
    });
  }

  let database;
  try {
    database = await checkDatabase();
  } catch (error) {
    database = { ok: false, error: error.message };
  }

  const auth = await slackApi("auth.test", config.slackBotToken);
  if (!auth.ok) {
    return NextResponse.json({
      ok: false,
      checks: {
        environment: { ok: true },
        database,
        slackAuth: { ok: false, error: auth.error || "slack_auth_failed" },
        channelHistory: { ok: false }
      }
    });
  }

  const history = await slackApi("conversations.history", config.slackBotToken, {
    method: "POST",
    body: new URLSearchParams({
      channel: config.slackChannelId,
      limit: "1"
    })
  });

  return NextResponse.json({
    ok: Boolean(database.ok && history.ok),
    checks: {
      environment: { ok: true },
      database,
      slackAuth: {
        ok: true,
        team: auth.team,
        botId: auth.bot_id || null,
        userId: auth.user_id || null
      },
      channelHistory: {
        ok: Boolean(history.ok),
        channelId: config.slackChannelId,
        error: history.ok ? null : history.error || "history_failed",
        messageCountChecked: history.ok ? (history.messages || []).length : 0
      }
    }
  });
}