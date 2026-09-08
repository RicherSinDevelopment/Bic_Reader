import { anchorController } from "@/architecture/anchor/AnchorController";
import { useAnchorStore } from "@/architecture/anchor/AnchorStore";
import type { CanonicalAnchor } from "@/architecture/anchor/AnchorTypes";
import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import { useCallback, useEffect, useMemo, useRef } from "react";

export function useReaderAnchor(input: {
  documentId?: string;
  isActive: boolean;
  blocks: ExtractedPdfBlock[];
  isRotationInProgress?: () => boolean;
}) {
  const { documentId, isRotationInProgress } = input;
  const actualReaderAnchor = useRef<CanonicalAnchor | null>(null);
  const blockIndex = useMemo(
    () => new Map(input.blocks.map((block) => [block.id, block])),
    [input.blocks],
  );
  const wordCache = useRef(
    new Map<string, { text: string; words: RegExpMatchArray[] }>(),
  );
  const latestBlocks = useRef(blockIndex);
  const active = useRef(input.isActive);
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  latestBlocks.current = blockIndex;
  active.current = input.isActive;

  useEffect(() => {
    if (publishTimer.current) clearTimeout(publishTimer.current);
    publishTimer.current = null;
    actualReaderAnchor.current = null;
    wordCache.current.clear();
    return () => {
      if (publishTimer.current) clearTimeout(publishTimer.current);
    };
  }, [documentId]);

  const reportReaderAnchor = useCallback(
    (blockId: string, _word: string, wordIndex: number) => {
      if (!documentId || !active.current) return;
      if (
        isRotationInProgress?.() &&
        useAnchorStore.getState().transition.status !== "running"
      ) {
        if (publishTimer.current) clearTimeout(publishTimer.current);
        publishTimer.current = null;
        return;
      }
      const block = latestBlocks.current.get(blockId);
      if (!block) return;
      let cached = wordCache.current.get(blockId);
      if (!cached || cached.text !== block.text) {
        cached = {
          text: block.text,
          words: Array.from(block.text.matchAll(/\S+/g)),
        };
        wordCache.current.set(blockId, cached);
      }
      const words = cached.words;
      const exactIndex = Math.max(
        0,
        Math.min(Math.max(0, words.length - 1), wordIndex),
      );
      const progress = words.length > 1 ? exactIndex / (words.length - 1) : 0;
      actualReaderAnchor.current = {
        documentId: documentId,
        sourcePage: block.page,
        sourceBlockId: block.id,
        wordIndex: exactIndex,
        characterOffset: words[exactIndex]?.index ?? 0,
        blockProgress: progress,
        revision: anchorController.current()?.revision ?? 0,
        updatedAt: new Date().toISOString(),
      };
      if (useAnchorStore.getState().transition.status === "running") return;
      const current = anchorController.current();
      if (
        current?.documentId === documentId &&
        current.sourceBlockId === block.id &&
        (current.wordIndex === exactIndex ||
          Math.abs((current.blockProgress ?? 0) - progress) < 0.015)
      )
        return;
      if (publishTimer.current) clearTimeout(publishTimer.current);
      const transitionId = useAnchorStore.getState().transition.id;
      publishTimer.current = setTimeout(() => {
        publishTimer.current = null;
        const latest = actualReaderAnchor.current;
        if (
          latest &&
          active.current &&
          useAnchorStore.getState().transition.id === transitionId &&
          useAnchorStore.getState().transition.status !== "running"
        )
          anchorController.publish(latest, "reader-user");
      }, 220);
    },
    [documentId, isRotationInProgress],
  );

  return { actualReaderAnchor, reportReaderAnchor };
}
