import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Painel | CMO",
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
