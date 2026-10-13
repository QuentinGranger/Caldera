'use client';
import { useEffect, useState } from 'react';
import { EditorContent, Node, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Plugin } from '@tiptap/pm/state';
import {
  parseCarnetContent,
  moveCarnetCut,
  type CarnetContent,
} from '@/lib/carnets/content';
import { useAdminFormChange } from '../AdminForm';
import styles from './CarnetEditor.module.scss';

const NewsletterCut = Node.create<{ onInvalid: (message: string) => void }>({
  name: 'newsletterCut',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addOptions() {
    return { onInvalid: () => {} };
  },
  parseHTML() {
    return [{ tag: 'div[data-carnet-cut]' }];
  },
  renderHTML() {
    return [
      'div',
      {
        'data-carnet-cut': '',
        contenteditable: 'false',
        role: 'separator',
        'aria-label': 'Fin de l’extrait newsletter',
      },
      '✂ FIN DE L’EXTRAIT NEWSLETTER',
    ];
  },
  addProseMirrorPlugins() {
    const onInvalid = this.options.onInvalid;
    return [
      new Plugin({
        filterTransaction(transaction) {
          if (!transaction.docChanged) return true;
          try {
            parseCarnetContent({
              version: 1,
              document: transaction.doc.toJSON(),
            });
            return true;
          } catch (error) {
            onInvalid(
              error instanceof Error
                ? error.message
                : 'Modification non autorisée dans le récit.',
            );
            return false;
          }
        },
      }),
    ];
  },
});
export default function CarnetNarrativeEditor({
  value,
  onChange,
}: {
  value: CarnetContent;
  onChange: (content: CarnetContent) => void;
}) {
  const mark = useAdminFormChange();
  const [validationError, setValidationError] = useState('');
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        horizontalRule: false,
        link: false,
      }),
      NewsletterCut.configure({ onInvalid: setValidationError }),
    ],
    content: value.document,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': 'Contenu complet du Carnet',
        'aria-multiline': 'true',
        spellcheck: 'true',
      },
    },
    onTransaction: ({ transaction }) => {
      if (transaction.docChanged) setValidationError('');
    },
    onUpdate: ({ editor }) => {
      onChange(parseCarnetContent({ version: 1, document: editor.getJSON() }));
      mark?.();
    },
  });
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive('bold'),
      italic: editor?.isActive('italic'),
      heading: editor?.isActive('heading', { level: 2 }),
      quote: editor?.isActive('blockquote'),
      undo: editor?.can().undo(),
      redo: editor?.can().redo(),
    }),
  });
  useEffect(() => {
    if (editor) {
      const current = parseCarnetContent({
        version: 1,
        document: editor.getJSON(),
      });
      if (JSON.stringify(current) !== JSON.stringify(value))
        editor.commands.setContent(value.document, { emitUpdate: false });
    }
  }, [editor, value]);
  function placeCut() {
    if (!editor) return;
    const doc = parseCarnetContent({ version: 1, document: editor.getJSON() });
    const rootIndex = editor.state.selection.$from.index(0);
    const after =
      doc.document.content
        .slice(0, rootIndex + 1)
        .filter((b) => b.type !== 'newsletterCut').length - 1;
    if (after < 0) return;
    editor.commands.setContent(moveCarnetCut(doc, after).document);
    let pos = 0;
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === 'newsletterCut') pos = offset;
    });
    editor.chain().focus().setNodeSelection(pos).scrollIntoView().run();
  }
  return (
    <div className={styles.narrative}>
      <div
        className={styles.toolbar}
        role="group"
        aria-label="Rédaction du récit"
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
          aria-pressed={Boolean(state?.heading)}
          onClick={() => {
            if (editor?.isActive('blockquote')) {
              setValidationError(
                'Sortez de la citation avant de créer un intertitre.',
              );
              return;
            }
            editor?.chain().focus().toggleHeading({ level: 2 }).run();
          }}
        >
          Intertitre
        </button>
        <button
          type="button"
          aria-pressed={Boolean(state?.quote)}
          onClick={() => {
            if (editor?.isActive('heading')) {
              setValidationError(
                'Une citation contient des paragraphes, pas un intertitre.',
              );
              return;
            }
            editor?.chain().focus().toggleBlockquote().run();
          }}
        >
          Citation
        </button>
        <button
          type="button"
          disabled={!state?.undo}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={!state?.redo}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          Rétablir
        </button>
        <button
          type="button"
          className={styles.cutButton}
          onMouseDown={(e) => e.preventDefault()}
          onClick={placeCut}
        >
          ✂ Coupure après ce paragraphe
        </button>
      </div>
      <EditorContent editor={editor} />
      {validationError && (
        <p className={styles.help} role="alert">
          {validationError}
        </p>
      )}
      <p className={styles.help}>
        Écrivez le récit complet ici. Le séparateur doré délimite l’extrait et
        ne fait pas partie du texte. Vous pouvez le sélectionner et le déplacer
        ; les réglages ci-dessous permettent aussi de le placer au clavier.
      </p>
    </div>
  );
}
