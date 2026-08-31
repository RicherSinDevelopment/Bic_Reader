import { useAnchorStore } from "./AnchorStore";
import type { AnchorAuthority, AnchorCandidate, CanonicalAnchor } from "./AnchorTypes";

const AUTHORITATIVE = new Set<AnchorAuthority>([
  "reader-user", "translated-user", "toc", "search", "explicit-navigation",
]);

const clamp01 = (value: number | undefined) => value === undefined
  ? undefined
  : Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export class AnchorController {
  private persistence?: (anchor: CanonicalAnchor) => void;

  setPersistenceScheduler(scheduler?: (anchor: CanonicalAnchor) => void) {
    this.persistence = scheduler;
  }

  current() { return useAnchorStore.getState().canonicalAnchor; }

  initialize(candidate: AnchorCandidate) {
    const current = this.current();
    if (current?.documentId === candidate.documentId) return current;
    return this.commit(candidate, "explicit-navigation", false);
  }

  publish(candidate: AnchorCandidate, authority: AnchorAuthority) {
    if (!AUTHORITATIVE.has(authority)) return this.current();
    return this.commit(candidate, authority, true);
  }

  navigate(candidate: AnchorCandidate, authority: "toc" | "search" | "explicit-navigation") {
    return this.commit(candidate, authority, true);
  }

  private commit(candidate: AnchorCandidate, authority: AnchorAuthority, persist: boolean) {
    if (!candidate.documentId || !Number.isFinite(candidate.sourcePage) || candidate.sourcePage < 1) {
      if (__DEV__) console.warn("[Anchor] rejected invalid candidate", { authority, candidate });
      return this.current();
    }
    const current = this.current();
    if (current?.documentId === candidate.documentId &&
        candidate.revision !== undefined && candidate.revision < current.revision) {
      if (__DEV__) console.info("[Anchor] rejected stale candidate", { incoming: candidate.revision, current: current.revision });
      return current;
    }
    const anchor: CanonicalAnchor = {
      documentId: candidate.documentId,
      sourcePage: Math.max(1, Math.round(candidate.sourcePage)),
      sourceBlockId: candidate.sourceBlockId,
      wordIndex: candidate.wordIndex === undefined ? undefined : Math.max(0, Math.round(candidate.wordIndex)),
      characterOffset: candidate.characterOffset === undefined ? undefined : Math.max(0, Math.round(candidate.characterOffset)),
      blockProgress: clamp01(candidate.blockProgress),
      revision: Math.max(current?.documentId === candidate.documentId ? current.revision + 1 : 1, candidate.revision ?? 0),
      updatedAt: candidate.updatedAt ?? new Date().toISOString(),
    };
    useAnchorStore.getState().setCanonicalAnchor(anchor);
    if (__DEV__) console.info("[Anchor]", { authority, ...anchor });
    if (persist) this.persistence?.(anchor);
    return anchor;
  }
}

export const anchorController = new AnchorController();
