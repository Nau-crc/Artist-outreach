'use client'

import { EditorContent, useEditor } from '@tiptap/react'
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import { RICH_TEXT_VARIABLES, type RichTextEditorProps } from './RichTextEditor.types'

const editorClasses = [
  'tiptap',
  'min-h-[240px] max-h-[600px] overflow-y-auto',
  'p-4 rounded-md border border-border-subtle bg-surface-base text-text-primary',
  'focus:outline-none focus:ring-2 focus:ring-brand-500',
  // Prose reset for tiptap output.
  '[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:mt-3 [&_h2]:mb-2',
  '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6',
  '[&_a]:text-brand-600 [&_a]:underline',
  '[&_h1]:text-2xl [&_h1]:font-semibold',
  '[&_h2]:text-xl [&_h2]:font-semibold',
  '[&_.tpl-var]:bg-brand-100 [&_.tpl-var]:text-brand-700 [&_.tpl-var]:px-2 [&_.tpl-var]:py-0.5',
  '[&_.tpl-var]:rounded [&_.tpl-var]:text-sm [&_.tpl-var]:font-medium',
  '[&_.tpl-var]:whitespace-nowrap',
].join(' ')

export function RichTextEditor({ valueHtml, onChangeHtml, placeholder, testID }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: valueHtml || '<p></p>',
    editorProps: {
      attributes: { class: editorClasses, 'data-testid': testID ?? 'rte' },
    },
    onUpdate({ editor }) {
      onChangeHtml(editor.getHTML())
    },
    immediatelyRender: false,
  })

  // Reset content when the incoming prop changes externally (load / reload).
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (valueHtml && valueHtml !== current) {
      editor.commands.setContent(valueHtml, { emitUpdate: false })
    }
  }, [valueHtml, editor])

  if (!editor) return null

  return (
    <div className="flex flex-col gap-2">
      <Toolbar
        onBold={() => editor.chain().focus().toggleBold().run()}
        onItalic={() => editor.chain().focus().toggleItalic().run()}
        onStrike={() => editor.chain().focus().toggleStrike().run()}
        onH1={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        onH2={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        onBulletList={() => editor.chain().focus().toggleBulletList().run()}
        onOrderedList={() => editor.chain().focus().toggleOrderedList().run()}
        onLink={() => {
          const url = window.prompt('URL:')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }}
        onUnlink={() => editor.chain().focus().unsetLink().run()}
        state={{
          bold: editor.isActive('bold'),
          italic: editor.isActive('italic'),
          strike: editor.isActive('strike'),
          h1: editor.isActive('heading', { level: 1 }),
          h2: editor.isActive('heading', { level: 2 }),
          bulletList: editor.isActive('bulletList'),
          orderedList: editor.isActive('orderedList'),
          link: editor.isActive('link'),
        }}
      />

      <div className="flex flex-row flex-wrap gap-2 pt-1">
        {RICH_TEXT_VARIABLES.map(({ label, variable }) => (
          <button
            key={variable}
            type="button"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertContent(
                  `<span class="tpl-var" data-variable="${variable}">${variable}</span>&nbsp;`,
                )
                .run()
            }
            className="text-xs px-3 py-1 rounded-full bg-surface-subtle text-text-primary hover:bg-surface-muted border border-border-subtle"
          >
            {label}
          </button>
        ))}
      </div>

      {placeholder && !valueHtml && (
        <p className="text-xs text-text-muted">{placeholder}</p>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}

interface ToolbarState {
  bold: boolean
  italic: boolean
  strike: boolean
  h1: boolean
  h2: boolean
  bulletList: boolean
  orderedList: boolean
  link: boolean
}

interface ToolbarProps {
  state: ToolbarState
  onBold: () => void
  onItalic: () => void
  onStrike: () => void
  onH1: () => void
  onH2: () => void
  onBulletList: () => void
  onOrderedList: () => void
  onLink: () => void
  onUnlink: () => void
}

function Toolbar(p: ToolbarProps) {
  return (
    <div className="flex flex-wrap gap-1 border border-border-subtle rounded-md p-1 bg-surface-subtle">
      <ToolButton label="H1" active={p.state.h1} onClick={p.onH1} />
      <ToolButton label="H2" active={p.state.h2} onClick={p.onH2} />
      <Separator />
      <ToolButton label="B" active={p.state.bold} onClick={p.onBold} bold />
      <ToolButton label="I" active={p.state.italic} onClick={p.onItalic} italic />
      <ToolButton label="S" active={p.state.strike} onClick={p.onStrike} strike />
      <Separator />
      <ToolButton label="• Lista" active={p.state.bulletList} onClick={p.onBulletList} />
      <ToolButton label="1. Lista" active={p.state.orderedList} onClick={p.onOrderedList} />
      <Separator />
      <ToolButton label="Enlace" active={p.state.link} onClick={p.onLink} />
      {p.state.link && <ToolButton label="Quitar enlace" onClick={p.onUnlink} />}
    </div>
  )
}

function Separator() {
  return <span aria-hidden className="w-px bg-border-subtle mx-1" />
}

function ToolButton({
  label,
  active,
  onClick,
  bold,
  italic,
  strike,
}: {
  label: string
  active?: boolean
  onClick: () => void
  bold?: boolean
  italic?: boolean
  strike?: boolean
}) {
  const cls = [
    'px-2 py-1 rounded text-sm transition-colors',
    active ? 'bg-brand-500 text-text-inverse' : 'text-text-primary hover:bg-surface-muted',
    bold && 'font-bold',
    italic && 'italic',
    strike && 'line-through',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" onClick={onClick} className={cls}>
      {label}
    </button>
  )
}
