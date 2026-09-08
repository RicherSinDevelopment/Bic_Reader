import { addSafeBreadcrumb } from "@/services/errorReporting";

type ScrollSample = { offset: number; at: number };

function durationBucket(milliseconds: number) {
  if (milliseconds < 250) return "under-250ms";
  if (milliseconds < 750) return "250-750ms";
  if (milliseconds < 1_500) return "750ms-1.5s";
  if (milliseconds < 3_000) return "1.5-3s";
  return "over-3s";
}

function speedBucket(pointsPerSecond: number) {
  if (pointsPerSecond < 150) return "slow";
  if (pointsPerSecond < 600) return "moderate";
  if (pointsPerSecond < 1_500) return "fast";
  return "very-fast";
}

/**
 * Records one user-initiated reader gesture. It deliberately retains only
 * coarse timing and distance buckets: never document content, page titles, or
 * a PDF identifier.
 */
export class ReaderScrollDiagnostics {
  private start: ScrollSample | null = null;
  private previous: ScrollSample | null = null;
  private peakSpeed = 0;

  begin(offset: number, at = Date.now()) {
    this.start = { offset, at };
    this.previous = this.start;
    this.peakSpeed = 0;
  }

  sample(offset: number, at = Date.now()) {
    if (!this.previous) return;
    const elapsed = at - this.previous.at;
    if (elapsed > 0) {
      this.peakSpeed = Math.max(
        this.peakSpeed,
        (Math.abs(offset - this.previous.offset) / elapsed) * 1_000,
      );
    }
    this.previous = { offset, at };
  }

  end(offset: number, at = Date.now()) {
    if (!this.start) return;
    this.sample(offset, at);
    const duration = Math.max(0, at - this.start.at);
    const distance = Math.abs(offset - this.start.offset);
    const averageSpeed = duration ? (distance / duration) * 1_000 : 0;
    addSafeBreadcrumb("bic.reader.scroll", "gesture-settled", {
      duration: durationBucket(duration),
      distance: distance < 200 ? "short" : distance < 900 ? "medium" : "long",
      averageSpeed: speedBucket(averageSpeed),
      peakSpeed: speedBucket(this.peakSpeed),
    });
    this.start = null;
    this.previous = null;
    this.peakSpeed = 0;
  }
}

export function reportTocNavigation(
  stage: "requested" | "settled" | "missed",
  elapsedMs?: number,
) {
  addSafeBreadcrumb("bic.reader.toc", stage, {
    elapsed: elapsedMs === undefined ? undefined : durationBucket(elapsedMs),
  });
}
