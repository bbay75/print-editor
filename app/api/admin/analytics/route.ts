import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("users")
    .select("used_count, credit_limit, is_unlimited, created_at");

  if (error) {
    return NextResponse.json({ error: "analytics failed" }, { status: 500 });
  }

  const users = data || [];

  const totalUsers = users.length;
  const totalUsed = users.reduce((sum, u) => sum + (u.used_count ?? 0), 0);
  const totalCredits = users.reduce((sum, u) => sum + (u.credit_limit ?? 0), 0);
  const unlimitedUsers = users.filter((u) => u.is_unlimited).length;
  const limitedUsers = totalUsers - unlimitedUsers;

  const usagePercent =
    totalCredits > 0 ? Math.round((totalUsed / totalCredits) * 100) : 0;

  return NextResponse.json({
    totalUsers,
    totalUsed,
    totalCredits,
    unlimitedUsers,
    limitedUsers,
    usagePercent,
  });
}
