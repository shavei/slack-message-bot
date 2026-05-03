import { NextResponse } from "next/server";
import { getSlackBotConfig } from "@/lib/config";
import { listIssues, refreshIssueCandidates } from "@/lib/messageStore";

export async function GET() {
  const config = getSlackBotConfig();
  const issues = await listIssues(config.slackChannelId);
  return NextResponse.json({ issues: issues.map(formatIssue) });
}

export async function POST() {
  const config = getSlackBotConfig();
  const result = await refreshIssueCandidates(config.slackChannelId);
  const issues = await listIssues(config.slackChannelId);
  return NextResponse.json({ ...result, issues: issues.map(formatIssue) });
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