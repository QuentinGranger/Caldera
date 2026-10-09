export const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** A pinned scene measures its travel; an ordinary scene measures its passage. */
export function sceneProgress(
  top: number,
  height: number,
  viewport: number,
  pinned: boolean,
) {
  if (
    ![top, height, viewport].every(Number.isFinite) ||
    height <= 0 ||
    viewport <= 0
  )
    return 0;
  return pinned && height > viewport
    ? clamp(-top / (height - viewport))
    : clamp((viewport - top) / (viewport + height));
}

/** Adjacent chapters crossfade; their weights always add up to one. */
export function sceneBeats(progress: number, count: number) {
  const cursor = clamp(progress) * Math.max(0, count - 1);
  return Array.from({ length: count }, (_, index) =>
    Math.max(0, 1 - Math.abs(cursor - index)),
  );
}

export function storyBlend(progress: number) {
  const value = clamp((progress - 0.18) / 0.22);
  return value * value * (3 - 2 * value);
}

/** Hold each word, then move to the next one without superimposing lettering. */
export function storyPosition(progress: number) {
  const cursor = clamp((progress - 0.4) / 0.6) * 3;
  const whole = Math.floor(cursor);
  const fraction = clamp((cursor - whole - 0.25) / 0.5);
  return whole + fraction * fraction * (3 - 2 * fraction);
}
