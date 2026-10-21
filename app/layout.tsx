import type { Metadata } from "next";
import "./globals.css";
import "./agent-ui.css";

export const metadata: Metadata = {
  title: "CMO — Seu marketing andando",
  description: "Site, estratégia e execução de inbound para empresas B2B sem time de marketing.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
