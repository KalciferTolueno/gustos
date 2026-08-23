"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { ArrowLeft, AtSign, LockKeyhole, UserRound } from "lucide-react";

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

      const result = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/gustos" });
      if (result.error) {
        setError("Correo o contraseña incorrectos.");
        return;
      }
      window.location.href = result.url ?? "/gustos";
    } catch {
      setError("No pudimos conectar con el servidor. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-pitch">
        <Link href="/" className="back-link"><ArrowLeft size={16} /> Volver</Link>
        <div><span>TU RADAR PERSONAL</span><h1>Los eventos<br />te encuentran<br /><em>a ti.</em></h1><p>Guarda tus gustos, ciudad y calendario en todos tus dispositivos.</p></div>
      </section>
      <section className="login-panel">
        <div className="auth-tabs"><button className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setError(""); }}>Entrar</button><button className={mode === "register" ? "selected" : ""} onClick={() => { setMode("register"); setError(""); }}>Crear cuenta</button></div>
        <div className="auth-heading"><span>{mode === "login" ? "BIENVENIDO DE VUELTA" : "ÚNETE A GUSTOS"}</span><h2>{mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}</h2></div>
        <form action={submit} className="auth-form">
          {mode === "register" && <label><span>Nombre</span><div><UserRound size={18} /><input name="name" autoComplete="name" minLength={2} maxLength={80} required /></div></label>}
          <label><span>Correo electrónico</span><div><AtSign size={18} /><input name="email" type="email" autoComplete="email" required /></div></label>
          <label><span>Contraseña</span><div><LockKeyhole size={18} /><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 12 : 1} maxLength={200} required /></div></label>
          {mode === "register" && <small>12 caracteres como mínimo, con letras y números.</small>}
          {error && <div className="form-error">{error}</div>}
          <button disabled={loading}>{loading ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}</button>
        </form>
        {(google || discord) && <><div className="auth-divider"><span>o continúa con</span></div><div className="social-login">{google && <button onClick={() => signIn("google", { callbackUrl: "/gustos" })}>Google</button>}{discord && <button onClick={() => signIn("discord", { callbackUrl: "/gustos" })}>Discord</button>}</div></>}
      </section>
    </main>
  );
}
