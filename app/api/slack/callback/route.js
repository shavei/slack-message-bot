import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import { getConfig } from "@/lib/config";
import { createSession, consumeOAuthState } from "@/lib/session";
import { slackApi } from "@/lib/slack";

export async function GET(request) {
  const config = getConfig();
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) return oauthError(`Slack returned ${error}`);
  if (!code || !state) return oauthError("Slack did not return a code and state.");

  const validState = await consumeOAuthState(state);
  if (!validState) return oauthError("OAuth state did not match or expired.");

  const tokenResponse = await slackApi("oauth.v2.access", null, {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: config.slackClientId,
      client_secret: config.slackClientSecret,
      redirect_uri: config.slackRedirectUri
    })
  });

  if (!tokenResponse.ok || !tokenResponse.authed_user?.access_token) {
    return oauthError(tokenResponse.error || "Slack did not return a user token.");
  }

  const userToken = tokenResponse.authed_user.access_token;
  const identity = await slackApi("auth.test", userToken);
  const slackUserId = identity.user_id || tokenResponse.authed_user.id;

  if (!slackUserId) return oauthError(identity.error || "Could not identify the Slack user.");

  await createSession({
    encryptedSlackUserToken: encrypt(userToken),
    slackUserId,
    slackUserName: identity.user || slackUserId,
    slackTeamId: tokenResponse.team?.id || identity.team_id,
    slackTeamName: tokenResponse.team?.name || identity.team
  });

  redirect("/");
}

function oauthError(message) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Slack connection failed</title><body style="font-family: system-ui; margin: 3rem;"><h1>Could not connect Slack</h1><p>${escapeHtml(message)}</p><p><a href="/">Back to the app</a></p></body>`,
    {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    }
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}
