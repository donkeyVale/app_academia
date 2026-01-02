export const dynamic = 'force-static';

export default function SupportPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold">Soporte</h1>
      <p className="mt-3 text-neutral-700">
        Si necesitás ayuda con Agendo, podés contactarnos por correo.
      </p>

      <section className="mt-8 space-y-4">
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-semibold">Contacto</h2>
          <p className="mt-2">
            Email:{' '}
            <a className="underline" href="mailto:soporte@nativatech.com.py">
              soporte@nativatech.com.py
            </a>
          </p>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-semibold">Sugerencias</h2>
          <p className="mt-2 text-neutral-700">
            Incluí capturas de pantalla y los pasos para reproducir el problema.
          </p>
        </div>
      </section>
    </main>
  );
}
