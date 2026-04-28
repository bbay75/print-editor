import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const { deviceId } = await req.json();

    if (!deviceId) {
      return NextResponse.json({ allowed: false, used_count: 0 });
    }

    const { data, error: readError } = await supabaseServer
      .from("free_usages")
      .select("used_count")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (readError) {
      console.error("FREE USAGE READ ERROR:", readError);
      return NextResponse.json({ allowed: false, used_count: 0 });
    }

    const used = data?.used_count ?? 0;

    if (used >= 3) {
      return NextResponse.json({
        allowed: false,
        used_count: used,
      });
    }

    const nextUsed = used + 1;

    const { error: upsertError } = await supabaseServer
      .from("free_usages")
      .upsert(
        {
          device_id: deviceId,
          used_count: nextUsed,
        },
        {
          onConflict: "device_id",
        },
      );

    if (upsertError) {
      console.error("FREE USAGE UPSERT ERROR:", upsertError);
      return NextResponse.json({ allowed: false, used_count: used });
    }

    return NextResponse.json({
      allowed: true,
      used_count: nextUsed,
    });
  } catch (err) {
    console.error("FREE USAGE ERROR:", err);
    return NextResponse.json({ allowed: false, used_count: 0 });
  }
}
