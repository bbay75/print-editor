import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const { phone } = await req.json();

  const { data } = await supabaseServer
    .from("users")
    .select("credit_limit")
    .eq("phone", phone)
    .single();

  await supabaseServer
    .from("users")
    .update({
      credit_limit: (data?.credit_limit ?? 0) + 3,
    })
    .eq("phone", phone);

  return NextResponse.json({ ok: true });
}
