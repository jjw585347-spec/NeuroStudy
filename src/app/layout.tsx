import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuroStudy | دستیار آموزشی هوشمند چندوجهی",
  description:
    "پلتفرم آموزش تعاملی مبتنی بر هوش مصنوعی با ترکیب توضیحات متنی، تولید تصاویر آموزشی و خروجی صوتی",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
        />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
