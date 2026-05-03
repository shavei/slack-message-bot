export function getConfig() {
  return {
    appUrl: required("NEXT_PUBLIC_APP_URL"),
    slackClientId: required("SLACK_CLIENT_ID"),
    slackClientSecret: required("SLACK_CLIENT_SECRET"),
    slackRedirectUri: required("SLACK_REDIRECT_URI"),
    slackTokenEncryptionKey: required("SLACK_TOKEN_ENCRYPTION_KEY"),
    ...getSlackBotConfig(),
    ...getSupabaseConfig()
  };
}

export function getSlackBotConfig() {
  return {
    slackBotToken: required("SLACK_BOT_TOKEN"),
    slackChannelId: required("SLACK_CHANNEL_ID")
  };
}

export function getSupabaseConfig() {
  return {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY")
  };
}

export function getPostgresUrl() {
  const rawUrl = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL || "";
  if (!rawUrl) return "";

  try {
    const url = new URL(rawUrl);
    const projectRef = getSupabaseProjectRef();
    const isSupabasePooler = url.hostname.includes("pooler.supabase.com");
    const usernameNeedsTenant = projectRef && isSupabasePooler && !decodeURIComponent(url.username).includes(".");

    if (usernameNeedsTenant) url.username = `${decodeURIComponent(url.username)}.${projectRef}`;
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function hasDatabaseConfig() {
  return Boolean(getPostgresUrl()) || Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getPublicConfigStatus() {
  const oauthKeys = [
    "NEXT_PUBLIC_APP_URL",
    "SLACK_CLIENT_ID",
    "SLACK_CLIENT_SECRET",
    "SLACK_REDIRECT_URI",
    "SLACK_TOKEN_ENCRYPTION_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY"
  ];
  const botKeys = ["SLACK_BOT_TOKEN", "SLACK_CHANNEL_ID"];
  const databaseKeys = hasDatabaseConfig() ? [] : ["POSTGRES_URL or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"];
  const allKeys = Array.from(new Set([...oauthKeys, ...botKeys]));

  return {
    configured: oauthKeys.every((key) => Boolean(process.env[key])),
    botConfigured: botKeys.every((key) => Boolean(process.env[key])) && databaseKeys.length === 0,
    aiConfigured: true,
    missing: [...allKeys.filter((key) => !process.env[key]), ...databaseKeys],
    missingOAuth: oauthKeys.filter((key) => !process.env[key]),
    missingBot: [...botKeys.filter((key) => !process.env[key]), ...databaseKeys],
    missingAI: []
  };
}

function getSupabaseProjectRef() {
  const explicitRef = process.env.SUPABASE_PROJECT_REF || process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF;
  if (explicitRef) return explicitRef;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}