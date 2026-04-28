import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const { phone } = await req.json();

  const { data } = await supabaseServer
    .from("users")
    .select("is_unlimited")
    .eq("phone", phone)
    .single();

  await supabaseServer
    .from("users")
    .update({
      is_unlimited: !data?.is_unlimited,
    })
    .eq("phone", phone);

  return NextResponse.json({ ok: true });
}
