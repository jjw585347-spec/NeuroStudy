"use client";

import React, { useEffect, useRef, useState } from "react";
import { GitBranch, ZoomIn, ZoomOut, RotateCcw, Copy, Check } from "lucide-react";

interface MermaidViewerProps {
  chart: string;
  title?: string;
}

/**
 * تصحیح و استانداردسازی خودکار کدهای دیاگرام برای جلوگیری از ارور سینتکس مِرمِید
 */
function sanitizeMermaidChart(raw: string): string {
  if (!raw) return "";
  let clean = raw.trim();

  // حذف فنس‌های مارک‌داون
  clean = clean
    .replace(/^```mermaid\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim();

  // قرار دادن متن‌های دارای پرانتز، دونقطه یا کاراکترهای خاص درون دابل کوتیشن ["..."]
  // مثلا تبدیل: D --> D1[تایتان (بزرگ‌ترین قمر)] به: D --> D1["تایتان (بزرگ‌ترین قمر)"]
  clean = clean.replace(/\[\s*([^"\]\n]+?)\s*\]/g, (_, inner) => {
    const safe = inner.replace(/"/g, "'").trim();
    return `["${safe}"]`;
  });

  return clean;
}

export default function MermaidViewer({
  chart,
  title = "دیاگرام مفهومی و گام‌به‌گام درس",
}: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const renderChart = async () => {
      const sanitized = sanitizeMermaidChart(chart);
      if (!sanitized) return;
      setHasError(false);

      try {
        const { default: mermaid } = await import("mermaid");
        if (isCancelled) return;

        mermaid.initialize({
          startOnLoad: false,
          suppressErrorRendering: true, // جلوگیری از رندر ایکون بمب و ارور سینتکس در صفحه
          theme: "dark",
          themeVariables: {
            darkMode: true,
            background: "#090d16",
            primaryColor: "#4f46e5",
            primaryTextColor: "#f8fafc",
            primaryBorderColor: "#6366f1",
            lineColor: "#818cf8",
            secondaryColor: "#312e81",
            tertiaryColor: "#1e1b4b",
          },
          securityLevel: "loose",
          fontFamily: "Vazirmatn, Tahoma, sans-serif",
        });

        const uniqueId = `mermaid-${Math.floor(Math.random() * 1000000)}`;
        const { svg } = await mermaid.render(uniqueId, sanitized);

        // اطمینان از اینکه خروجی شامل ارور پارس داخلی مِرمِید نباشد
        if (svg.includes("Syntax error") || svg.includes("Parse error")) {
          if (!isCancelled) setHasError(true);
          return;
        }

        if (!isCancelled) {
          setSvgContent(svg);
        }
      } catch (err) {
        console.warn("Mermaid rendering warning suppressed:", err);
        // پاک‌سازی المنتهای خطای ساخته‌شده توسط مِرمِید در بادی
        if (typeof document !== "undefined") {
          document.querySelectorAll("[id^='dmermaid']").forEach((el) => el.remove());
        }
        if (!isCancelled) {
          setHasError(true);
        }
      }
    };

    renderChart();

    return () => {
      isCancelled = true;
    };
  }, [chart]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sanitizeMermaidChart(chart));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (hasError || !svgContent) {
    return null;
  }

  return (
    <div className="relative my-3 overflow-hidden rounded-2xl border border-indigo-500/30 bg-slate-950/80 shadow-xl backdrop-blur-sm">
      {/* هدر کنترل دیاگرام */}
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-3 py-2 text-xs text-indigo-300">
        <span className="flex items-center gap-1.5 font-medium">
          <GitBranch className="h-4 w-4 text-indigo-400" />
          {title}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(z + 0.15, 1.8))}
            title="بزرگ‌نمایی"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(z - 0.15, 0.6))}
            title="کوچک‌نمایی"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            title="اندازه پیش‌فرض"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleCopyCode}
            title="کپی ساختار دیاگرام"
            className="flex items-center gap-1 rounded-md bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span>{copied ? "کپی شد" : "کد"}</span>
          </button>
        </div>
      </div>

      {/* بوم نمایش دیاگرام برداری */}
      <div
        ref={containerRef}
        className="flex min-h-[180px] max-h-[450px] items-center justify-center overflow-auto p-4 transition-transform duration-200"
        style={{ direction: "ltr" }}
      >
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          className="transition-transform duration-150"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>
    </div>
  );
}
