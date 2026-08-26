import Image from "next/image";
import { MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buscarImagenHero } from "@/lib/heroImage";

// Misma convención que HeroPortada (public/municipios/{slug}.webp, subida a
// mano): si hay foto, tarjeta grande con la imagen y el nombre superpuesto;
// si no la hay todavía (la mayoría de municipios piloto), cae al chip de
// icono + texto de siempre en vez de dejar un hueco vacío.
export default function TarjetaCiudad({
  nombre,
  slug,
  href,
  color,
}: {
  nombre: string;
  slug: string;
  href: string;
  color: string;
}) {
  const imagen = buscarImagenHero(slug);

  if (!imagen) {
    return (
      <Link href={href} className="card-sticker flex items-center gap-3 p-5">
        <span className="icon-chip w-10 h-10 shrink-0" style={{ background: color }}>
          <MapPin size={18} strokeWidth={2.5} />
        </span>
        <span className="text-lg font-bold">{nombre}</span>
      </Link>
    );
  }

  return (
    <Link href={href} className="card-sticker overflow-hidden relative h-32 flex items-end p-4">
      <Image src={imagen} alt={nombre} fill sizes="(max-width: 640px) 100vw, 350px" className="object-cover" loading="eager" />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(30,41,59,0.9) 0%, rgba(30,41,59,0.2) 60%, rgba(30,41,59,0) 100%)" }}
      />
      <span className="relative text-lg font-bold" style={{ color: "#fff" }}>
        {nombre}
      </span>
    </Link>
  );
}
