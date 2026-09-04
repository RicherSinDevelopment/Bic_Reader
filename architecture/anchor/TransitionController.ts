import { useAnchorStore } from "./AnchorStore";
import type { AnchorAdapter, CanonicalAnchor, TransitionPhase, TransitionTarget } from "./AnchorTypes";
import {
  addSafeBreadcrumb,
  captureOperationalMessage,
} from "@/services/errorReporting";
import { anchorAccuracyScore, recordTransitionMetric } from "./AnchorMetrics";

const MAX_RESTORE_ATTEMPTS = 2;
// Verification already polls the renderer until it observes a stable anchor.
// A long unconditional pause only adds latency to every cached tab switch.
const RESTORE_SETTLE_MS = 40;

export class TransitionController {
  private nextId = Date.now();

  isCurrent(id: number) {
    const transition = useAnchorStore.getState().transition;
    return transition.id === id && transition.status === "running";
  }

  cancel(reason = "superseded") {
    const current = useAnchorStore.getState().transition;
    if (current.status !== "running") return;
    useAnchorStore.getState().setTransition({ ...current, status: "cancelled", error: reason });
    addSafeBreadcrumb("bic.reader.transition", "cancelled", {
      fromLayout: current.from?.layout,
      fromMode: current.from?.mode,
      toLayout: current.target?.layout,
      toMode: current.target?.mode,
    });
    if (__DEV__) console.info(`[Transition ${current.id}] aborted: ${reason}`);
  }

  private phase(id: number, phase: TransitionPhase) {
    if (!this.isCurrent(id)) return false;
    const current = useAnchorStore.getState().transition;
    useAnchorStore.getState().setTransition({ ...current, phase });
    addSafeBreadcrumb("bic.reader.transition", phase, {
      fromLayout: current.from?.layout,
      fromMode: current.from?.mode,
      toLayout: current.target?.layout,
      toMode: current.target?.mode,
    });
    if (__DEV__) console.info(`[Transition ${id}] ${phase}`);
    return true;
  }

  async run(input: {
    from: TransitionTarget;
    target: TransitionTarget;
    capture: () => CanonicalAnchor | null | Promise<CanonicalAnchor | null>;
    prepare?: (anchor: CanonicalAnchor, id: number) => boolean | Promise<boolean>;
    adapter: AnchorAdapter;
  }) {
    const startedAt = Date.now();
    this.cancel();
    const id = ++this.nextId;
    useAnchorStore.getState().setTransition({ id, phase: "capture", status: "running", from: input.from, target: input.target });
    try {
      const anchor = await input.capture();
      if (!this.isCurrent(id) || !anchor) throw new Error(anchor ? "superseded" : "no canonical anchor");
      this.phase(id, "prepare");
      if (input.prepare && !(await input.prepare(anchor, id))) throw new Error("destination preparation failed");
      if (!this.isCurrent(id)) return false;
      this.phase(id, "layout");
      if (!(await input.adapter.waitUntilReady(anchor, id))) throw new Error("destination layout not ready");
      if (!this.isCurrent(id)) return false;
      for (let attempt = 0; attempt < MAX_RESTORE_ATTEMPTS; attempt += 1) {
        this.phase(id, "restore");
        const restored = await input.adapter.restore(anchor, id);
        if (!this.isCurrent(id)) return false;
        if (!restored.ok && !restored.retryable) throw new Error(restored.reason ?? "restore failed");
        await new Promise<void>((resolve) => setTimeout(resolve, RESTORE_SETTLE_MS));
        if (!this.isCurrent(id)) return false;
        this.phase(id, "verify");
        const verified = input.adapter.verify ? await input.adapter.verify(anchor, id) : { ok: restored.ok };
        if (!this.isCurrent(id)) return false;
        if (verified.ok) {
          const durationMs = Date.now() - startedAt;
          const accuracyScore = anchorAccuracyScore(
            "expected" in verified ? verified.expected : anchor,
            "actual" in verified ? verified.actual : undefined,
          );
          useAnchorStore.getState().setActiveMode(input.target.mode);
          useAnchorStore.getState().setActiveLayout(input.target.layout);
          useAnchorStore.getState().setTransition({ id, phase: "idle", status: "complete", from: input.from, target: input.target });
          addSafeBreadcrumb("bic.reader.transition", "completed", {
            fromLayout: input.from.layout,
            fromMode: input.from.mode,
            toLayout: input.target.layout,
            toMode: input.target.mode,
            attempt: attempt + 1,
            durationMs,
            accuracyScore,
          });
          recordTransitionMetric({
            id,
            from: input.from,
            target: input.target,
            durationMs,
            accuracyScore,
            attempt: attempt + 1,
            status: "complete",
          });
          if (accuracyScore < 90) {
            captureOperationalMessage("reader.transition.low_accuracy", {
              fromLayout: input.from.layout,
              fromMode: input.from.mode,
              toLayout: input.target.layout,
              toMode: input.target.mode,
              accuracyScore,
            });
          }
          if (durationMs > 2_500) {
            captureOperationalMessage("reader.transition.slow", {
              fromLayout: input.from.layout,
              fromMode: input.from.mode,
              toLayout: input.target.layout,
              toMode: input.target.mode,
              durationMs,
            });
          }
          return true;
        }
        addSafeBreadcrumb("bic.reader.transition", "verification-retry", {
          fromLayout: input.from.layout,
          fromMode: input.from.mode,
          toLayout: input.target.layout,
          toMode: input.target.mode,
          attempt: attempt + 1,
        }, "warning");
        if (__DEV__) {
          console.warn(`[Transition ${id}] verification retry`, {
            attempt,
            expected: anchor,
            actual: "actual" in verified ? verified.actual : undefined,
            target: input.target,
          });
        }
      }
      throw new Error("anchor verification failed after retry");
    } catch (error) {
      if (!this.isCurrent(id)) return false;
      const message = error instanceof Error ? error.message : String(error);
      useAnchorStore.getState().setTransition({ id, phase: "idle", status: message === "superseded" ? "cancelled" : "failed", from: input.from, target: input.target, error: message });
      if (message !== "superseded") {
        captureOperationalMessage("reader.transition.failed", {
          fromLayout: input.from.layout,
          fromMode: input.from.mode,
          toLayout: input.target.layout,
          toMode: input.target.mode,
        });
      }
      recordTransitionMetric({
        id,
        from: input.from,
        target: input.target,
        durationMs: Date.now() - startedAt,
        status: message === "superseded" ? "cancelled" : "failed",
      });
      if (__DEV__) console.warn(`[Transition ${id}] ${message}`);
      return false;
    }
  }
}

export const transitionController = new TransitionController();
