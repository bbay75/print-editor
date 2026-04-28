import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ ok: false, error: "missing phone" });
    }

    const cleanPhone = String(phone).trim();

    const { data, error } = await supabaseServer
      .from("users")
      .select("credit_limit, used_count, is_unlimited")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ ok: false, error: "user not found" });
    }

    if (data.is_unlimited === true) {
      return NextResponse.json({ ok: true, is_unlimited: true });
    }

    const used = data.used_count ?? 0;
    const limit = data.credit_limit ?? 3;

    if (used >= limit) {
      return NextResponse.json({
        ok: false,
        error: "no credits",
        used,
        limit,
        remaining: 0,
      });
    }

    const nextUsed = used + 1;
    const remaining = Math.max(0, limit - nextUsed);

    const { error: updateError } = await supabaseServer
      .from("users")
      .update({
        used_count: nextUsed,
      })
      .eq("phone", cleanPhone);

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      used: nextUsed,
      limit,
      remaining,
    });
  } catch (err) {
    console.error("USE CREDIT ERROR:", err);
    return NextResponse.json({ ok: false, error: "server error" });
  }
}
