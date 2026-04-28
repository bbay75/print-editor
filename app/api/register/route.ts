import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

const DEFAULT_CREDITS = 3;

export async function POST(req: Request) {
  try {
    const { name, phone } = await req.json();

    if (!name || !phone) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    const cleanPhone = String(phone).trim();

    const { data: existing, error: selectError } = await supabaseServer
      .from("users")
      .select("id, ai_credits")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existing) {
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        ai_credits: existing.ai_credits ?? 0,
      });
    }

    const { data: inserted, error: insertError } = await supabaseServer
      .from("users")
      .insert({
        name: String(name).trim(),
        phone: cleanPhone,
        ai_credits: DEFAULT_CREDITS,
      })
      .select("id, ai_credits")
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      ok: true,
      alreadyExists: false,
      ai_credits: inserted.ai_credits ?? DEFAULT_CREDITS,
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
