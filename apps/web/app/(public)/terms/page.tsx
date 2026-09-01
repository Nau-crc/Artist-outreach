import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Términos — Artist Outreach',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-surface-base text-text-primary px-6 py-12">
      <article className="max-w-2xl mx-auto flex flex-col gap-4 leading-relaxed">
        <h1 className="text-3xl font-semibold">Términos de uso</h1>
        <p className="text-sm text-text-muted">Última actualización: 2026-09-01.</p>

        <p>
          Placeholder de términos. Aquí describiremos las condiciones de uso de la newsletter y cualquier acceso a nuestros contenidos.
        </p>

        <p className="mt-8">
          <Link href="/newsletter" className="underline">
            Volver
          </Link>
        </p>
      </article>
    </main>
  )
}
