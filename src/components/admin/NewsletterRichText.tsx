'use client';
import { useEffect, useId, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { safeNewsletterLink } from '@/lib/newsletter/document';
import { useAdminFormChange } from './AdminForm';
import styles from './NewsletterCampaignEditor.module.scss';

/** Structured visual editing; only Markdown enters the existing safe renderer. */
export default function NewsletterRichText({
  value,
  onChange,
  maxLength = 20000,
  label = 'Message',
}: {
  value: string;
  onChange: (text: string) => void;
  maxLength?: number;
  label?: string;
}) {
  const mark = useAdminFormChange();
  const id = useId();
  const unsupported =
    /<[^>]+>|!\[|`|~~|^\s*(?:\||---+\s*$|\*\*\*+\s*$|___+\s*$|#\s|#{4,6}\s|[-*+]\s+\[[ xX]\])/m.test(
      value,
    );
  const [source, setSource] = useState(unsupported);
  const markdownMode = source || unsupported;
  const [link, setLink] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [error, setError] = useState('');
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: false,
          protocols: ['https'],
          isAllowedUri: (url) => Boolean(safeNewsletterLink(url)),
        },
      }),
      Markdown,
    ],
    content: value,
    contentType: 'markdown',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getMarkdown();
      if (text.length > maxLength)
        setError(
          `Le texte dépasse ${maxLength.toLocaleString('fr')} caractères. Réduisez-le avant d’enregistrer.`,
        );
      else setError('');
      onChange(text);
      mark?.();
    },
  });
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive('bold'),
      italic: editor?.isActive('italic'),
      h2: editor?.isActive('heading', { level: 2 }),
      h3: editor?.isActive('heading', { level: 3 }),
      list: editor?.isActive('bulletList'),
      ordered: editor?.isActive('orderedList'),
      quote: editor?.isActive('blockquote'),
      link: editor?.isActive('link'),
    }),
  });
  useEffect(() => {
    if (editor && editor.getMarkdown() !== value)
      editor.commands.setContent(value, {
        contentType: 'markdown',
        emitUpdate: false,
      });
  }, [editor, value]);
  return (
    <div className={styles.richEditor}>
      <div className={styles.richTop}>
        <strong>{label}</strong>
        <div role="group" aria-label="Mode de rédaction">
          <button
            type="button"
            aria-pressed={!markdownMode}
            disabled={unsupported}
            onClick={() => setSource(false)}
          >
            Visuel
          </button>
          <button
            type="button"
            aria-pressed={markdownMode}
            onClick={() => setSource(true)}
          >
            Markdown
          </button>
        </div>
      </div>
      {!markdownMode && (
        <div
          className={styles.toolbar}
          role="group"
          aria-label={`Mise en forme : ${label}`}
        >
          <button
            type="button"
            aria-pressed={Boolean(state?.bold)}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <b>Gras</b>
          </button>
          <button
            type="button"
            aria-pressed={Boolean(state?.italic)}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <i>Italique</i>
          </button>
          <button
            type="button"
            aria-pressed={Boolean(state?.h2)}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            H2
          </button>
          <button
            type="button"
            aria-pressed={Boolean(state?.h3)}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            H3
          </button>
          <button
            type="button"
            aria-pressed={Boolean(state?.list)}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            Liste
          </button>
          <button
            type="button"
            aria-pressed={Boolean(state?.ordered)}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            1. Liste
          </button>
          <button
            type="button"
            aria-pressed={Boolean(state?.quote)}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            Citation
          </button>
          <button
            type="button"
            aria-pressed={Boolean(state?.link)}
            aria-expanded={linkOpen}
            onClick={() => {
              setLink(String(editor?.getAttributes('link').href ?? ''));
              setLinkOpen((v) => !v);
            }}
          >
            Lien
          </button>
          <button
            type="button"
            onClick={() =>
              editor?.chain().focus().unsetAllMarks().clearNodes().run()
            }
          >
            Effacer le format
          </button>
        </div>
      )}
      {!markdownMode && linkOpen && (
        <div className={styles.linkEditor}>
          <label htmlFor={id}>
            Destination du lien
            <input
              id={id}
              value={link}
              maxLength={500}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://… ou /catalogue"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (!safeNewsletterLink(link)) {
                setError('Utilisez une page du site ou un lien HTTPS valide.');
                return;
              }
              editor
                ?.chain()
                .focus()
                .extendMarkRange('link')
                .setLink({ href: link })
                .run();
              setLinkOpen(false);
              setError('');
            }}
          >
            Appliquer
          </button>
          <button
            type="button"
            onClick={() => {
              editor?.chain().focus().extendMarkRange('link').unsetLink().run();
              setLinkOpen(false);
              setError('');
            }}
          >
            Retirer
          </button>
        </div>
      )}
      {markdownMode ? (
        <textarea
          aria-label={`${label} en Markdown`}
          rows={8}
          value={value}
          maxLength={maxLength}
          onChange={(e) => {
            onChange(e.target.value);
            mark?.();
            setError('');
          }}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
      <small>
        {value.length.toLocaleString('fr')}/{maxLength.toLocaleString('fr')}{' '}
        caractères ·{' '}
        {markdownMode
          ? 'Le Markdown original reste accessible.'
          : 'Sélectionnez du texte pour le mettre en forme.'}
      </small>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
