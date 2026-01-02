export const dynamic = 'force-static';

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold">Política de Privacidad</h1>
      <p className="mt-3 text-sm text-neutral-600">Última actualización: {new Date().toISOString().slice(0, 10)}</p>

      <section className="mt-8 space-y-4">
        <p>
          Esta Política de Privacidad describe cómo Agendo ("la App") recopila, usa y protege tu información cuando
          utilizás nuestros servicios.
        </p>

        <h2 className="text-xl font-semibold">Información que recopilamos</h2>
        <p>
          Podemos recopilar información que brindás al registrarte o iniciar sesión (por ejemplo, correo electrónico), y
          datos necesarios para operar la App (por ejemplo, identificadores internos, preferencias y datos asociados a tu
          academia).
        </p>

        <h2 className="text-xl font-semibold">Uso de la información</h2>
        <p>
          Usamos la información para autenticarte, prestar el servicio, mejorar la experiencia, brindar soporte y cumplir
          obligaciones legales.
        </p>

        <h2 className="text-xl font-semibold">Compartición</h2>
        <p>
          No vendemos tu información personal. Podemos compartir información con proveedores necesarios para operar la App
          (por ejemplo, infraestructura, mensajería o servicios de autenticación) únicamente con el fin de prestar el
          servicio.
        </p>

        <h2 className="text-xl font-semibold">Retención</h2>
        <p>
          Conservamos la información mientras sea necesaria para prestar el servicio y/o cumplir obligaciones legales.
        </p>

        <h2 className="text-xl font-semibold">Seguridad</h2>
        <p>
          Implementamos medidas razonables para proteger la información. Sin embargo, ningún sistema es 100% seguro.
        </p>

        <h2 className="text-xl font-semibold">Tus derechos</h2>
        <p>
          Podés solicitar acceso, corrección o eliminación de tus datos, sujeto a las obligaciones legales aplicables.
        </p>

        <h2 className="text-xl font-semibold">Contacto</h2>
        <p>
          Para consultas o solicitudes relacionadas con privacidad, contactanos en{' '}
          <a className="underline" href="mailto:soporte@nativatech.com.py">
            soporte@nativatech.com.py
          </a>
          .
        </p>
      </section>
    </main>
  );
}
