import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "人生ドラフト | Life Draft Card Game",
  description: "3〜6人で集まり、人生の選択や習慣をドラフトしながら、お互いの未来を語り合い、賞を贈り合うカードゲームのWebシミュレーター",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
