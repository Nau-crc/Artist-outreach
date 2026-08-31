import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-semibold">Artist Outreach</h1>
        <p className="text-text-secondary">
          Aplicación interna. Si buscas nuestra newsletter para artistas,{' '}
          <Link href="/newsletter" className="text-brand-600 underline">
            visita esta página
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
