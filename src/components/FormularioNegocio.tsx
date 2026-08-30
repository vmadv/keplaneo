"use client";

import { useState } from "react";
import Image from "next/image";
import { UploadCloud, X } from "lucide-react";
import { urlDeFoto } from "@/lib/places";
import type { FotoLugar, HorarioLugar } from "@/lib/types";

interface LugarBasico {
  id: string;
  nombre: string;
  descripcion: string | null;
  telefono: string | null;
  web: string | null;
  instagram: string | null;
  facebook: string | null;
  enlace_reserva: string | null;
  lema: string | null;
  nivel_precio: string | null;
  horario: HorarioLugar[];
  fotos: FotoLugar[];
}

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const NIVELES_PRECIO = [
  { valor: "", etiqueta: "Sin especificar" },
  { valor: "PRICE_LEVEL_INEXPENSIVE", etiqueta: "€ Económico" },
  { valor: "PRICE_LEVEL_MODERATE", etiqueta: "€€ Moderado" },
  { valor: "PRICE_LEVEL_EXPENSIVE", etiqueta: "€€€ Caro" },
  { valor: "PRICE_LEVEL_VERY_EXPENSIVE", etiqueta: "€€€€ Muy caro" },
];

function identificadorFoto(foto: FotoLugar): string {
  return foto.url ?? foto.nombre ?? "";
}

function horarioInicial(existente: HorarioLugar[]): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const dia of DIAS_SEMANA) {
    const fila = existente.find((h) => h.dia.trim().toLowerCase() === dia.toLowerCase());
    mapa[dia] = fila?.horas ?? "";
  }
  return mapa;
}

export default function FormularioNegocio({ token, lugar }: { token: string; lugar: LugarBasico }) {
  const [lema, setLema] = useState(lugar.lema ?? "");
  const [descripcion, setDescripcion] = useState(lugar.descripcion ?? "");
  const [telefono, setTelefono] = useState(lugar.telefono ?? "");
  const [web, setWeb] = useState(lugar.web ?? "");
  const [instagram, setInstagram] = useState(lugar.instagram ?? "");
  const [facebook, setFacebook] = useState(lugar.facebook ?? "");
  const [enlaceReserva, setEnlaceReserva] = useState(lugar.enlace_reserva ?? "");
  const [nivelPrecio, setNivelPrecio] = useState(lugar.nivel_precio ?? "");
  const [horario, setHorario] = useState<Record<string, string>>(() => horarioInicial(lugar.horario));
  const [fotos, setFotos] = useState<File[]>([]);
  const [fotosAEliminar, setFotosAEliminar] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alternarEliminarFoto = (id: string) => {
    setFotosAEliminar((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    const horarioFinal = DIAS_SEMANA.map((dia) => ({ dia, horas: horario[dia]?.trim() ?? "" })).filter(
      (h) => h.horas.length > 0
    );

    const formData = new FormData();
    formData.append("token", token);
    formData.append("lema", lema);
    formData.append("descripcion", descripcion);
    formData.append("telefono", telefono);
    formData.append("web", web);
    formData.append("instagram", instagram);
    formData.append("facebook", facebook);
    formData.append("enlaceReserva", enlaceReserva);
    formData.append("nivelPrecio", nivelPrecio);
    formData.append("horario", JSON.stringify(horarioFinal));
    formData.append("fotosAEliminar", JSON.stringify([...fotosAEliminar]));
    fotos.forEach((foto) => formData.append("fotos", foto));

    try {
      const res = await fetch("/api/negocio/enviar", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo enviar");
      }
      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div className="card-sticker p-6">
        <h2 className="font-extrabold text-lg mb-2">¡Gracias!</h2>
        <p style={{ color: "var(--muted-foreground)" }}>
          Hemos recibido tus cambios. Los revisaremos antes de publicarlos en la ficha.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card-sticker p-6 grid gap-5">
      <div className="grid gap-2">
        <label className="font-bold text-sm" htmlFor="lema">
          Lema o especialidad (una frase corta)
        </label>
        <input
          id="lema"
          type="text"
          value={lema}
          onChange={(e) => setLema(e.target.value)}
          placeholder="Ej. Especialistas en cirugía de Mohs"
          maxLength={80}
          className="w-full rounded-lg p-3 text-sm"
          style={{ border: "2px solid var(--foreground)" }}
        />
      </div>

      <div className="grid gap-2">
        <label className="font-bold text-sm" htmlFor="descripcion">
          Descripción
        </label>
        <textarea
          id="descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={5}
          className="w-full rounded-lg p-3 text-sm"
          style={{ border: "2px solid var(--foreground)" }}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-5">
        <div className="grid gap-2">
          <label className="font-bold text-sm" htmlFor="telefono">
            Teléfono
          </label>
          <input
            id="telefono"
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="w-full rounded-lg p-3 text-sm"
            style={{ border: "2px solid var(--foreground)" }}
          />
        </div>
        <div className="grid gap-2">
          <label className="font-bold text-sm" htmlFor="web">
            Web
          </label>
          <input
            id="web"
            type="url"
            value={web}
            onChange={(e) => setWeb(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg p-3 text-sm"
            style={{ border: "2px solid var(--foreground)" }}
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 sm:gap-5">
        <div className="grid gap-2">
          <label className="font-bold text-sm" htmlFor="instagram">
            Instagram
          </label>
          <input
            id="instagram"
            type="url"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="https://instagram.com/..."
            className="w-full rounded-lg p-3 text-sm"
            style={{ border: "2px solid var(--foreground)" }}
          />
        </div>
        <div className="grid gap-2">
          <label className="font-bold text-sm" htmlFor="facebook">
            Facebook
          </label>
          <input
            id="facebook"
            type="url"
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            placeholder="https://facebook.com/..."
            className="w-full rounded-lg p-3 text-sm"
            style={{ border: "2px solid var(--foreground)" }}
          />
        </div>
        <div className="grid gap-2">
          <label className="font-bold text-sm" htmlFor="enlaceReserva">
            Reserva: enlace o teléfono
          </label>
          <input
            id="enlaceReserva"
            type="text"
            value={enlaceReserva}
            onChange={(e) => setEnlaceReserva(e.target.value)}
            placeholder="https://... o 600 000 000"
            className="w-full rounded-lg p-3 text-sm"
            style={{ border: "2px solid var(--foreground)" }}
          />
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Se mostrará como un botón destacado de &ldquo;Reservar&rdquo; en tu ficha.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-5">
        <div className="grid gap-2">
          <label className="font-bold text-sm" htmlFor="nivelPrecio">
            Rango de precio
          </label>
          <select
            id="nivelPrecio"
            value={nivelPrecio}
            onChange={(e) => setNivelPrecio(e.target.value)}
            className="w-full rounded-lg p-3 text-sm"
            style={{ border: "2px solid var(--foreground)" }}
          >
            {NIVELES_PRECIO.map((n) => (
              <option key={n.valor} value={n.valor}>
                {n.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        <p className="font-bold text-sm">Horario</p>
        <div className="grid gap-2">
          {DIAS_SEMANA.map((dia) => (
            <div key={dia} className="grid grid-cols-3 gap-3 items-center">
              <label htmlFor={`horario-${dia}`} className="text-sm">
                {dia}
              </label>
              <input
                id={`horario-${dia}`}
                type="text"
                value={horario[dia] ?? ""}
                onChange={(e) => setHorario((prev) => ({ ...prev, [dia]: e.target.value }))}
                placeholder="09:00–21:00 o Cerrado"
                className="col-span-2 w-full rounded-lg p-2 text-sm"
                style={{ border: "2px solid var(--foreground)" }}
              />
            </div>
          ))}
        </div>
      </div>

      {lugar.fotos.length > 0 && (
        <div className="grid gap-2">
          <p className="font-bold text-sm">Fotos actuales</p>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Marca con la X las que quieras quitar de la ficha.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {lugar.fotos.map((foto, i) => {
              const id = identificadorFoto(foto);
              const marcada = fotosAEliminar.has(id);
              return (
                <div
                  key={id || i}
                  className="relative aspect-square rounded-lg overflow-hidden"
                  style={{ border: "2px solid var(--foreground)", opacity: marcada ? 0.4 : 1 }}
                >
                  <Image src={urlDeFoto(foto, 300)} alt="" fill className="object-cover" />
                  <button
                    type="button"
                    onClick={() => alternarEliminarFoto(id)}
                    className="icon-chip absolute top-1 right-1 w-7 h-7"
                    style={{ background: marcada ? "var(--secondary)" : "#fff", borderColor: "var(--foreground)" }}
                    aria-label={marcada ? "Deshacer" : "Quitar foto"}
                  >
                    <X size={14} strokeWidth={2.5} color={marcada ? "#fff" : undefined} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <label className="font-bold text-sm" htmlFor="fotos">
          Fotos nuevas
        </label>
        <label
          htmlFor="fotos"
          className="flex items-center gap-2 justify-center p-6 rounded-lg cursor-pointer text-sm"
          style={{ border: "2px dashed var(--border)", color: "var(--muted-foreground)" }}
        >
          <UploadCloud size={18} strokeWidth={2.5} />
          {fotos.length > 0 ? `${fotos.length} foto(s) seleccionada(s)` : "Elegir fotos"}
        </label>
        <input
          id="fotos"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => setFotos(Array.from(e.target.files ?? []))}
        />
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--secondary)" }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={enviando} className="btn-primary justify-center">
        {enviando ? "Enviando…" : "Enviar para revisión"}
      </button>
    </form>
  );
}
