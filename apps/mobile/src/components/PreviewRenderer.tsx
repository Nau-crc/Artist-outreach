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
  // Variable inline pill (artistName).
  '[&_.tpl-var]:bg-brand-100 [&_.tpl-var]:text-brand-700 [&_.tpl-var]:px-2 [&_.tpl-var]:py-0.5',
  '[&_.tpl-var]:rounded [&_.tpl-var]:text-sm [&_.tpl-var]:font-medium [&_.tpl-var]:no-underline',
  // CTA button.
  '[&_.tpl-cta]:inline-block [&_.tpl-cta]:bg-brand-500 [&_.tpl-cta]:text-text-inverse',
  '[&_.tpl-cta]:px-6 [&_.tpl-cta]:py-3 [&_.tpl-cta]:rounded-md [&_.tpl-cta]:no-underline',
  '[&_.tpl-cta]:font-semibold',
  // Unsub link (footer style).
  '[&_.tpl-unsub]:text-text-muted [&_.tpl-unsub]:text-xs [&_.tpl-unsub]:underline',
].join(' ')

export function PreviewRenderer({ html }: { html: string }) {
  return <div className={previewClasses} dangerouslySetInnerHTML={{ __html: html }} />
}
