"use client";

import React, { useState, useRef, useEffect } from "react";
import { QuestionSolution } from "@/types/solver";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import {
  UploadCloud,
  CheckCircle2,
  XCircle,
  Sparkles,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Lightbulb,
  FileQuestion,
  HelpCircle,
  X,
  Target,
  ArrowRight,
} from "lucide-react";
import AudioPlayer from "./AudioPlayer";

const SUBJECTS = [
  { id: "general", name: "عمومی / کنکور سراسری" },
  { id: "math", name: "ریاضیات و هندسه" },
  { id: "physics", name: "فیزیک و دینامیک" },
  { id: "chemistry", name: "شیمی و ساختارها" },
  { id: "biology", name: "زیست‌شناسی و پزشکی" },
  { id: "coding", name: "برنامه‌نویسی و کامپیوتر" },
];

/**
 * نرمال‌سازی فرمول‌های لاتک
 */
function normalizeMath(content?: string): string {
  if (!content) return "";
  return content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `\n$$\n${eq.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => `$${eq.trim()}$`);
}

export default function QuestionSolverView() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [fileName, setFileName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("general");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingPhase, setLoadingPhase] = useState<string>("");
  const [solution, setSolution] = useState<QuestionSolution | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // لیسنر چسباندن عکس با Ctrl + V
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            processFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    setFileName(file.name);
    setMimeType(file.type || "image/jpeg");

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setImagePreview(result);
        const parts = result.split(",");
        setImageBase64(parts[1] || "");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleSolve = async () => {
    if (!imageBase64 || isLoading) return;

    setIsLoading(true);
    setLoadingPhase("در حال استخراج صورت سوال و گزینه‌ها...");

    const phaseTimer = setTimeout(() => {
      setLoadingPhase("در حال حل گام‌به‌گام و محاسبه گزینه صحیح...");
    }, 3000);

    const phaseTimer2 = setTimeout(() => {
      setLoadingPhase("در حال تدوین راه‌حل تشریحی و دام‌های تستی...");
    }, 7000);

    try {
      const res = await fetch("/api/solve-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          notes,
          subject: selectedSubject,
        }),
      });

      clearTimeout(phaseTimer);
      clearTimeout(phaseTimer2);

      if (!res.ok) {
        throw new Error("خطا در پردازش هوش مصنوعی سوال");
      }

      const data = await res.json();
      if (data.solution) {
        setSolution(data.solution);
      }
    } catch (err: any) {
      clearTimeout(phaseTimer);
      clearTimeout(phaseTimer2);
      console.error("Solve error:", err);
      alert(err.message || "خطا در برقراری ارتباط با سرور هوش مصنوعی");
    } finally {
      setIsLoading(false);
      setLoadingPhase("");
    }
  };

  const handleReset = () => {
    setSolution(null);
    setImagePreview(null);
    setImageBase64(null);
    setFileName("");
    setNotes("");
  };

  const handleCopySolution = () => {
    if (!solution) return;
    const text = `🎯 پاسخ سوال: ${solution.correctOptionSummary}\n\n📝 صورت سوال:\n${solution.questionText}\n\n💡 راه‌حل تشریحی:\n${solution.stepByStepSolution}\n\n⚠️ نکته تستی:\n${solution.keyExamTip || ""}`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto px-2.5 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
        {/* هدر بخش حل سوال */}
        <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-slate-900/50 to-violet-950/40 p-3.5 sm:p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20">
              <Target className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white sm:text-xl flex flex-wrap items-center gap-2">
                <span>حل هوشمند سوالات، تست‌ها و امتحانات</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                  تشخیص گزینه قطعی
                </span>
              </h1>
              <p className="mt-1 text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                تصویر تست یا سوال تشریحی خود را آپلود کنید (یا با <kbd className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-indigo-300">Ctrl + V</kbd> پیست کنید)؛ هوش مصنوعی آن را گام‌به‌گام حل کرده و گزینه درست را مشخص می‌کند.
              </p>
            </div>
          </div>
        </div>

        {/* ۱. نمایش کارت حل شده یا فرم آپلود */}
        {!solution ? (
          <div className="space-y-4">
            {/* دراپ‌زون بارگذاری عکس */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !imagePreview && fileInputRef.current?.click()}
              className={`relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                dragOver
                  ? "border-emerald-500 bg-emerald-950/20"
                  : imagePreview
                  ? "border-indigo-500/60 bg-slate-900/60"
                  : "border-slate-800 bg-slate-900/30 hover:border-indigo-500/50 hover:bg-slate-900/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {imagePreview ? (
                <div className="relative w-full max-w-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="پیش‌نمایش سوال"
                    className="max-h-72 w-full rounded-xl object-contain shadow-2xl border border-slate-700/60"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImagePreview(null);
                      setImageBase64(null);
                    }}
                    title="حذف و انتخاب عکس دیگر"
                    className="absolute -top-3 -left-3 rounded-full bg-rose-600 p-1.5 text-white shadow-lg transition hover:bg-rose-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <p className="mt-2 text-center text-xs text-slate-400">
                    {fileName || "تصویر سوال انتخاب شد"} - برای تغییر تصویر روی آن کلیک کنید
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                    <UploadCloud className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      عکس سوال یا تست را اینجا بکشید یا کلیک کنید
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      پشتیبانی از اسکرین‌شات و الصاق با <span className="font-mono text-indigo-300">Ctrl + V</span> (فرمت‌های JPG، PNG، WEBP)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* گزینه‌های تکمیلی فرم */}
            {imagePreview && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      موضوع درس:
                    </label>
                    <select
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      توضیح یا سوال خاص (اختیاری):
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="مثال: روش تستی مدنظرم است یا گزینه ۲ با ۳ چه فرقی دارد؟"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* دکمه ارسال و حل */}
                <button
                  type="button"
                  onClick={handleSolve}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-xl shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>{loadingPhase || "در حال حل سوال..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      <span>تحلیل تصویر و حل قاطعانه سوال</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ۲. کارت نمایش نتایج تحلیل و گزینه صحیح */
          <div className="space-y-6">
            {/* بنر بزرگ گزینه صحیح */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-teal-950/80 p-5 shadow-2xl backdrop-blur-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      پاسخ قطعی هوش مصنوعی
                    </span>
                    <h2 className="text-xl font-extrabold text-white sm:text-2xl">
                      {solution.isMultipleChoice && solution.correctOptionNumber > 0
                        ? `گزینه ${solution.correctOptionNumber} صحیح است`
                        : "پاسخ تشریحی کامل مسئله"}
                    </h2>
                    <p className="mt-1 text-xs text-slate-300">
                      {solution.correctOptionSummary}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopySolution}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span className="text-emerald-400">کپی شد</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>کپی پاسخ</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-md transition hover:bg-indigo-500"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>حل یک سوال دیگر</span>
                  </button>
                </div>
              </div>
            </div>

            {/* گزینه‌های چهارگانه با تفکیک درست و نادرست */}
            {solution.options && solution.options.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <FileQuestion className="h-4 w-4 text-indigo-400" />
                  تحلیل تک‌تک گزینه‌ها:
                </h3>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {solution.options.map((opt) => {
                    const isCorrect = opt.isCorrect || opt.number === solution.correctOptionNumber;
                    return (
                      <div
                        key={opt.number}
                        className={`relative rounded-xl border p-3.5 transition-all ${
                          isCorrect
                            ? "border-emerald-500/80 bg-emerald-950/40 shadow-lg shadow-emerald-500/10"
                            : "border-slate-800/80 bg-slate-900/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                isCorrect
                                  ? "bg-emerald-500 text-white"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {opt.number}
                            </span>
                            <span
                              className={`text-xs font-semibold ${
                                isCorrect ? "text-emerald-300" : "text-slate-200"
                              }`}
                            >
                              گزینه {opt.number}: {opt.text}
                            </span>
                          </div>

                          {isCorrect ? (
                            <span className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="h-3 w-3" />
                              صحیح
                            </span>
                          ) : (
                            <span className="flex shrink-0 items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-400/80">
                              <XCircle className="h-3 w-3" />
                              نادرست
                            </span>
                          )}
                        </div>

                        {opt.explanation && (
                          <p className="mt-2 text-[11px] leading-relaxed text-slate-400 border-t border-slate-800/50 pt-2">
                            {opt.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* صوت تدریس راه‌حل */}
            {solution.audioUrl && (
              <div className="mt-2">
                <AudioPlayer
                  audioUrl={solution.audioUrl}
                  title={`توضیح صوتی حل سوال و گزینه ${solution.correctOptionNumber || ""}`}
                  spokenText={solution.ttsSummary || solution.correctOptionSummary}
                />
              </div>
            )}

            {/* راه‌حل تشریحی گام‌به‌گام با فرمول‌های لاتک */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  راه‌حل تشریحی گام‌به‌گام و محاسبات:
                </h3>
              </div>

              <div
                dir="rtl"
                className="prose prose-invert max-w-none text-sm leading-relaxed text-slate-200"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkMath, remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    p({ children }) {
                      return <p className="mb-3 leading-7 text-justify">{children}</p>;
                    },
                    h1({ children }) {
                      return (
                        <h1 className="mb-3 text-base font-bold text-indigo-300 border-b border-slate-800 pb-1">
                          {children}
                        </h1>
                      );
                    },
                    h2({ children }) {
                      return (
                        <h2 className="mb-2 text-sm font-semibold text-indigo-200">
                          {children}
                        </h2>
                      );
                    },
                    ul({ children }) {
                      return <ul className="mb-3 list-disc pr-5 space-y-1">{children}</ul>;
                    },
                    ol({ children }) {
                      return <ol className="mb-3 list-decimal pr-5 space-y-1">{children}</ol>;
                    },
                    li({ children }) {
                      return <li className="leading-6">{children}</li>;
                    },
                  }}
                >
                  {normalizeMath(solution.stepByStepSolution)}
                </ReactMarkdown>
              </div>
            </div>

            {/* کارت نکته طلایی تستی و دام سوال */}
            {solution.keyExamTip && (
              <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-slate-900/60 to-yellow-950/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Lightbulb className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-300">
                      نکته طلایی و دام تستی این سوال:
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      {solution.keyExamTip}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
