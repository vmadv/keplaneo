import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Star, MapPin, Phone, Globe, Clock, Trophy, BadgeCheck, AtSign, CalendarCheck } from "lucide-react";
import { hrefReserva } from "@/lib/places";
import Breadcrumb from "@/components/Breadcrumb";
import MapaEvento from "@/components/MapaEvento";
import TextoConNegritas from "@/components/TextoConNegritas";
import GaleriaFotos from "@/components/GaleriaFotos";
import SolicitarEdicionNegocio from "@/components/SolicitarEdicionNegocio";
import { getListadosDeLugar, getLugar, getMunicipio } from "@/lib/queries";

export const revalidate = 86400;

async function cargar(comunidadSlug: string, municipioSlug: string, lugarSlug: string) {
  const municipio = await getMunicipio(comunidadSlug, municipioSlug);
  if (!municipio) return null;
  const lugar = await getLugar(municipio.id, lugarSlug);
  if (!lugar) return null;
  const listados = await getListadosDeLugar(lugar.id);
  return { municipio, lugar, listados };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string; lugar: string }>;
}): Promise<Metadata> {
  const { comunidad, municipio, lugar } = await params;
  const datos = await cargar(comunidad, municipio, lugar);
  if (!datos) return {};
  return {
    title: `${datos.lugar.nombre} | Planes España`,
    description: datos.lugar.descripcion ?? datos.lugar.nombre,
  };
}

export default async function LugarPage({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string; lugar: string }>;
}) {
  const { comunidad: comunidadSlug, municipio: municipioSlug, lugar: lugarSlug } = await params;
  const datos = await cargar(comunidadSlug, municipioSlug, lugarSlug);
  if (!datos) notFound();
  const { municipio, lugar, listados } = datos;

  const [tNav, t] = await Promise.all([getTranslations("Nav"), getTranslations("Lugar")]);
  const base = `/rankings/${comunidadSlug}/${municipioSlug}`;

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre },
            { label: municipio.nombre, href: base },
            { label: t("breadcrumb") },
          ]}
        />

        <h1 className="text-4xl font-extrabold mt-4 mb-2 text-balance">{lugar.nombre}</h1>

        {lugar.gestionado_por_negocio && (
          <span
            className="badge-pill inline-flex items-center gap-1 mb-3"
            style={{ background: "var(--quaternary)", borderColor: "var(--foreground)" }}
          >
            <BadgeCheck size={12} strokeWidth={2.5} />
            {t("gestionadoPorNegocio")}
          </span>
        )}

        {lugar.lema && (
          <p className="mb-4 text-lg font-bold" style={{ color: "var(--accent)" }}>
            {lugar.lema}
          </p>
        )}

        {lugar.rating !== null && (
          <p className="mb-6 flex items-center gap-1 font-bold">
            <Star size={16} strokeWidth={0} fill="var(--tertiary)" />
            {t("rating", { rating: lugar.rating.toFixed(1), n: lugar.num_valoraciones ?? 0 })}
          </p>
        )}

        {lugar.enlace_reserva && (
          <a
            href={hrefReserva(lugar.enlace_reserva)}
            target={hrefReserva(lugar.enlace_reserva).startsWith("tel:") ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="btn-primary mb-6"
          >
            <CalendarCheck size={16} strokeWidth={2.5} />
            {t("reservar")}
          </a>
        )}

        <GaleriaFotos fotos={lugar.fotos} nombre={lugar.nombre} />

        {lugar.descripcion && (
          <div className="grid gap-3 mb-8">
            {lugar.descripcion.split("\n\n").filter(Boolean).map((parrafo, i) => (
              <p key={i} className="text-lg text-balance">
                <TextoConNegritas texto={parrafo} />
              </p>
            ))}
          </div>
        )}

        <div className="card-sticker p-5 mb-8 grid gap-3 text-sm">
          {lugar.direccion && (
            <p className="flex items-center gap-2">
              <MapPin size={16} strokeWidth={2.5} style={{ color: "var(--muted-foreground)" }} />
              {lugar.direccion}
            </p>
          )}
          {lugar.telefono && (
            <p className="flex items-center gap-2">
              <Phone size={16} strokeWidth={2.5} style={{ color: "var(--muted-foreground)" }} />
              {lugar.telefono}
            </p>
          )}
          {lugar.web && (
            <p className="flex items-center gap-2">
              <Globe size={16} strokeWidth={2.5} style={{ color: "var(--muted-foreground)" }} />
              <a href={lugar.web} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline decoration-2 underline-offset-2">
                {t("web")}
              </a>
            </p>
          )}
          {lugar.instagram && (
            <p className="flex items-center gap-2">
              <AtSign size={16} strokeWidth={2.5} style={{ color: "var(--muted-foreground)" }} />
              <a href={lugar.instagram} target="_blank" rel="noopener noreferrer" className="hover:underline decoration-2 underline-offset-2">
                Instagram
              </a>
            </p>
          )}
          {lugar.facebook && (
            <p className="flex items-center gap-2">
              <AtSign size={16} strokeWidth={2.5} style={{ color: "var(--muted-foreground)" }} />
              <a href={lugar.facebook} target="_blank" rel="noopener noreferrer" className="hover:underline decoration-2 underline-offset-2">
                Facebook
              </a>
            </p>
          )}
          {lugar.horario.length > 0 && (
            <div className="flex items-start gap-2">
              <Clock size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
              <ul>
                {lugar.horario.map((h, i) => (
                  <li key={i}>
                    <span className="font-medium">{h.dia}:</span> {h.horas}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {lugar.lat !== null && lugar.lon !== null && (
          <div className="card-sticker p-2 mb-8">
            <MapaEvento lat={lugar.lat} lon={lugar.lon} etiqueta={lugar.nombre} direccionTexto={lugar.direccion ?? undefined} />
          </div>
        )}

        <div className="mb-8">
          <SolicitarEdicionNegocio lugarId={lugar.id} />
        </div>

        {listados.length > 0 && (
          <section className="mt-10 pt-8" style={{ borderTop: "2px dashed var(--border)" }}>
            <h2 className="text-lg font-extrabold mb-3">{t("otrosListados")}</h2>
            <div className="flex flex-wrap gap-2">
              {listados.map(({ listado, posicion }) => (
                <Link key={listado.id} href={`${base}/${listado.slug}`} className="btn-secondary text-sm px-4 py-2">
                  <Trophy size={13} strokeWidth={2.5} />
                  {t("puestoEn", { posicion, titulo: listado.titulo })}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
