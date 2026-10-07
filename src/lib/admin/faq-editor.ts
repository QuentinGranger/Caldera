import { FAQ_SEPARATOR } from './limits';

export type FaqDraft = { id: number; question: string; answer: string };

/** Decode the existing admin field without changing the stored FAQ format. */
export function parseFaqDrafts(value: string): FaqDraft[] {
  return value.split(/\r?\n/).flatMap((line, id) => {
    if (!line.trim()) return [];
    const separator = line.indexOf(FAQ_SEPARATOR);
    if (separator < 0) return [];
    return [
      {
        id,
        question: line.slice(0, separator).trim(),
        answer: line.slice(separator + FAQ_SEPARATOR.length).trim(),
      },
    ];
  });
}

/** Preserve the server parser contract while allowing multiline answer fields. */
export function serializeFaqDrafts(drafts: FaqDraft[]): string {
  return drafts
    .map(
      ({ question, answer }) =>
        `${question.trim().replaceAll(FAQ_SEPARATOR, ':').replace(/\s+/g, ' ')} ${FAQ_SEPARATOR} ${answer.trim().replace(/\s+/g, ' ')}`,
    )
    .join('\n');
}
