// Deno resolves npm: specifiers when Supabase bundles this Edge Function.
// eslint-disable-next-line import/no-unresolved
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  isRevenueCatEventIdentity,
  isSupabaseUserId,
} from "../_shared/securityPolicy.ts";

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
      id?: string;
      event_timestamp_ms?: number;
    };
  } | null;
  const event = body?.event;
  if (!event || !isRevenueCatEventIdentity(event.id, event.event_timestamp_ms)) {
    return new Response("Invalid event", { status: 400 });
  }
  const userId = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])]
    .find(isSupabaseUserId);

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
  const { data: applied, error } = await admin.rpc("apply_revenuecat_entitlement", {
    p_event_id: event.id,
    p_event_timestamp_ms: event.event_timestamp_ms,
    p_user_id: userId,
    p_entitlement_id: entitlementId,
    p_is_active: isActive,
    p_expires_at: expiresAt,
  });

  if (error) {
    console.error("revenuecat entitlement update failed", error.code ?? "unknown");
    return new Response("Unable to process event", { status: 500 });
  }
  return Response.json({ ok: true, applied: applied === true });
});
