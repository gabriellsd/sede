import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";

const discord = Noto_Sans({
  variable: "--font-discord",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sede",
  description: "Servidor da empresa — canais, cargos e voz.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${discord.variable} h-full`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
