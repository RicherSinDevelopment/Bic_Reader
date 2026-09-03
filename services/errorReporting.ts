import * as Sentry from "@sentry/react-native";
import type { Breadcrumb, ErrorEvent } from "@sentry/react-native";

const DEFAULT_SENTRY_DSN =
  "https://b77ebef88c9bc5c34dcd7f86f03dfa34@o4512013771407360.ingest.us.sentry.io/4512015597961216";

type SafeValue = string | number | boolean | null | undefined;
export type SafeDiagnosticData = Record<string, SafeValue>;

const SENSITIVE_TEXT = [
  /bearer\s+[a-z0-9._~+/=-]+/gi,
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
  /(?:file|content):\/\/[^\s]+/gi,
  /(?:^|[\s"'])[^\s"']+\.pdf(?:[\s"']|$)/gi,
];

function scrubText(value: string) {
  return SENSITIVE_TEXT.reduce(
    (current, pattern) => current.replace(pattern, "[redacted]"),
    value,
  ).slice(0, 1_000);
}

function sanitizeEvent(event: ErrorEvent) {
  delete event.user;
  delete event.request;
  delete event.extra;

  if (event.message) event.message = scrubText(event.message);
  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = scrubText(value.value);
  }

  event.breadcrumbs = event.breadcrumbs?.filter((breadcrumb) =>
    breadcrumb.category?.startsWith("bic."),
  );
  return event;
}

function sanitizeBreadcrumb(breadcrumb: Breadcrumb) {
  if (!breadcrumb.category?.startsWith("bic.")) return null;
  return {
    ...breadcrumb,
    message: breadcrumb.message ? scrubText(breadcrumb.message) : undefined,
  };
}

export function initializeErrorReporting() {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? DEFAULT_SENTRY_DSN,
    enabled: !__DEV__,
    environment: process.env.EXPO_PUBLIC_APP_ENV ??
      (__DEV__ ? "development" : "production"),
    sendDefaultPii: false,
    enableNative: true,
    enableNativeCrashHandling: true,
    enableAutoSessionTracking: true,
    enableAutoPerformanceTracing: false,
    enableUserInteractionTracing: false,
    enableCaptureFailedRequests: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    maxBreadcrumbs: 50,
    beforeSend: sanitizeEvent,
    beforeBreadcrumb: sanitizeBreadcrumb,
  });
}

export function addSafeBreadcrumb(
  category: `bic.${string}`,
  message: string,
  data?: SafeDiagnosticData,
  level: Breadcrumb["level"] = "info",
) {
  Sentry.addBreadcrumb({ category, message, data, level });
}

export function captureHandledError(
  error: unknown,
  operation: string,
  data?: SafeDiagnosticData,
) {
  const exception = error instanceof Error ? error : new Error(String(error));
  Sentry.withScope((scope) => {
    scope.setTag("bic.operation", operation);
    if (data) scope.setContext("operation", data);
    Sentry.captureException(exception);
  });
}

const lastOperationalReport = new Map<string, number>();

export function captureOperationalMessage(
  message: string,
  data?: SafeDiagnosticData,
  minimumIntervalMs = 30_000,
) {
  const now = Date.now();
  const previous = lastOperationalReport.get(message) ?? 0;
  if (now - previous < minimumIntervalMs) return;
  lastOperationalReport.set(message, now);

  Sentry.withScope((scope) => {
    scope.setLevel("warning");
    scope.setTag("bic.operation", message);
    if (data) scope.setContext("operation", data);
    Sentry.captureMessage(message);
  });
}

export { Sentry };
