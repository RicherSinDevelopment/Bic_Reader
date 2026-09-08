import { ANCHOR_DEBUG, traceAnchor } from "./AnchorDiagnostics";
import { useAnchorStore } from "./AnchorStore";
import type {
  AnchorAuthority,
  AnchorCandidate,
  CanonicalAnchor,
} from "./AnchorTypes";

const AUTHORITATIVE = new Set<AnchorAuthority>([
  "reader-user",
  "toc",
  "search",
  "explicit-navigation",
]);

const clamp01 = (value: number | undefined) =>
  value === undefined
    ? undefined
    : Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export class AnchorController {
  private persistence?: (anchor: CanonicalAnchor) => void;

  setPersistenceScheduler(scheduler?: (anchor: CanonicalAnchor) => void) {
    this.persistence = scheduler;
  }

  current() {
    return useAnchorStore.getState().canonicalAnchor;
  }

  initialize(candidate: AnchorCandidate) {
    const current = this.current();
    if (current?.documentId === candidate.documentId) return current;
    return this.commit(candidate, "explicit-navigation", false);
  }

  publish(candidate: AnchorCandidate, authority: AnchorAuthority) {
    if (!AUTHORITATIVE.has(authority)) return this.current();
    const state = useAnchorStore.getState();
    if (
      authority === "reader-user" &&
      (state.transition.status === "running" ||
        state.desiredAnchor !== null ||
        (state.canonicalAnchor &&
          state.canonicalAnchor.documentId !== candidate.documentId))
    ) {
      traceAnchor("observation-dropped", {
        reason: "navigation-authority-or-document",
        transitionId: state.transition.id,
      });
      return this.current();
    }
    return this.commit(candidate, authority, true);
  }

  navigate(
    candidate: AnchorCandidate,
    authority: "toc" | "search" | "explicit-navigation",
  ) {
    return this.commit(candidate, authority, false, true);
  }

  completeNavigation(anchor: CanonicalAnchor) {
    useAnchorStore.setState({ desiredAnchor: null });
    return this.commit(
      { ...anchor, revision: undefined },
      "explicit-navigation",
      true,
    );
  }

  private commit(
    candidate: AnchorCandidate,
    authority: AnchorAuthority,
    persist: boolean,
    desired = false,
  ) {
    if (
      !candidate.documentId ||
      !Number.isFinite(candidate.sourcePage) ||
      candidate.sourcePage < 1
    ) {
      if (ANCHOR_DEBUG)
        console.warn("[Anchor] rejected invalid candidate", {
          authority,
          candidate,
        });
      return this.current();
    }
    const current = this.current();
    if (
      current?.documentId === candidate.documentId &&
      candidate.revision !== undefined &&
      candidate.revision < current.revision
    ) {
      if (ANCHOR_DEBUG)
        console.info("[Anchor] rejected stale candidate", {
          incoming: candidate.revision,
          current: current.revision,
        });
      return current;
    }
    const anchor: CanonicalAnchor = {
      documentId: candidate.documentId,
      sourcePage: Math.max(1, Math.round(candidate.sourcePage)),
      sourceBlockId: candidate.sourceBlockId,
      wordIndex:
        candidate.wordIndex === undefined
          ? undefined
          : Math.max(
              0,
              Math.round(
                Number.isFinite(candidate.wordIndex) ? candidate.wordIndex : 0,
              ),
            ),
      characterOffset:
        candidate.characterOffset === undefined
          ? undefined
          : Math.max(
              0,
              Math.round(
                Number.isFinite(candidate.characterOffset)
                  ? candidate.characterOffset
                  : 0,
              ),
            ),
      blockProgress: clamp01(candidate.blockProgress),
      revision: Math.max(
        current?.documentId === candidate.documentId ? current.revision + 1 : 1,
        candidate.revision ?? 0,
      ),
      updatedAt: candidate.updatedAt ?? new Date().toISOString(),
    };
    if (desired) useAnchorStore.setState({ desiredAnchor: anchor });
    else useAnchorStore.getState().setCanonicalAnchor(anchor);
    if (ANCHOR_DEBUG) console.info("[Anchor]", { authority, ...anchor });
    if (persist) this.persistence?.(anchor);
    return anchor;
  }
}

export const anchorController = new AnchorController();
