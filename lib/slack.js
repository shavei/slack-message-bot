export async function slackApi(method, token, params = {}) {
  const init = params.method ? params : { method: "GET" };
  const headers = { Accept: "application/json" };
  let url = `https://slack.com/api/${method}`;

  if (token) headers.Authorization = `Bearer ${token}`;

  if (init.method === "POST") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else {
    const search = new URLSearchParams(params);
    if (String(search)) url += `?${search}`;
  }

  const response = await fetch(url, {
    method: init.method,
    headers,
    body: init.body,
    cache: "no-store"
  });

  return response.json();
}

export function normalizeSlackMessage(message) {
  return {
    ts: message.ts,
    text: (message.text || "").replace(/[\uE000\uE001]/g, ""),
    channel: {
      id: message.channel?.id,
      name: message.channel?.name || message.channel?.id || "unknown",
      type: message.type
    },
    permalink: message.permalink,
    username: message.username,
    user: message.user,
    datetime: timestampToIso(message.ts)
  };
}

function timestampToIso(ts) {
  if (!ts) return null;
  return new Date(Number(ts.split(".")[0]) * 1000).toISOString();
}
