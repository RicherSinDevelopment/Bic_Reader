// Deno resolves npm: specifiers when Supabase bundles this Edge Function.
// eslint-disable-next-line import/no-unresolved
import { createClient } from "npm:@supabase/supabase-js@2";
import { isOwnedStoragePath } from "../_shared/securityPolicy.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const revenueCatSecret = Deno.env.get("REVENUECAT_SECRET_API_KEY");
const pdfBucket = "premium-pdfs";

function response(body: unknown, status = 200) {
  return Response.json(body, { status });
}

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return response({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("authorization");
  if (!authorization) return response({ error: "Unauthorized" }, 401);

  const body = (await request.json().catch(() => null)) as {
    confirmation?: string;
  } | null;
  if (body?.confirmation !== "DELETE")
    return response({ error: "Deletion was not confirmed" }, 400);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return response({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Storage objects do not participate in Postgres ON DELETE CASCADE. Resolve
  // every owned path first, including any orphaned files not represented by
  // cloud_pdf_documents, and remove them before deleting the Auth identity.
  const paths = new Set<string>();
  const { data: documents, error: documentsError } = await admin
    .from("cloud_pdf_documents")
    .select("storage_path")
    .eq("user_id", user.id);
  if (documentsError)
    return response({ error: "Unable to enumerate account data" }, 500);
  documents?.forEach((document) => {
    if (isOwnedStoragePath(user.id, document.storage_path)) {
      paths.add(document.storage_path);
    } else {
      console.error("delete-account rejected non-owned metadata path");
    }
  });

  for (let offset = 0; ; offset += 100) {
    const { data: objects, error: listError } = await admin.storage
      .from(pdfBucket)
      .list(user.id, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
    if (listError)
      return response({ error: "Unable to enumerate stored PDFs" }, 500);
    objects?.forEach((object) => {
      const path = `${user.id}/${object.name}`;
      if (isOwnedStoragePath(user.id, path)) paths.add(path);
    });
    if (!objects || objects.length < 100) break;
  }

  const ownedPaths = [...paths];
  for (let index = 0; index < ownedPaths.length; index += 100) {
    const { error: storageError } = await admin.storage
      .from(pdfBucket)
      .remove(ownedPaths.slice(index, index + 100));
    if (storageError)
      return response({ error: "Unable to delete stored PDFs" }, 500);
  }

  // RevenueCat deletion clears the customer record but does not cancel an
  // Apple subscription. The app warns the customer and links to Apple's
  // subscription management before this endpoint can be invoked.
  if (revenueCatSecret) {
    const revenueCatResponse = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${revenueCatSecret}` },
      },
    );
    if (!revenueCatResponse.ok && revenueCatResponse.status !== 404) {
      return response({ error: "Unable to delete subscription profile" }, 502);
    }
  }

  // profiles, entitlements, cloud PDF metadata, annotations, and settings all
  // reference auth.users with ON DELETE CASCADE.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return response({ error: "Unable to delete account" }, 500);

  return response({ deleted: true });
});
