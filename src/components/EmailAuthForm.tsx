"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { AtSign, LockKeyhole, UserRound } from "lucide-react";

export function EmailAuthForm({ google, discord }: { google: boolean; discord: boolean }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      const email = String(formData.get("email"));
      const password = String(formData.get("password"));

      if (mode === "register") {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: formData.get("name"), email, password }),
        });
        if (!response.ok) {
          const result = await response.json();
          setError(result.error ?? "No se pudo crear la cuenta.");
          return;
        }
      }

      const result = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/" });
      if (result.error) {
        setError("Correo o contraseña incorrectos.");
        return;
      }
      window.location.href = result.url ?? "/";
    } catch {
      setError("No pudimos conectar con el servidor. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
      <section className="login-panel embedded-login" aria-labelledby="auth-title">
        <div className="auth-tabs" role="tablist" aria-label="Acceso a tu cuenta"><button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setError(""); }}>Entrar</button><button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "selected" : ""} onClick={() => { setMode("register"); setError(""); }}>Crear Cuenta</button></div>
        <div className="auth-heading"><span>{mode === "login" ? "BIENVENIDO DE VUELTA" : "ÚNETE A DATITO"}</span><h2 id="auth-title">{mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}</h2></div>
        <form action={submit} className="auth-form" aria-labelledby="auth-title">
          {mode === "register" && <label><span>Nombre</span><div><UserRound size={18} aria-hidden="true" /><input name="name" autoComplete="name" minLength={2} maxLength={80} required /></div></label>}
          <label><span>Correo electrónico</span><div><AtSign size={18} aria-hidden="true" /><input name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} required /></div></label>
          <label><span>Contraseña</span><div><LockKeyhole size={18} aria-hidden="true" /><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 12 : 1} maxLength={200} required /></div></label>
          {mode === "register" && <small>12 caracteres como mínimo, con letras y números.</small>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button type="submit" disabled={loading}>{loading ? "Procesando…" : mode === "login" ? "Entrar" : "Crear Cuenta"}</button>
        </form>
        {(google || discord) && <><div className="auth-divider"><span>o continúa con</span></div><div className="social-login">{google && <button type="button" onClick={() => signIn("google", { callbackUrl: "/" })}>Google</button>}{discord && <button type="button" onClick={() => signIn("discord", { callbackUrl: "/" })}>Discord</button>}</div></>}
      </section>
  );
}
