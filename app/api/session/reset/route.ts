import { NextResponse, type NextRequest } from "next/server";
import { sessionId } from "@/lib/server/http";
import { freshState, setSession } from "@/lib/server/store";

export async function POST(req: NextRequest) {
  const state = freshState();
  setSession(sessionId(req), state);
  return NextResponse.json(state);
}
