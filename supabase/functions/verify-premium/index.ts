// Deno resolves npm: specifiers when Supabase bundles this Edge Function.
// eslint-disable-next-line import/no-unresolved
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
  const { error } = await admin.rpc("apply_revenuecat_entitlement", {
    p_event_id: `verification-${crypto.randomUUID()}`,
    p_event_timestamp_ms: Date.now(),
    p_user_id: user.id,
    p_entitlement_id: entitlementId,
    p_is_active: isActive,
    p_expires_at: accessUntil,
  });
  if (error) {
    console.error("premium verification update failed", error.code ?? "unknown");
    return new Response("Unable to store subscription status", { status: 500 });
  }
  return Response.json({ isPremium: isActive });
});
