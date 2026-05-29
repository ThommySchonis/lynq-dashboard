import { supabaseAdmin, getUserFromToken } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { validateQuery } from "@/lib/validation";
import { listCronRunsQuery } from "@/lib/schemas/admin";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  const isAdmin = await isPlatformAdmin(user?.email)
  if (!user || !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [query, qErr] = validateQuery(request, listCronRunsQuery);
  if (qErr) return qErr;

  const { jobName, status, from, to, limit } = query;

  let dbQuery = supabaseAdmin.from("cron_job_runs").select("*").order("started_at", { ascending: false }).limit(limit);

  if (jobName) dbQuery = dbQuery.eq("job_name", jobName);
  if (status) {
    const statuses = status.split(",").map((s) => s.trim());
    dbQuery = statuses.length === 1 ? dbQuery.eq("status", statuses[0]) : dbQuery.in("status", statuses);
  }
  if (from) dbQuery = dbQuery.gte("started_at", from);
  if (to) dbQuery = dbQuery.lte("started_at", to);

  const { data, error } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ runs: data ?? [] });
}
