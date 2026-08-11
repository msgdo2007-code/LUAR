import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LUAR Admin", template: "%s · LUAR Admin" },
  description: "Painel administrativo protegido do LUAR.",
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
