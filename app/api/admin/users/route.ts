import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const search = searchParams.get("search") || "";
  const page = Number(searchParams.get("page") || "1");
  const limit = 10;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabaseServer
    .from("users")
    .select("*", { count: "exact" })
    .range(from, to);

  if (search) {
    query = query.or(`phone.ilike.%${search}%,name.ilike.%${search}%`);
  }

  const { data, count } = await query;

  return NextResponse.json({
    users: data,
    total: count,
  });
}
