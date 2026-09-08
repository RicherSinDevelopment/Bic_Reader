import { create } from "zustand";
import type {
  CanonicalAnchor,
  ReaderLayout,
  ReaderMode,
  TransitionState,
} from "./AnchorTypes";

type AnchorState = {
  canonicalAnchor: CanonicalAnchor | null;
  desiredAnchor: CanonicalAnchor | null;
  activeMode: ReaderMode;
  activeLayout: ReaderLayout;
  transition: TransitionState;
  setCanonicalAnchor: (anchor: CanonicalAnchor | null) => void;
  setActiveMode: (mode: ReaderMode) => void;
  setActiveLayout: (layout: ReaderLayout) => void;
  setTransition: (transition: TransitionState) => void;
  resetForDocument: (documentId: string) => void;
};

const idleTransition: TransitionState = {
  id: 0,
  phase: "idle",
  status: "idle",
};

export const useAnchorStore = create<AnchorState>((set) => ({
  canonicalAnchor: null,
  desiredAnchor: null,
  activeMode: "reader",
  activeLayout: "vertical",
  transition: idleTransition,
  setCanonicalAnchor: (canonicalAnchor) => set({ canonicalAnchor }),
  setActiveMode: (activeMode) => set({ activeMode }),
  setActiveLayout: (activeLayout) => set({ activeLayout }),
  setTransition: (transition) => set({ transition }),
  resetForDocument: (_documentId) =>
    set(() => ({
      canonicalAnchor: null,
      desiredAnchor: null,
      transition: idleTransition,
    })),
}));

export const anchorStore = useAnchorStore;
