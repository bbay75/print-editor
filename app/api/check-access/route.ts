import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ access: false, error: "missing phone" });
    }

    const cleanPhone = String(phone).trim();

    const { data, error } = await supabaseServer
      .from("users")
      .select("credit_limit, used_count, is_unlimited")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ access: false, error: "user not found" });
    }

    if (data.is_unlimited === true) {
      return NextResponse.json({
        access: true,
        is_unlimited: true,
      });
    }

    const used = data.used_count ?? 0;
    const limit = data.credit_limit ?? 3;
    const remaining = Math.max(0, limit - used);

    return NextResponse.json({
      access: remaining > 0,
      used,
      limit,
      remaining,
    });
  } catch (err) {
    console.error("CHECK ACCESS ERROR:", err);
    return NextResponse.json({ access: false, error: "server error" });
  }
}
