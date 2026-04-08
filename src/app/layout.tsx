import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "英语阅读标注助手",
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
        {/* JSZip for EPUB parsing */}
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" strategy="lazyOnload" />
        {/* PDF.js for PDF parsing */}
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js" strategy="lazyOnload" />
      </head>
      <body>{children}</body>
    </html>
  );
}
