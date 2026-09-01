import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacidad — Artist Outreach',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-surface-base text-text-primary px-6 py-12">
      <article className="max-w-2xl mx-auto flex flex-col gap-4 leading-relaxed">
        <h1 className="text-3xl font-semibold">Política de privacidad</h1>
        <p className="text-sm text-text-muted">Última actualización: 2026-09-01.</p>

        <p>
          Este documento describe cómo tratamos tus datos personales cuando te suscribes a nuestra newsletter para artistas.
        </p>

        <h2 className="text-xl font-semibold mt-4">Qué datos recogemos</h2>
        <p>Solo tu email. No pedimos ni almacenamos otros datos personales.</p>

        <h2 className="text-xl font-semibold mt-4">Para qué los usamos</h2>
        <p>Enviarte los emails de la newsletter y confirmar tu suscripción mediante doble opt-in.</p>

        <h2 className="text-xl font-semibold mt-4">Cuánto tiempo</h2>
        <p>Mientras sigas suscrito. Al darte de baja añadimos tu email a una lista de supresión para no volver a contactarte, pero eliminamos los datos que ya no son necesarios.</p>

        <h2 className="text-xl font-semibold mt-4">Tus derechos</h2>
        <p>
          Puedes darte de baja en cualquier momento con el enlace incluido en cada email. Si quieres que borremos también tu email de la lista de supresión, escríbenos.
        </p>

        <h2 className="text-xl font-semibold mt-4">Contacto</h2>
        <p>
          Placeholder: aquí irá la dirección de contacto y datos legales del responsable del tratamiento.
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
