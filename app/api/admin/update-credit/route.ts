import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const { phone, amount } = await req.json();

  const { data } = await supabaseServer
    .from("users")
    .select("credit_limit")
    .eq("phone", phone)
    .single();

  const newCredit = Math.max(0, (data?.credit_limit ?? 0) + amount);

  await supabaseServer
    .from("users")
    .update({ credit_limit: newCredit })
    .eq("phone", phone);

  return NextResponse.json({ ok: true });
}
