import { cookies } from "next/headers";
import { decrypt, hashSecret, randomSecret } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const sessionCookie = "slack_reader_session";
const stateCookie = "slack_reader_state";

export async function createOAuthState() {
  const state = randomSecret(24);
  const stateHash = hashSecret(state);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin().from("oauth_states").insert({
    state_hash: stateHash,
    expires_at: expiresAt
  });

  if (error) throw new Error(error.message);

  const jar = await cookies();
  jar.set(stateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 10 * 60
  });

  return state;
}

export async function consumeOAuthState(returnedState) {
  const jar = await cookies();
  const cookieState = jar.get(stateCookie)?.value;
  jar.delete(stateCookie);

  if (!cookieState || cookieState !== returnedState) return false;

  const stateHash = hashSecret(returnedState);
  const { data, error } = await supabaseAdmin()
    .from("oauth_states")
    .delete()
    .eq("state_hash", stateHash)
    .gt("expires_at", new Date().toISOString())
    .select("state_hash")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function createSession(session) {
  const sessionToken = randomSecret(32);
  const sessionHash = hashSecret(sessionToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin().from("sessions").insert({
    session_hash: sessionHash,
    encrypted_slack_user_token: session.encryptedSlackUserToken,
    slack_user_id: session.slackUserId,
    slack_user_name: session.slackUserName,
    slack_team_id: session.slackTeamId,
    slack_team_name: session.slackTeamName,
    expires_at: expiresAt
  });

  if (error) throw new Error(error.message);

  const jar = await cookies();
  jar.set(sessionCookie, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 30 * 24 * 60 * 60
  });
}

export async function getSession() {
  const jar = await cookies();
  const sessionToken = jar.get(sessionCookie)?.value;
  if (!sessionToken) return null;

  const { data, error } = await supabaseAdmin()
    .from("sessions")
    .select("*")
    .eq("session_hash", hashSecret(sessionToken))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    userToken: decrypt(data.encrypted_slack_user_token),
    user: {
      id: data.slack_user_id,
      name: data.slack_user_name
    },
    team: {
      id: data.slack_team_id,
      name: data.slack_team_name
    },
    createdAt: data.created_at
  };
}

export async function clearSession() {
  const jar = await cookies();
  const sessionToken = jar.get(sessionCookie)?.value;
  jar.delete(sessionCookie);

  if (!sessionToken) return;

  const { error } = await supabaseAdmin()
    .from("sessions")
    .delete()
    .eq("session_hash", hashSecret(sessionToken));

  if (error) throw new Error(error.message);
}
