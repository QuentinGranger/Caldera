'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_MAX_ENTRIES,
  FAQ_MAX_LENGTH,
  FAQ_QUESTION_MAX_LENGTH,
} from '@/lib/admin/limits';
import {
  parseFaqDrafts,
  serializeFaqDrafts,
  type FaqDraft,
} from '@/lib/admin/faq-editor';
import styles from './Admin.module.scss';

export function FaqEditor({ initialValue }: { initialValue: string }) {
  const [drafts, setDrafts] = useState<FaqDraft[]>(() =>
    parseFaqDrafts(initialValue),
  );
  const [focusId, setFocusId] = useState<number | null>(null);
  const nextId = useRef(Math.max(0, ...drafts.map(({ id }) => id + 1)));
  const newQuestion = useRef<HTMLInputElement>(null);
  const serialized = serializeFaqDrafts(drafts);

  useEffect(() => {
    if (focusId === null) return;
    newQuestion.current?.focus();
  }, [focusId]);

  function update(id: number, key: 'question' | 'answer', value: string) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id ? { ...draft, [key]: value } : draft,
      ),
    );
  }

  function move(index: number, direction: -1 | 1) {
    setDrafts((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  return (
    <section
      className={`${styles.full} ${styles.faqEditor}`}
      aria-label="Questions fréquentes"
    >
      <div className={styles.faqEditorHeading}>
        <div>
          <h3>Questions fréquentes</h3>
          <p>
            Ces réponses apparaissent sur cette page, dans l’ordre indiqué.
            Rédigez-les au vouvoiement.
          </p>
        </div>
        <span>
          {drafts.length} / {FAQ_MAX_ENTRIES}
        </span>
      </div>
      <input type="hidden" name="faq" value={serialized} />
      {drafts.length ? (
        <div className={styles.faqEntries}>
          {drafts.map((draft, index) => (
            <fieldset key={draft.id} className={styles.faqEntry}>
              <legend>Question {index + 1}</legend>
              <div className={styles.faqTools}>
                <button
                  type="button"
                  className={styles.quietButton}
                  aria-label={`Monter la question ${index + 1}`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.quietButton}
                  aria-label={`Descendre la question ${index + 1}`}
                  disabled={index === drafts.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`${styles.quietButton} ${styles.faqRemove}`}
                  aria-label={`Retirer la question ${index + 1}`}
                  onClick={() =>
                    setDrafts((current) =>
                      current.filter((entry) => entry.id !== draft.id),
                    )
                  }
                >
                  <Trash2 size={16} aria-hidden="true" />
                  <span>Retirer</span>
                </button>
              </div>
              <div className={styles.faqFields}>
                <label>
                  Question
                  <input
                    ref={draft.id === focusId ? newQuestion : undefined}
                    value={draft.question}
                    maxLength={FAQ_QUESTION_MAX_LENGTH}
                    required
                    onChange={(event) =>
                      update(draft.id, 'question', event.target.value)
                    }
                  />
                </label>
                <label>
                  Réponse
                  <textarea
                    value={draft.answer}
                    rows={3}
                    maxLength={FAQ_ANSWER_MAX_LENGTH}
                    required
                    onChange={(event) =>
                      update(draft.id, 'answer', event.target.value)
                    }
                  />
                </label>
              </div>
            </fieldset>
          ))}
        </div>
      ) : (
        <p className={styles.faqEmpty}>Aucune question pour cette page.</p>
      )}
      <div className={styles.faqFooter}>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={drafts.length >= FAQ_MAX_ENTRIES}
          onClick={() => {
            const id = nextId.current++;
            setFocusId(id);
            setDrafts((current) => [
              ...current,
              { id, question: '', answer: '' },
            ]);
          }}
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter une question
        </button>
        <small
          className={
            serialized.length > FAQ_MAX_LENGTH ? styles.errorText : undefined
          }
        >
          {serialized.length.toLocaleString('fr-FR')} /{' '}
          {FAQ_MAX_LENGTH.toLocaleString('fr-FR')} caractères · Suppression et
          ordre appliqués après enregistrement.
        </small>
      </div>
    </section>
  );
}
