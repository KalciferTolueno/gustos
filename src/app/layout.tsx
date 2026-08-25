import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "Datito | Encuentra tu próximo panorama",
  description: "Eventos en Chile elegidos segun lo que realmente te gusta.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0b0c0e",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={geist.variable}>
      <body>
        <a className="skip-link" href="#main-content">Saltar al contenido</a>
        {children}
      </body>
    </html>
  );
}
