import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Q Reading",
  description: "上传英文文本，点击任意单词即可标注中文释义，支持全文词根批量标注",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4a90d9" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body style={{ height: "100vh", overflow: "hidden" }}>{children}</body>
    </html>
  );
}
