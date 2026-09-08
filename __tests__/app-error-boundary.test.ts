/* eslint-disable import/first */
const mockCapture = jest.fn();
jest.mock("@/services/errorReporting", () => ({
  captureHandledError: (...args: unknown[]) => mockCapture(...args),
}));

import { AppErrorBoundary } from "@/components/errors/AppErrorBoundary";

describe("application error boundary", () => {
  test("switches to fallback state after a render error", () => {
    const error = new Error("render failed");
    expect(AppErrorBoundary.getDerivedStateFromError(error)).toEqual({ error });
  });
  test("reports only safe component-stack metadata", () => {
    const boundary = new AppErrorBoundary({
      area: "application-root", fallbackTitle: "Error", fallbackMessage: "Retry",
      children: null,
    });
    boundary.componentDidCatch(new Error("secret details"), { componentStack: "at Reader" } as any);
    expect(mockCapture).toHaveBeenCalledWith(expect.any(Error), "application-root", { hasComponentStack: true });
  });
});
