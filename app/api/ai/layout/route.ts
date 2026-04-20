import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { count } = await req.json();
    return NextResponse.json({
      mode: "demo",
      summary: `Suggested a clean vertical stack layout for ${count ?? 0} layers.`
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate layout suggestion" }, { status: 500 });
  }
}
