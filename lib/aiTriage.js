import { getOpenAIConfig } from "@/lib/config";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    category: { type: "string", enum: ["frontend", "backend", "database", "auth", "performance", "devops", "ux", "general"] },
    severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
    summary: { type: "string" },
    reproductionSteps: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
    likelyArea: { type: "string" },
    suggestedFix: { type: "string" },
    questions: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 4 },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  },
  required: ["title", "category", "severity", "summary", "reproductionSteps", "likelyArea", "suggestedFix", "questions", "confidence"]
};

export async function triageIssue(issue) {
  const { openaiApiKey, openaiModel } = getOpenAIConfig();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: openaiModel,
      messages: [
        {
          role: "system",
          content:
            "You triage bug reports from a Slack channel for a software project. Be practical, concise, and do not invent logs, files, or facts. If the report is vague, keep severity low and ask clarifying questions."
        },
        {
          role: "user",
          content: `Slack report:\n${issue.description}\n\nExisting heuristic category: ${issue.category}\nExisting heuristic severity: ${issue.severity}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "bug_triage",
          strict: true,
          schema
        }
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI triage failed");
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no triage content");
  return JSON.parse(content);
}