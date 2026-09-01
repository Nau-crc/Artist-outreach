'use client'

const previewClasses = [
  'text-sm text-text-primary leading-6',
  '[&_p]:my-2',
  '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6',
  '[&_a]:text-brand-600 [&_a]:underline',
  '[&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-3',
  '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-2',
  '[&_strong]:font-semibold',
  '[&_em]:italic',
  '[&_.tpl-var]:bg-brand-100 [&_.tpl-var]:text-brand-700 [&_.tpl-var]:px-2 [&_.tpl-var]:py-0.5',
  '[&_.tpl-var]:rounded [&_.tpl-var]:text-sm [&_.tpl-var]:font-medium',
].join(' ')

export function PreviewRenderer({ html }: { html: string }) {
  return <div className={previewClasses} dangerouslySetInnerHTML={{ __html: html }} />
}
