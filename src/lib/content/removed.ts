// Editorial pages withdrawn for good: Caldera sells Pokémon TCG only, and
// these guides and glossary terms were about other games. No page of the
// site stands for them, so they answer 410 Gone (src/proxy.ts) rather than a
// redirect to /guides or /glossaire, which Google reads as a soft 404.
// Plain data: the proxy reads it without touching the content folder.
export const REMOVED_CONTENT: ReadonlySet<string> = new Set([
  '/guides/debuter-disney-lorcana',
  '/glossaire/encre-lorcana',
  '/guides/debuter-magic-the-gathering',
  '/glossaire/commander-magic',
  '/glossaire/play-booster-magic',
  '/guides/debuter-one-piece-card-game',
  '/glossaire/carte-don-one-piece',
  '/glossaire/leader-one-piece',
  '/guides/debuter-yu-gi-oh',
  '/glossaire/structure-deck-yu-gi-oh',
]);
