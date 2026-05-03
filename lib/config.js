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
  return process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL || "";
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
  const databaseKeys = hasDatabaseConfig()
    ? []
    : ["POSTGRES_URL or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"];
  const allKeys = Array.from(new Set([...oauthKeys, ...botKeys]));

  return {
    configured: oauthKeys.every((key) => Boolean(process.env[key])),
    botConfigured: botKeys.every((key) => Boolean(process.env[key])) && databaseKeys.length === 0,
    missing: [...allKeys.filter((key) => !process.env[key]), ...databaseKeys],
    missingOAuth: oauthKeys.filter((key) => !process.env[key]),
    missingBot: [...botKeys.filter((key) => !process.env[key]), ...databaseKeys]
  };
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}