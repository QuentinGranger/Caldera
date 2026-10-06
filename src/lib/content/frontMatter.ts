import { parseDocument } from 'yaml';

/** Parse only YAML front matter. Other engines must never execute content. */
export function parseYamlFrontMatter(source: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const opening = /^(?:\uFEFF)?---[ \t]*\r?\n/.exec(source);
  if (!opening) {
    if (/^(?:\uFEFF)?---[^\r\n]*\r?\n/.test(source))
      throw new Error('seul le front-matter YAML (---) est accepté');
    return { data: {}, content: source };
  }
  const rest = source.slice(opening[0].length);
  const closing = /^---[ \t]*(?:\r?\n|$)/m.exec(rest);
  if (!closing)
    throw new Error('marqueur de fin du front-matter YAML manquant');
  const document = parseDocument(rest.slice(0, closing.index), {
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length) throw document.errors[0];
  const parsed: unknown = document.toJS({ maxAliasCount: 50 });
  if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed)))
    throw new Error('le front-matter YAML doit être un objet');
  return {
    data: (parsed ?? {}) as Record<string, unknown>,
    content: rest.slice(closing.index + closing[0].length),
  };
}
