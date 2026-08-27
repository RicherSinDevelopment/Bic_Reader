import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET")!;
const entitlementId = Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "pro";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!webhookSecret || request.headers.get("authorization") !== `Bearer ${webhookSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    event?: {
      app_user_id?: string;
      original_app_user_id?: string;
      aliases?: string[];
      entitlement_ids?: string[];
      expiration_at_ms?: number | null;
      type?: string;
    };
  } | null;
  const event = body?.event;
  if (!event) return new Response("Missing event", { status: 400 });
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const userId = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])]
    .find((candidate) => candidate && uuidPattern.test(candidate));

  // RevenueCat app user IDs are the authenticated Supabase UUIDs configured
  // by RevenueCatProvider. Ignore anonymous/alias events that cannot own data.
  if (!userId) {
    return new Response("Ignored non-user entitlement", { status: 202 });
  }

  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;
  const inactiveTypes = new Set(["EXPIRATION", "REFUND", "SUBSCRIPTION_PAUSED"]);
  const includesEntitlement = event.entitlement_ids?.includes(entitlementId) ?? false;
  const isActive = includesEntitlement && !inactiveTypes.has(event.type ?? "") &&
    (!expiresAt || Date.parse(expiresAt) > Date.now());

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.from("premium_entitlements").upsert({
    user_id: userId,
    entitlement_id: entitlementId,
    is_active: isActive,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });

  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true });
});
