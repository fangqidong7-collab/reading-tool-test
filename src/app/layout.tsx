import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "英语阅读标注助手",
  description: "上传英文文本，点击任意单词即可标注中文释义，支持全文词根批量标注",
  other: {
    manifest: "/manifest.json",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body style={{ height: "100vh", overflow: "hidden" }}>{children}</body>
    </html>
  );
}
