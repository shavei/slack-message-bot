import { NextResponse } from "next/server";
import { getPublicConfigStatus } from "@/lib/config";

export function GET() {
  return NextResponse.json({
    ...getPublicConfigStatus(),
    scopes: ["search:read"]
  });
}
