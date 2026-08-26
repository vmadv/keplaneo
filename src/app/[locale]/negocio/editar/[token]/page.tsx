import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { buscarSolicitudPorToken, enlaceEdicionCaducado } from "@/lib/solicitudesNegocio";
import FormularioNegocio from "@/components/FormularioNegocio";

export const revalidate = 0;

export default async function EditarNegocioPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const solicitud = await buscarSolicitudPorToken(token);
  if (!solicitud || !supabaseAdmin) notFound();

  const { data: lugar } = await supabaseAdmin
    .from("lugares")
    .select("id, nombre, descripcion, telefono, web, instagram, facebook, enlace_reserva, lema, nivel_precio, horario, fotos")
    .eq("id", solicitud.lugar_id)
    .maybeSingle();
  if (!lugar) notFound();

  const contenido = () => {
    if (solicitud.estado === "aprobada") {
      return <Mensaje titulo="Ya se aprobó esta solicitud" texto="Los cambios ya están publicados en la ficha." />;
    }
    if (solicitud.estado === "rechazada") {
      return (
        <Mensaje
          titulo="Esta solicitud fue rechazada"
          texto="Si crees que es un error, pide un enlace nuevo desde la ficha del negocio."
        />
      );
    }
    if (solicitud.estado === "enviada") {
      return (
        <Mensaje
          titulo="Ya has enviado tus cambios"
          texto="Están pendientes de revisión. Te avisaremos si necesitamos algo más."
        />
      );
    }
    if (enlaceEdicionCaducado(solicitud)) {
      return (
        <Mensaje
          titulo="Este enlace ha caducado"
          texto="Pide uno nuevo desde la ficha del negocio — los enlaces son válidos 48 horas."
        />
      );
    }
    return <FormularioNegocio token={token} lugar={lugar} />;
  };

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-extrabold mb-2 text-balance">Actualiza la ficha de {lugar.nombre}</h1>
        <p className="mb-8 text-lg" style={{ color: "var(--muted-foreground)" }}>
          Revisamos los cambios antes de publicarlos — no aparecen al instante.
        </p>
        {contenido()}
      </div>
    </main>
  );
}

function Mensaje({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="card-sticker p-6">
      <h2 className="font-extrabold text-lg mb-2">{titulo}</h2>
      <p style={{ color: "var(--muted-foreground)" }}>{texto}</p>
    </div>
  );
}
