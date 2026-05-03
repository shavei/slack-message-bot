import { NextResponse } from "next/server";
import { getSlackBotConfig } from "@/lib/config";
import { triageIssue } from "@/lib/freeTriage";
import { listIssues, listUntriagedIssues, saveAITriage } from "@/lib/messageStore";

export async function POST() {
  const config = getSlackBotConfig();
  const issues = await listUntriagedIssues(config.slackChannelId, 50);
  let triaged = 0;
  const failures = [];

  for (const issue of issues) {
    try {
      const triage = triageIssue(issue);
      await saveAITriage(issue.id, triage);
      triaged += 1;
    } catch (error) {
      failures.push({ id: issue.id, error: error.message });
    }
  }

  const updated = await listIssues(config.slackChannelId);
  return NextResponse.json({
    scanned: issues.length,
    triaged,
    failures,
    issues: updated.map(formatIssue)
  });
}

function formatIssue(issue) {
  return {
    id: issue.id,
    messageId: issue.message_id,
    channelId: issue.channel_id,
    ts: issue.slack_ts,
    title: issue.title,
    description: issue.description,
    category: issue.category,
    severity: issue.severity,
    status: issue.status,
    suggestedFix: issue.suggested_fix,
    aiSummary: issue.ai_summary,
    reproductionSteps: issue.reproduction_steps || [],
    likelyArea: issue.likely_area,
    openQuestions: issue.open_questions || [],
    aiConfidence: Number(issue.ai_confidence || 0),
    triagedAt: issue.triaged_at,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at
  };
}