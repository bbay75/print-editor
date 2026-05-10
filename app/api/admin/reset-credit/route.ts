import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const { phone } = await req.json();

  await supabaseServer
    .from("users")
    .update({
      used_count: 0,
      credit_limit: 0,
    })
    .eq("phone", phone);

  return NextResponse.json({ ok: true });
}
