type Rect = { left: number; top: number; width: number; height: number };

/** Non-overlapping panels covering everything except the highlighted fragments. */
export function guideFragmentDimming(width: number, height: number, fragments: Rect[]): Rect[] {
  const holes = fragments.filter(rect => [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite))
    .map(rect => ({
      left: Math.max(0, rect.left), top: Math.max(0, rect.top),
      right: Math.min(width, rect.left + rect.width),
      bottom: Math.min(height, rect.top + rect.height),
    })).filter(rect => rect.right > rect.left && rect.bottom > rect.top);
  const edges = [...new Set([0, height, ...holes.flatMap(rect => [rect.top, rect.bottom])])].sort((a, b) => a - b);
  const panels: Rect[] = [];
  for (let i = 1; i < edges.length; i++) {
    const top = edges[i - 1], bottom = edges[i];
    const row = holes.filter(rect => rect.top < bottom && rect.bottom > top).sort((a, b) => a.left - b.left);
    let left = 0;
    for (const hole of row) {
      if (hole.left > left) panels.push({ left, top, width: hole.left - left, height: bottom - top });
      left = Math.max(left, hole.right);
    }
    if (left < width) panels.push({ left, top, width: width - left, height: bottom - top });
  }
  return panels;
}
