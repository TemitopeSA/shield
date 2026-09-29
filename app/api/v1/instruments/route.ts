import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";

export async function GET(req: NextRequest) {
  return handle(req, (s) => s.instruments);
}
