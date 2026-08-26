import Image from "next/image";
import { CalendarDays } from "lucide-react";

// Cabecera compartida por el hub del municipio y sus páginas hijas
// (hoy/finde/mes): si hay foto sube a banner con degradado, título
// superpuesto y la fecha como badge en la esquina (más "portada" que
// metida entre paréntesis en el título); si no hay foto, cae al título
// plano con la fecha debajo como texto normal.
export default function HeroPortada({
  imagenHero,
  alt,
  titulo,
  fecha,
}: {
  imagenHero: string | null;
  alt: string;
  titulo: string;
  fecha?: string;
}) {
  if (!imagenHero) {
    return (
      <>
        <h1 className={`text-4xl font-extrabold mt-4 text-balance ${fecha ? "mb-2" : "mb-6"}`}>{titulo}</h1>
        {fecha && (
          <p className="mb-6 text-sm" style={{ color: "var(--muted-foreground)" }}>
            {fecha}
          </p>
        )}
      </>
    );
  }

  return (
    <div
      className="overflow-hidden mt-4 mb-6 relative h-60 sm:h-80 rounded-2xl"
      style={{ border: "2px solid var(--foreground)", boxShadow: "8px 8px 0px 0px var(--border)" }}
    >
      <Image
        src={imagenHero}
        alt={alt}
        fill
        priority
        sizes="(max-width: 768px) 100vw, 768px"
        className="object-cover"
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(30,41,59,0.9) 0%, rgba(30,41,59,0.25) 60%, rgba(30,41,59,0) 100%)" }}
      />
      {fecha && (
        <span
          className="badge-pill absolute top-4 right-4"
          style={{ background: "#fff", color: "var(--foreground)", borderColor: "var(--foreground)" }}
        >
          <CalendarDays size={11} strokeWidth={2.5} className="mr-1" />
          {fecha}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-balance" style={{ color: "#fff" }}>
          {titulo}
        </h1>
      </div>
    </div>
  );
}
