import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import "./agent-ui.css";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "CMO — Seu marketing andando",
  description: "Site, estratégia e execução de inbound para empresas B2B sem time de marketing.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className={dmSans.variable}><body>{children}</body></html>;
}
