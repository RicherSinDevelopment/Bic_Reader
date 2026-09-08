export type ReaderMode = "reader" | "original";
export type ReaderLayout = "vertical" | "horizontal";

export type AnchorAuthority =
  | "reader-user"
  | "toc"
  | "search"
  | "explicit-navigation"
  | "restore"
  | "layout"
  | "renderer"
  | "original-scroll";

export type MovementSource =
  "user" | "programmatic" | "restore" | "toc" | "search";

export type CanonicalAnchor = {
  documentId: string;
  sourcePage: number;
  sourceBlockId?: string;
  wordIndex?: number;
  characterOffset?: number;
  blockProgress?: number;
  revision: number;
  updatedAt: string;
};

export type TransitionPhase =
  "idle" | "capture" | "prepare" | "layout" | "restore" | "verify";
export type TransitionStatus =
  "idle" | "running" | "complete" | "cancelled" | "failed";

export type TransitionTarget = { mode: ReaderMode; layout: ReaderLayout };

export type TransitionState = {
  id: number;
  phase: TransitionPhase;
  status: TransitionStatus;
  from?: TransitionTarget;
  target?: TransitionTarget;
  error?: string;
};

export type RestoreResult = {
  ok: boolean;
  reason?: string;
  retryable?: boolean;
};
export type AnchorVerificationResult = {
  ok: boolean;
  expected: CanonicalAnchor;
  actual?: CanonicalAnchor;
  reason?: string;
};

export type AnchorCandidate = Omit<
  CanonicalAnchor,
  "revision" | "updatedAt"
> & {
  revision?: number;
  updatedAt?: string;
};

export type AnchorDestination = {
  page: number;
  documentStart?: boolean;
  blockId?: string;
  searchMatchIndex?: number;
  switchHighlightOffset?: number;
  switchHighlightWordIndex?: number;
  switchHighlightWordProgress?: number;
  nonce: number;
};

export interface AnchorAdapter {
  waitUntilReady(
    anchor: CanonicalAnchor,
    transitionId: number,
  ): Promise<boolean>;
  restore(
    anchor: CanonicalAnchor,
    transitionId: number,
  ): Promise<RestoreResult>;
  capture?(): Promise<CanonicalAnchor | null> | CanonicalAnchor | null;
  verify?(
    anchor: CanonicalAnchor,
    transitionId: number,
  ): Promise<AnchorVerificationResult>;
}

export type AnchorAdapterPorts = {
  isReady: (anchor: CanonicalAnchor) => boolean;
  restore: (anchor: CanonicalAnchor, transitionId: number) => void;
  actual: () => CanonicalAnchor | null;
  /**
   * Optional guard so long-running adapter waits (for example verification
   * polling) can bail out the moment the transition they belong to has been
   * superseded or cancelled instead of continuing to wait.
   */
  isTransitionCurrent?: (transitionId: number) => boolean;
};
