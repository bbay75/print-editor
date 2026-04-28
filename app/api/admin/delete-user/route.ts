import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const { phone } = await req.json();

  await supabaseServer.from("users").delete().eq("phone", phone);

  return NextResponse.json({ ok: true });
}
