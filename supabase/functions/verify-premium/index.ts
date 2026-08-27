import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const revenueCatSecret = Deno.env.get("REVENUECAT_SECRET_API_KEY")!;
const entitlementId = Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "pro";

Deno.serve(async (request) => {
  const authorization = request.headers.get("authorization");
  if (!authorization) return new Response("Unauthorized", { status: 401 });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return new Response("Unauthorized", { status: 401 });
  if (!revenueCatSecret) return new Response("RevenueCat secret is missing", { status: 500 });

  const revenueCatResponse = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
    { headers: { Authorization: `Bearer ${revenueCatSecret}`, Accept: "application/json" } },
  );
  if (!revenueCatResponse.ok) {
    return new Response("Could not verify subscription", { status: 502 });
  }
  const payload = await revenueCatResponse.json() as {
    subscriber?: {
      entitlements?: Record<string, {
        expires_date?: string | null;
        grace_period_expires_date?: string | null;
      }>;
    };
  };
  const entitlement = payload.subscriber?.entitlements?.[entitlementId];
  const accessUntil = entitlement?.grace_period_expires_date ?? entitlement?.expires_date ?? null;
  const isActive = Boolean(entitlement) && (!accessUntil || Date.parse(accessUntil) > Date.now());

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.from("premium_entitlements").upsert({
    user_id: user.id,
    entitlement_id: entitlementId,
    is_active: isActive,
    expires_at: accessUntil,
    updated_at: new Date().toISOString(),
  });
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ isPremium: isActive });
});
