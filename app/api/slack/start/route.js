import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config";
import { createOAuthState } from "@/lib/session";

export async function GET() {
  const config = getConfig();
  const state = await createOAuthState();
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", config.slackClientId);
  url.searchParams.set("user_scope", "search:read");
  url.searchParams.set("redirect_uri", config.slackRedirectUri);
  url.searchParams.set("state", state);
  redirect(url.toString());
}
