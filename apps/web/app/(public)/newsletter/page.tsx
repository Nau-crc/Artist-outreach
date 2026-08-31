import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Newsletter — Artist Outreach',
  description: 'Suscríbete voluntariamente a nuestra newsletter para artistas.',
}

export default function NewsletterPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-lg space-y-6 py-16">
        <h1 className="text-4xl font-semibold">Newsletter</h1>
        <p className="text-text-secondary text-lg leading-relaxed">
          Estamos preparando esta página. Pronto podrás decidir voluntariamente si quieres
          recibir nuestros contenidos sobre comunicación para artistas.
        </p>
        <p className="text-sm text-text-muted">
          Placeholder de fase 1. El formulario con double opt-in llegará en fase 4.
        </p>
      </div>
    </main>
  )
}
