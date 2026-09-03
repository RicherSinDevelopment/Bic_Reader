# Bic Reader App Privacy declaration

Last audited: 2026-09-01

This is the working source of truth for the App Store Connect **App Privacy** questionnaire. Re-audit it whenever data handling or a third-party SDK changes.

## Tracking

- **Does this app or its third-party partners use data for tracking?** No.
- The app has no advertising SDK, does not access IDFA, and does not combine app data with third-party data for targeted advertising or advertising measurement.
- `NSPrivacyTracking` is `false`.

## Data collected by Bic Reader

Unless a later audit proves otherwise, select **App Functionality**, **Linked to the User**, and **Not used for tracking** for each row below.

| App Store category | Data type | Why it is collected | Evidence |
| --- | --- | --- | --- |
| Contact Info | Name | Account creation and Apple/Google profile information | `app/(auth)/sign-up.tsx`, `components/auth/SocialAuthButtons.tsx` |
| Contact Info | Email Address | Authentication, confirmation, and password recovery | Supabase Auth flows under `app/(auth)` |
| Identifiers | User ID | Supabase account identity, RevenueCat customer mapping, and cloud-data ownership | `providers/RevenueCatProvider.tsx`, cloud-sync schema |
| Purchases | Purchase History | Subscription purchase, entitlement verification, restore, and premium access | RevenueCat SDK and Edge Functions |
| User Content | Other User Content | Cloud PDFs, PDF filenames, highlights, annotation notes, AI questions, selected/extracted PDF text, and AI answers | `services/cloudSyncService.ts`, `components/readernavbar/AI.tsx` |
| Usage Data | Product Interaction | Last-opened time, current page, total pages, completion percentage, reading preferences, and appearance settings | `services/cloudSyncService.ts` |
| Diagnostics | Crash Data | Diagnose JavaScript errors, native crashes, reader failures, and WebView process terminations | Privacy-filtered Sentry integration in `services/errorReporting.ts` |

For **Product Interaction**, also select **Product Personalization** because reading and appearance settings customize the reader. App Functionality remains selected.

Do **not** declare Payment Information: Apple processes payment credentials and Bic Reader does not receive card or bank details.

## Additional declarations contributed by Google Sign-In

The installed Google Sign-In native SDK's signed privacy manifest declares the following additional collection. Because Apple requires third-party partner behavior to be included, enter these answers unless a final Release archive and Google's current documentation establish that a type does not apply to Bic Reader's SDK configuration.

| App Store category | Data type | Purpose in the SDK manifest | Linked? | Tracking? |
| --- | --- | --- | --- | --- |
| Contact Info | Phone Number | App Functionality | Yes | No |
| Location | Coarse Location | App Functionality | Yes | No |
| Identifiers | Device ID | Analytics | Yes | No |
| Usage Data | Other Usage Data | Analytics | Yes | No |
| Other Data | Other Data Types | App Functionality and Analytics | Yes | No |

For the overlapping Google entries, add **Analytics** to User ID. Name and Email Address remain App Functionality. This is intentionally conservative and matches the installed pod's manifest rather than assuming that authentication SDK traffic is limited to the scopes shown in application code.

## Third-party behavior

| Partner | Data involved | Purpose | Linked? | Tracking? |
| --- | --- | --- | --- | --- |
| Supabase | Name, email, user ID, authentication tokens, cloud PDFs and metadata, annotations, notes, reading progress/settings | Authentication, database, storage, sync, and server functions | Yes | No |
| RevenueCat | App user ID, purchase and entitlement history, product/transaction information | Purchases, subscription status, restore, and entitlement enforcement | Yes, because Bic Reader supplies the Supabase user UUID | No |
| OpenAI | User question, selected/extracted PDF text, context label, generated answer, and service metadata | Answering an AI request | Yes in transit through an authenticated request; treat as linked for the App Store declaration | No |
| Apple | Apple sign-in identity data and App Store purchase processing | Authentication and payment | Account data is linked | No by Bic Reader |
| Google | Google sign-in identity token and basic profile information | Authentication | Yes | No by Bic Reader |
| Sentry | Crash stack, app/build version, general device/OS context, and allow-listed operational breadcrumbs | Diagnose and recover from application failures | No account identity is supplied | No |

The Google Sign-In pod currently contributes a broad privacy manifest containing Name, Email, Phone Number, Coarse Location, User ID, Device ID, Other Usage Data, and Other Data Types. Bic Reader requests only basic identity information in application code, but the App Store declaration must also cover SDK behavior. Compare these entries with the archived app privacy report and Google's current disclosure before submission.

## Retention and deletion facts

- Supabase account and cloud content remain until the user deletes individual content, deletes the account, or the operator applies a documented retention rule.
- In-app account deletion removes the Supabase account, cloud PDF objects and metadata, cloud annotations/settings, entitlement record, and RevenueCat customer record. It also removes local annotations and local AI conversations; offline PDF files remain on the device.
- Deleting the account does not cancel an Apple subscription. The app warns users and links to Apple's subscription-management screen.
- AI conversations are stored locally in SQLite. Each AI request sends the question and selected PDF context through Supabase to OpenAI.
- The OpenAI request sets `store: false`. OpenAI may still retain abuse-monitoring logs under the API account's applicable data controls, normally for up to 30 days unless a different approved retention control applies.

## App Store Connect entry sequence

1. Open **App Store Connect → My Apps → Bic Reader → App Privacy**.
2. Confirm that the app collects data.
3. Add the seven Bic Reader data types and the five additional Google Sign-In types above with their listed purposes, linkage, and tracking answers. Crash Data is App Functionality, not linked to the user, and not used for tracking under the shipped privacy-safe configuration.
4. Answer that data is **not used for tracking**.
5. Add the public Privacy Policy URL when the website is ready.
6. Optionally add a Privacy Choices URL that explains in-app deletion and subscription management.
7. Compare the answers with the final archived privacy report before publishing.

## Re-audit triggers

Re-run this audit after enabling Sentry performance monitoring or replay, adding another analytics/crash reporter, advertising, support forms, web views that collect information, new login providers, new AI endpoints, or a material SDK upgrade.
