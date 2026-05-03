import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  return NextResponse.json({
    user: session.user,
    team: session.team,
    createdAt: session.createdAt
  });
}
