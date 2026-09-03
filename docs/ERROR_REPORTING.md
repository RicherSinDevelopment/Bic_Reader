# Production error reporting

Bic Reader uses `@sentry/react-native` for JavaScript and native crash reporting.

## Privacy posture

- Production-only reporting (`enabled: !__DEV__`)
- No Sentry user identity
- No default PII
- No session replay, screenshots, or view hierarchy
- No performance traces or profiling
- No automatic failed-network-request capture
- Only `bic.*` breadcrumbs survive `beforeBreadcrumb`
- Requests and arbitrary `extra` data are removed in `beforeSend`
- PDF text, filenames, paths, annotation text, and AI questions/answers must never be passed to reporting helpers

Use `addSafeBreadcrumb` only with categorical values, booleans, counters, and coarse buckets. Use `captureHandledError` for meaningful caught failures. Repeated operational warnings should use `captureOperationalMessage`, which is rate-limited.

## EAS production setup

The DSN is a public client identifier and has a built-in production fallback. It can be overridden with `EXPO_PUBLIC_SENTRY_DSN`.

Source-map and native-symbol uploads require a private Sentry organization token. Create it in Sentry with the source-map/release permissions recommended by Sentry, then run this locally without committing the value:

```bash
npx eas-cli env:create --name SENTRY_AUTH_TOKEN --value "PASTE_TOKEN_HERE" --environment production --visibility sensitive
```

The Expo config plugin contains:

- Organization: `richersindevelopment`
- Project: `react-native`

The Metro wrapper injects Debug IDs so uploaded source maps match production bundles. Native release and distribution identifiers are supplied by the native Sentry SDK from the app version and build number.

## Release verification

1. Create a production-profile EAS build after storing `SENTRY_AUTH_TOKEN`.
2. Confirm the build log says Sentry source maps and native debug symbols uploaded successfully.
3. Install the build through internal distribution or TestFlight.
4. Trigger a controlled JavaScript exception from a temporary development-only test action.
5. Trigger `Sentry.nativeCrash()` only in a disposable test build, reopen the app, and confirm the crash appears.
6. Confirm both events contain readable symbolicated stacks, release, distribution/build, and environment.
7. Inspect raw event JSON and verify it contains no account identity, filename, PDF text, annotation, question, answer, request headers, request body, screenshot, or view hierarchy.
8. Remove the temporary test action before App Store submission.

Do not test `nativeCrash()` in a normal user-facing build.
