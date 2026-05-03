export function getConfig() {
  return {
    appUrl: required("NEXT_PUBLIC_APP_URL"),
    slackClientId: required("SLACK_CLIENT_ID"),
    slackClientSecret: required("SLACK_CLIENT_SECRET"),
    slackRedirectUri: required("SLACK_REDIRECT_URI"),
    slackBotToken: required("SLACK_BOT_TOKEN"),
    slackChannelId: required("SLACK_CHANNEL_ID"),
    slackTokenEncryptionKey: required("SLACK_TOKEN_ENCRYPTION_KEY"),
    supabaseUrl: required("SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY")
  };
}

export function getPublicConfigStatus() {
  const keys = [
    "NEXT_PUBLIC_APP_URL",
    "SLACK_CLIENT_ID",
    "SLACK_CLIENT_SECRET",
    "SLACK_REDIRECT_URI",
    "SLACK_BOT_TOKEN",
    "SLACK_CHANNEL_ID",
    "SLACK_TOKEN_ENCRYPTION_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY"
  ];

  return {
    configured: keys.every((key) => Boolean(process.env[key])),
    missing: keys.filter((key) => !process.env[key])
  };
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
