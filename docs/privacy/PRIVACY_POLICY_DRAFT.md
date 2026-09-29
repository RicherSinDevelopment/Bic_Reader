# Bic Reader Privacy Policy

**Effective date:** September 30, 2026
**Last updated:** September 30, 2026

This Privacy Policy explains how Bic Reader collects, uses, shares, stores, and protects information when you use the Bic Reader mobile application, website, and related services (collectively, the “Service”).

## Who we are

Bic Reader is operated by **Ali Almahdi**. For privacy questions or requests, contact **support@bicreader.com**. Our website is **https://bicreader.com**.

For purposes of applicable data-protection law, Ali Almahdi is the controller of personal information processed directly by Bic Reader. Our service providers process information as described below.

## Information we collect and how we collect it

### Account and authentication information

Creating a Bic Reader account is optional for local reading features. When you create or use an account, we process your name, email address, account identifier, authentication session information, and information returned by Sign in with Apple or Google Sign-In. We receive this information when you enter it or choose a social sign-in provider.

Password authentication is provided by Supabase. Bic Reader does not receive or store a readable copy of your password. Apple and Google may independently process device, account, network, usage, or other technical information under their own privacy notices when their sign-in services are used.

### Purchases and subscriptions

Apple processes App Store payments. Bic Reader and RevenueCat receive subscription and transaction information needed to display products, complete or restore purchases, determine entitlement status, prevent fraud, and provide Premium features. This may include an app user identifier, product identifier, transaction information, subscription status, and expiration or renewal information. Bic Reader does not receive your payment-card or bank-account details.

### PDFs, annotations, and reading information

Imported PDFs are initially stored on your device. Bic Reader also stores local library information such as filenames, file details, thumbnails, highlights, notes, reading position, completion percentage, last-opened time, reader settings, and appearance preferences.

Cloud sync is automatically enabled when a signed-in user has an active Premium subscription. In that situation, Bic Reader uploads PDFs and related library information to Supabase so the library can be synchronized across the user’s devices. Users who do not want their PDFs uploaded should use Bic Reader without signing in. PDFs skipped because of a file-size or service limitation remain local.

### AI reading assistant

The AI assistant is optional and requires explicit permission before it sends content for processing. When you allow AI processing and submit an AI request, Bic Reader sends your question and relevant selected or extracted PDF text to a Supabase Edge Function. The Edge Function sends that content to OpenAI to generate an answer. Do not submit confidential or highly sensitive material unless you are comfortable having it processed by Supabase and OpenAI.

AI conversation history is stored locally on your device. To enforce usage limits, prevent duplicate requests, and protect the Service from abuse, Supabase stores an account-linked request timestamp, a non-readable request hash, input character and token counts, output token counts, and success or failure status. These usage records do not contain the full question or PDF text.

Bic Reader requests that OpenAI Responses API application state not be stored by setting `store` to `false`. OpenAI states that API content is not used to train its models by default unless the API customer opts in. Under OpenAI’s standard API data controls, abuse-monitoring logs may contain prompts, responses, and related metadata and are normally retained for up to 30 days, unless a different approved retention control or legal requirement applies.

You can withdraw or grant permission for future OpenAI processing at any time under **Profile → AI data sharing**. Disabling permission prevents new AI requests from being sent to OpenAI and does not prevent you from using the rest of the app. It does not recall information that was already processed under an earlier request.

### Technical information

When the app communicates with Bic Reader or its service providers, those services necessarily receive technical request information such as IP address, device or app information, operating-system information, timestamps, and service logs. We use this information to deliver and secure the Service, enforce usage limits, troubleshoot problems, and prevent fraud or abuse. Bic Reader does not use this information for cross-app advertising tracking.

### Error and crash reporting

Bic Reader uses Sentry to receive JavaScript errors, native crash reports, app and build versions, general device and operating-system information, session diagnostics, and limited operational events needed to diagnose failures.

Bic Reader configures Sentry not to intentionally send account identity, PDF text, filenames, file paths, annotations, AI questions or answers, screenshots, screen recordings, view hierarchies, or network request contents. Diagnostic information is used only to maintain, secure, and improve app functionality and is not used for advertising tracking.

## How we use information

We use information to:

- create, authenticate, secure, and support optional accounts;
- import, display, read, annotate, synchronize, and restore PDF libraries;
- preserve reading position and personalize reader settings;
- process subscriptions, restore purchases, and provide Premium access;
- answer AI questions that the user chooses to submit;
- enforce service limits and detect duplicate, fraudulent, or abusive activity;
- diagnose crashes and maintain the reliability and security of the Service;
- comply with legal obligations and enforce applicable terms; and
- respond to privacy, deletion, and support requests.

Bic Reader does not sell personal information. Bic Reader does not use personal information to track users across other companies’ apps or websites for targeted advertising.

## Legal bases for processing

Where applicable law requires a legal basis, Bic Reader relies on:

- **Performance of a contract** to provide accounts, Premium entitlements, cloud sync, and other features requested by the user;
- **Consent** for optional AI processing and other processing where consent is requested;
- **Legitimate interests** in securing, maintaining, troubleshooting, and preventing misuse of the Service, where those interests are not overridden by the user’s rights; and
- **Legal obligations** when processing is necessary to comply with applicable law or valid legal requests.

You may withdraw consent for future processing at any time where processing is based on consent. Withdrawal does not affect processing that occurred before consent was withdrawn.

## Service providers and disclosures

Bic Reader uses the following providers:

- **[Supabase](https://supabase.com/privacy)** for authentication, hosted databases, private file storage, and Edge Functions;
- **[RevenueCat](https://www.revenuecat.com/privacy/)** for subscription and entitlement management;
- **[OpenAI](https://openai.com/policies/privacy-policy/)** for the optional AI reading assistant;
- **[Apple](https://www.apple.com/legal/privacy/)** for Sign in with Apple and App Store purchases;
- **[Google](https://policies.google.com/privacy)** for optional Google Sign-In; and
- **[Sentry](https://sentry.io/privacy/)** for privacy-filtered error and crash reporting.

These providers may process information in countries other than your own. Bic Reader requires providers that process personal information on its behalf to protect it consistently with this Privacy Policy and applicable law and to use it only to provide their contracted services. Each provider may also process information as an independent controller where described in its own terms or privacy notice.

Bic Reader may also disclose information when reasonably necessary to comply with law, respond to valid legal process, protect users or the Service, investigate fraud or security incidents, or complete a business transfer subject to appropriate safeguards. Bic Reader does not disclose user information to data brokers or advertising networks.

## Retention and deletion

Account information and synchronized content are retained while the account remains active and as needed to provide the Service. AI usage and quota records are retained as needed to enforce usage limits, secure the Service, and resolve abuse or billing issues. Diagnostic and provider logs follow the retention settings and documented schedules applicable to each provider. OpenAI’s standard API abuse-monitoring retention is normally up to 30 days. Deleted information may remain temporarily in restricted backups until those backups are overwritten under the provider’s normal backup cycle.

Successful in-app account deletion removes the Bic Reader authentication account, profile, cloud PDFs, cloud metadata, cloud annotations, synchronized reading information and settings, AI usage records, Premium entitlement records, and RevenueCat customer record. Local annotations and locally stored AI conversations are also removed. Imported PDF files stored on the device remain available until the user deletes them, clears the app’s data, or uninstalls the app.

Deleting a Bic Reader account does not cancel an App Store subscription. Users must manage or cancel billing through their Apple Account subscription settings if they do not want the subscription to renew.

Local information that is not removed through account deletion remains on the device until the user deletes it, clears the app’s data, or uninstalls the app. Bic Reader may retain limited information where reasonably necessary for security, fraud prevention, dispute resolution, backup recovery, or legal compliance, where permitted by law.

## Your choices and rights

You can use local reading features without creating a Bic Reader account. Social login and the AI assistant are optional. Cloud sync is automatically provided to signed-in Premium users as explained above.

You can:

- allow or withdraw AI-processing permission under **Profile → AI data sharing**;
- delete your Bic Reader account under **Profile → Delete account**;
- delete individual local or synchronized documents using the app’s library controls;
- manage or cancel an Apple subscription through Apple Account settings; and
- remove Bic Reader’s Google authorization through your Google Account’s third-party connection settings.

Depending on where you live, you may have rights to access, correct, delete, restrict, object to processing of, or receive a portable copy of your personal information. You may also have the right to withdraw consent and complain to your local data-protection authority. Contact **support@bicreader.com** to exercise a privacy right. We may need to verify your identity before completing a request.

Providing account information is optional, but Bic Reader cannot provide account authentication or account-specific cloud services without the information required for those features. Refusing or withdrawing AI permission only disables AI requests and does not disable unrelated app functionality.

## Children and the 4+ rating

Bic Reader has an App Store age rating of **4+**, which describes the age-appropriateness of the app’s content. An App Store age rating does not determine the age at which a child may independently consent to the processing of personal information.

Children may use local reading features under the supervision of a parent or legal guardian. A child who is below the age at which they can legally consent to online data processing in their country may use an account, cloud sync, social sign-in, or the AI assistant only with the authorization and supervision of a parent or legal guardian and where permitted by law. Parents and guardians should review documents before allowing a child to send PDF text to the AI assistant.

Bic Reader does not knowingly collect personal information from a child in a manner that requires verifiable parental consent without that consent. If you believe a child has provided personal information without the authorization required by applicable law, contact **support@bicreader.com**. We will investigate and delete or otherwise address the information as required.

## Security

Bic Reader uses reasonable technical and organizational safeguards, including authenticated access, private cloud storage, encrypted network transmission, database row-level security, access controls, and data minimization. No storage or transmission method is completely secure, so absolute security cannot be guaranteed.

## International processing

Bic Reader and its providers may process information outside your country. Where required, we rely on contractual commitments and other legally recognized safeguards for international transfers. You can contact **support@bicreader.com** for additional information about processing relevant to your account.

## Changes to this policy

We may update this Privacy Policy when Bic Reader, its providers, or applicable requirements change. We will update the “Last updated” date and provide any additional notice required by law. Material changes will apply prospectively unless otherwise permitted by law.

## Contact

For privacy questions, requests, or complaints:

**Ali Almahdi — Bic Reader**

**support@bicreader.com**

**https://bicreader.com**
