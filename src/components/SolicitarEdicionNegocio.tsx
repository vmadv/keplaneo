"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export default function SolicitarEdicionNegocio({ lugarId }: { lugarId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEstado("enviando");
    setError(null);
    try {
      const res = await fetch("/api/negocio/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lugarId, email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo enviar");
      }
      setEstado("enviado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
      setEstado("error");
    }
  };

  if (estado === "enviado") {
    return (
      <div className="card-sticker p-4 text-sm">
        Te hemos mandado un enlace a <strong>{email}</strong> para completar la ficha.
      </div>
    );
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="btn-secondary text-sm px-4 py-2">
        <Mail size={14} strokeWidth={2.5} />
        ¿Eres el dueño? Actualiza esta ficha
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card-sticker p-4 flex flex-wrap items-center gap-2">
      <input
        type="email"
        required
        placeholder="tu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 min-w-[180px] rounded-lg px-3 py-2 text-sm"
        style={{ border: "2px solid var(--foreground)" }}
      />
      <button type="submit" disabled={estado === "enviando"} className="btn-primary text-sm px-4 py-2">
        {estado === "enviando" ? "Enviando…" : "Enviar enlace"}
      </button>
      {estado === "error" && (
        <p className="w-full text-sm" style={{ color: "var(--secondary)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
