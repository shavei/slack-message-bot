# Slack Sent Message Reader

A Vercel-hosted Next.js website that connects to Slack through OAuth, stores the signed-in user's Slack token encrypted in Supabase, and searches messages sent by that Slack user.

## Slack setup

1. Create a Slack app at <https://api.slack.com/apps>.
2. In **OAuth & Permissions**, add the Vercel callback URL:

   ```text
   https://your-project.vercel.app/api/slack/callback
   ```

3. Add this **User Token Scope**:

   ```text
   search:read
   ```

4. Add the bot history scope for the channel type you want to sync, such as `channels:history` for a public channel.
5. Invite the bot to the channel you want to sync.
6. Keep the Slack **Client ID**, **Client Secret**, and **Bot User OAuth Token** for Vercel environment variables.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run `supabase/schema.sql`.
3. Copy your project URL and service role key.

The service role key is server-only. Do not expose it in browser code.

## Vercel setup

Add these environment variables in Vercel:

```text
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_REDIRECT_URI=https://your-project.vercel.app/api/slack/callback
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C1234567890
SLACK_TOKEN_ENCRYPTION_KEY=use-a-long-random-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Deploy the project to Vercel, open the site, then click **Connect Slack**.

## How it works

- Slack OAuth requests a user token with `search:read`.
- The callback encrypts the Slack user token before saving it in Supabase.
- The message API queries Slack `search.messages` with `from:<@yourUserId>`.
- The **Refresh Chat** button calls `/api/sync-slack`, which uses the server-only bot token to read `conversations.history` and save new messages in Supabase.
- The browser never receives the Slack token or Supabase service role key.
