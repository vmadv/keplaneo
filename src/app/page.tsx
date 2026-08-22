import Link from "next/link";
import { getComunidades } from "@/lib/queries";

export const revalidate = 86400;

export default async function HomePage() {
  const comunidades = await getComunidades();

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">Planes España</h1>
      <p className="text-slate-600 mb-10">
        Qué hacer hoy, este fin de semana o este mes, municipio a municipio.
      </p>

      {comunidades.length === 0 ? (
        <p className="text-slate-500">
          Todavía no hay comunidades cargadas. Ejecuta{" "}
          <code>supabase/seed.sql</code> para dar de alta la fase piloto.
        </p>
      ) : (
        <ul className="grid gap-2">
          {comunidades.map((c) => (
            <li key={c.id}>
              <Link href={`/${c.slug}`} className="text-lg hover:underline">
                {c.nombre}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
