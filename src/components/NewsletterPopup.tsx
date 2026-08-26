"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Mail, X } from "lucide-react";

const CLAVE_DESCARTADO = "planes-newsletter-descartado";
const RETRASO_MS = 5000;

// Solo captura el interés (guarda el email en Supabase vía /api/suscribirse)
// — no manda ningún correo todavía, eso es una fase aparte. Aparece una
// sola vez por navegador (localStorage), a los 5s, y nunca vuelve a
// molestar si se cierra o ya se suscribió.
export default function NewsletterPopup({
  municipioId,
  municipioNombre,
}: {
  municipioId: string;
  municipioNombre: string;
}) {
  const t = useTranslations("Newsletter");
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "exito" | "error">("idle");

  useEffect(() => {
    if (localStorage.getItem(CLAVE_DESCARTADO)) return;
    const temporizador = setTimeout(() => setVisible(true), RETRASO_MS);
    return () => clearTimeout(temporizador);
  }, []);

  function cerrar() {
    setVisible(false);
    localStorage.setItem(CLAVE_DESCARTADO, "1");
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    try {
      const res = await fetch("/api/suscribirse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, municipioId }),
      });
      if (!res.ok) throw new Error();
      setEstado("exito");
      localStorage.setItem(CLAVE_DESCARTADO, "1");
    } catch {
      setEstado("error");
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-40">
      <div className="card-sticker p-5 relative">
        <button
          onClick={cerrar}
          aria-label={t("cerrar")}
          className="absolute top-3 right-3 p-1 rounded-full hover:opacity-70"
        >
          <X size={16} strokeWidth={2.5} />
        </button>

        {estado === "exito" ? (
          <p className="font-bold pr-6">{t("exito", { municipio: municipioNombre })}</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1.5 pr-6">
              <span className="icon-chip w-8 h-8 shrink-0" style={{ background: "var(--tertiary)" }}>
                <Mail size={15} strokeWidth={2.5} />
              </span>
              <p className="font-extrabold text-sm">{t("titulo", { municipio: municipioNombre })}</p>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
              {t("descripcion")}
            </p>
            <form onSubmit={enviar} className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("placeholder")}
                className="flex-1 min-w-0 px-3 py-2 text-sm rounded-full"
                style={{ border: "2px solid var(--foreground)" }}
              />
              <button type="submit" disabled={estado === "enviando"} className="btn-primary text-sm px-4 py-2 shrink-0">
                {estado === "enviando" ? t("enviando") : t("boton")}
              </button>
            </form>
            {estado === "error" && (
              <p className="text-xs mt-2" style={{ color: "var(--secondary)" }}>
                {t("error")}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
