# Premium cloud sync deployment

Cloud sync is denied until RevenueCat confirms the authenticated Supabase user
has the configured premium entitlement.

1. Apply the database migration and deploy both functions:

   ```sh
   supabase db push
   supabase functions deploy revenuecat-webhook --no-verify-jwt
   supabase functions deploy verify-premium
   ```

2. Add server-only function secrets (never use `EXPO_PUBLIC_` names):

   ```sh
   supabase secrets set \
     REVENUECAT_WEBHOOK_SECRET="a-long-random-value" \
     REVENUECAT_SECRET_API_KEY="your-revenuecat-secret-api-key" \
     REVENUECAT_ENTITLEMENT_ID="pro"
   ```

3. In RevenueCat, add a webhook whose URL is:

   ```text
   https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/revenuecat-webhook
   ```

   Set its Authorization header to:

   ```text
   Bearer <the same REVENUECAT_WEBHOOK_SECRET>
   ```

4. Send a RevenueCat test webhook, then test a sandbox purchase and restore on
   a second signed-in device. The RevenueCat App User ID must remain the
   Supabase user UUID; `RevenueCatProvider` already configures this mapping.

The publishable Supabase key is intentionally insufficient to grant premium
access. Only the webhook and `verify-premium` function can write the protected
`premium_entitlements` table.
