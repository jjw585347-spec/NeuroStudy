"use client";

import React, { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import {
  Maximize2,
  X,
  Download,
  Copy,
  Check,
  Sparkles,
  Loader2,
  RotateCw,
  AlertTriangle,
  HelpCircle,
  Globe,
  Volume2,
} from "lucide-react";
import dynamic from "next/dynamic";
import AudioPlayer, { AudioTrackSection } from "./AudioPlayer";

const MermaidViewer = dynamic(() => import("./MermaidViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-28 items-center justify-center rounded-2xl border border-indigo-500/20 bg-slate-950/40 text-xs text-indigo-300">
      در حال آماده‌سازی دیاگرام مفهومی...
    </div>
  ),
});

interface MediaViewerProps {
  explanation?: string;
  imageUrl?: string;
  imageSource?: "web_encyclopedia" | "ai_generated";
  imageTitle?: string;
  isVerified?: boolean;
  visualEntity?: {
    isPhysicalEntity?: boolean;
    canonicalEn?: string;
    canonicalFa?: string;
    searchQueriesEn?: string[];
    category?: string;
  };
  diagramCode?: string;
  visualPrompt?: string;
  audioUrl?: string;
  ttsSummary?: string;
  subject?: string;
  isOffTopic?: boolean;
  detectedSubject?: string;
  suggestedSubjectName?: string;
  followUpQuestions?: string[];
  onFollowUpClick?: (question: string) => void;
  onSwitchSubject?: (subjectId: string) => void;
  onImageUpdate?: (newImage: {
    imageUrl: string;
    imageSource: "web_encyclopedia" | "ai_generated";
    imageTitle?: string;
    isVerified?: boolean;
  }) => void;
  isLoading?: boolean;
  loadingStep?: "thinking" | "writing" | "illustrating" | "speaking" | "done";
}

/**
 * تبدیل استانداردهای مختلف لاتک به فرمت قابل فهم برای remark-math
 */
function normalizeMathExpressions(content?: string): string {
  if (!content) return "";
  return content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `\n$$\n${eq.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => `$${eq.trim()}$`);
}

export default function MediaViewer({
  explanation,
  imageUrl,
  imageSource = "ai_generated",
  imageTitle,
  isVerified,
  visualEntity,
  diagramCode,
  visualPrompt,
  audioUrl,
  ttsSummary,
  subject,
  isOffTopic = false,
  detectedSubject,
  suggestedSubjectName,
  followUpQuestions = [],
  onFollowUpClick,
  onSwitchSubject,
  onImageUpdate,
  isLoading = false,
  loadingStep = "done",
}: MediaViewerProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);
  const [isLessonCopied, setIsLessonCopied] = useState(false);

  // وضعیت لودینگ، تعویض و خطای تصویر
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [triedProxy, setTriedProxy] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState(imageUrl);
  const [currentImageSource, setCurrentImageSource] = useState(imageSource);
  const [currentImageTitle, setCurrentImageTitle] = useState(imageTitle);
  const [currentIsVerified, setCurrentIsVerified] = useState(isVerified);
  const [isChangingImage, setIsChangingImage] = useState(false);

  // وضعیت بخش فعال صوتی برای هایلایت زنده روی متن درس
  const [activeAudioTrack, setActiveAudioTrack] = useState<number | null>(null);
  const [externalPlayRequest, setExternalPlayRequest] = useState<{
    index: number;
    timestamp: number;
  } | null>(null);

  useEffect(() => {
    setCurrentImageSrc(imageUrl);
    setCurrentImageSource(imageSource);
    setCurrentImageTitle(imageTitle);
    setCurrentIsVerified(isVerified);
    setIsImageLoading(true);
    setImageError(false);
    setTriedProxy(false);
  }, [imageUrl, imageSource, imageTitle, isVerified]);

  const handleSwitchImage = async (mode: "next_web" | "force_ai") => {
    setIsChangingImage(true);
    setIsImageLoading(true);
    setImageError(false);
    setTriedProxy(false);
    try {
      const res = await fetch("/api/regenerate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: visualPrompt,
          canonicalEn: visualEntity?.canonicalEn,
          canonicalFa: visualEntity?.canonicalFa,
          searchQueriesEn: visualEntity?.searchQueriesEn,
          category: visualEntity?.category,
          currentUrl: currentImageSrc,
          mode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.imageUrl) {
          setCurrentImageSrc(data.imageUrl);
          setCurrentImageSource(data.imageSource);
          setCurrentImageTitle(data.imageTitle);
          setCurrentIsVerified(data.isVerified);
          if (onImageUpdate) {
            onImageUpdate({
              imageUrl: data.imageUrl,
              imageSource: data.imageSource,
              imageTitle: data.imageTitle,
              isVerified: data.isVerified,
            });
          }
        }
      }
    } catch (err) {
      console.warn("Failed to switch image:", err);
    } finally {
      setIsChangingImage(false);
    }
  };

  const handleCopyCode = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeIndex(idx);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  const handleCopyFullLesson = () => {
    if (!explanation) return;
    navigator.clipboard.writeText(explanation);
    setIsLessonCopied(true);
    setTimeout(() => setIsLessonCopied(false), 2000);
  };

  const handleRetryImage = () => {
    handleSwitchImage("next_web");
  };

  const formattedExplanation = useMemo(
    () => normalizeMathExpressions(explanation),
    [explanation]
  );

  // تفکیک درس‌نامه به بخش‌های منطقی جهت هایلایت هم‌زمان با روخوانی صوتی
  const lessonSections = useMemo(() => {
    if (!formattedExplanation) return [];
    const blocks = formattedExplanation
      .split(/\n(?=###?\s)/)
      .map((b) => b.trim())
      .filter((b) => b.length > 0);
    return blocks.length > 0 ? blocks : [formattedExplanation];
  }, [formattedExplanation]);

  // ساخت لیست ترک‌های هماهنگ بین متن درس و پلیر صوتی
  const audioTracks: AudioTrackSection[] = useMemo(() => {
    const list: AudioTrackSection[] = [];
    if (ttsSummary && ttsSummary.trim().length > 5) {
      list.push({
        id: 0,
        title: "🎙️ ۱. توضیح شفاهی استاد",
        text: ttsSummary.trim(),
        type: "teacher_intro",
      });
    }

    if (!isOffTopic && lessonSections.length > 0) {
      lessonSections.forEach((sec, idx) => {
        const firstLine = sec.split("\n")[0].replace(/^###?\s*/, "").trim();
        const shortTitle =
          firstLine.length > 0 && firstLine.length < 55
            ? firstLine
            : `بخش ${idx + 1} متن درس`;
        list.push({
          id: list.length,
          title: `📖 ${shortTitle}`,
          text: sec,
          type: "lesson_section",
        });
      });
    }

    return list;
  }, [ttsSummary, lessonSections, isOffTopic]);

  const hasIntroTrack = Boolean(ttsSummary && ttsSummary.trim().length > 5);

  const markdownComponents = {
    code({ node, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");
      const isInline = !match && !codeString.includes("\n");

      if (isInline) {
        return (
          <code
            dir="ltr"
            className="inline-block rounded bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-indigo-300"
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <div
          dir="ltr"
          className="relative my-3 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/95 text-left font-mono text-xs shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-800/60 px-3 py-1.5 text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
              {match ? match[1] : "code"}
            </span>
            <button
              type="button"
              onClick={() => handleCopyCode(codeString, Math.random())}
              className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              {copiedCodeIndex !== null ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">کپی شد</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>کپی کد</span>
                </>
              )}
            </button>
          </div>
          <div className="overflow-x-auto p-3.5 leading-5" dir="ltr">
            <code>{children}</code>
          </div>
        </div>
      );
    },
    p({ children }: any) {
      return <p className="mb-3 leading-7 text-justify">{children}</p>;
    },
    h1({ children }: any) {
      return (
        <h1 className="mb-3 text-lg font-bold text-indigo-300 border-b border-slate-800 pb-1">
          {children}
        </h1>
      );
    },
    h2({ children }: any) {
      return (
        <h2 className="mb-2.5 text-base font-bold text-indigo-200">
          {children}
        </h2>
      );
    },
    h3({ children }: any) {
      return (
        <h3 className="mb-2 text-sm sm:text-base font-bold text-indigo-200">
          {children}
        </h3>
      );
    },
    ul({ children }: any) {
      return <ul className="mb-3 list-disc pr-5 space-y-1.5">{children}</ul>;
    },
    ol({ children }: any) {
      return <ol className="mb-3 list-decimal pr-5 space-y-1.5">{children}</ol>;
    },
    li({ children }: any) {
      return <li className="leading-7">{children}</li>;
    },
    blockquote({ children }: any) {
      return (
        <blockquote className="my-3 border-r-4 border-indigo-500 bg-slate-800/40 p-3 italic text-slate-300 rounded-l-lg">
          {children}
        </blockquote>
      );
    },
  };

  return (
    <div className="flex flex-col gap-4">
      {/* هدر اکشن‌های درس (کپی کل درس) */}
      {explanation && !isLoading && (
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 font-medium text-indigo-300">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            درس‌نامه جامع و تعاملی استاد
          </span>
          <button
            type="button"
            onClick={handleCopyFullLesson}
            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-800/50 px-2.5 py-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            {isLessonCopied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">کل درس کپی شد</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>کپی کل درس</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* نوار وضعیت پردازش چندمرحله‌ای هوش مصنوعی */}
      {isLoading && (
        <div className="flex items-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-3 text-xs text-indigo-300">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-400 shrink-0" />
          <span>
            {loadingStep === "thinking" && "هوش مصنوعی در حال تحلیل مبحث درسی..."}
            {loadingStep === "writing" && "در حال تدوین درس‌نامه جامع، فرمول‌ها و مثال‌ها..."}
            {loadingStep === "illustrating" && "در حال جستجو و تایید بهترین تصویر مستند علمی..."}
            {loadingStep === "speaking" && "در حال آماده‌سازی تدریس صوتی و روخوانی متن..."}
            {loadingStep === "done" && "در حال آماده‌سازی پاسخ..."}
          </span>
        </div>
      )}

      {/* هشدار هوشمند عدم تطابق موضوع سوال و راهنمایی سریع */}
      {isOffTopic && (
        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-amber-950/20 p-4 sm:p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                  عدم تطابق موضوع
                </span>
                <span className="text-xs text-slate-400">
                  راهنمای دسته‌بندی موضوعی
                </span>
              </div>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-amber-100/95 font-medium">
                موضوع این پرسش خارج از سرفصل دسته‌بندی انتخاب‌شده تشخیص داده شد. برای دریافت تدریس گام‌به‌گام همراه با مدل تصویری و فلوچارت، می‌توانید مستقیماً دسته‌بندی را تغییر دهید:
              </p>

              {detectedSubject && onSwitchSubject && (
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSwitchSubject(detectedSubject)}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md transition hover:from-amber-400 hover:to-orange-400 active:scale-95"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>
                      تغییر خودکار به «{suggestedSubjectName || detectedSubject}» و دریافت پاسخ
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwitchSubject("general")}
                    className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
                  >
                    تغییر به «عمومی / آزاد»
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* بنر نشان‌دهنده پخش توضیح شفاهی استاد */}
      {activeAudioTrack === 0 && hasIntroTrack && (
        <div className="flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-950/50 px-3.5 py-2 text-xs text-indigo-200 shadow-md animate-pulse">
          <Volume2 className="h-4 w-4 text-indigo-400 shrink-0" />
          <span className="font-semibold">
            🎙️ استاد در حال ارائه توضیحات شفاهی و مقدماتی درس است (پس از آن روخوانی خط‌به‌خط متن زیر آغاز می‌شود)...
          </span>
        </div>
      )}

      {/* ۱. متن ساختاریافته درسی با قابلیت هایلایت زنده هنگام روخوانی صوتی و دکمه روخوانی هر بخش */}
      {lessonSections.length > 0 && (
        <div dir="rtl" className="space-y-3">
          {lessonSections.map((sectionMd, secIdx) => {
            const trackIndexForSection = hasIntroTrack ? secIdx + 1 : secIdx;
            const isSectionBeingRead = activeAudioTrack === trackIndexForSection;

            return (
              <div
                key={secIdx}
                className={`group/sec relative rounded-2xl transition-all duration-300 ${
                  isSectionBeingRead
                    ? "border border-emerald-500/60 bg-emerald-950/20 p-3.5 sm:p-4 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/40"
                    : lessonSections.length > 1
                    ? "border border-slate-800/60 bg-slate-900/25 p-3 sm:p-4 hover:border-slate-700/80"
                    : ""
                }`}
              >
                {!isOffTopic && audioUrl && (
                  <div className="mb-2 flex items-center justify-between">
                    {isSectionBeingRead ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 animate-pulse">
                        <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                        در حال روخوانی صوتی از روی این بخش...
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">
                        بخش {secIdx + 1} از {lessonSections.length}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setExternalPlayRequest({
                          index: trackIndexForSection,
                          timestamp: Date.now(),
                        })
                      }
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                        isSectionBeingRead
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "border border-slate-700/80 bg-slate-800/70 text-slate-300 hover:border-indigo-500/50 hover:bg-indigo-950/60 hover:text-indigo-200"
                      }`}
                      title="روخوانی صوتی این بخش توسط استاد"
                    >
                      <Volume2 className="h-3 w-3" />
                      <span>
                        {isSectionBeingRead ? "در حال خوانش" : "روخوانی این بخش"}
                      </span>
                    </button>
                  </div>
                )}

                <div className="prose prose-invert max-w-none text-sm leading-relaxed text-slate-200">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeKatex]}
                    components={markdownComponents}
                  >
                    {sectionMd}
                  </ReactMarkdown>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ۲. دیاگرام و فلوچارت برداری تعاملی (Mermaid) */}
      {diagramCode && !isLoading && <MermaidViewer chart={diagramCode} />}

      {/* ۳. تصویر علمی مستند از دانشنامه‌های معتبر جهانی */}
      {currentImageSrc && (
        <div className="group relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/60 p-2 shadow-lg transition hover:border-indigo-500/50">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2 text-xs">
            {currentImageSource === "web_encyclopedia" ? (
              <span className="flex items-center gap-1.5 font-medium text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-500/30 text-[11px]">
                <Globe className="h-3.5 w-3.5 text-emerald-400" />
                تصویر مستند علمی از دانشنامه {currentIsVerified ? "(تاییدشده با هوش مصنوعی بینایی)" : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-medium text-indigo-300 bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-500/30 text-[11px]">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                مدل سه‌بعدی اختصاصی هوش مصنوعی
              </span>
            )}

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isChangingImage}
                onClick={() => handleSwitchImage("next_web")}
                className="flex items-center gap-1 rounded-md border border-slate-700/70 bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
                title="جستجوی تصویر مستند دیگر از دانشنامه"
              >
                {isChangingImage ? (
                  <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                ) : (
                  <RotateCw className="h-3 w-3 text-indigo-400" />
                )}
                <span>تصویر علمی بعدی</span>
              </button>

              {!imageError && !isImageLoading && (
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  className="flex items-center gap-1 rounded-md bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300 transition hover:bg-slate-700 hover:text-white"
                >
                  <Maximize2 className="h-3 w-3" />
                  بزرگ‌نمایی
                </button>
              )}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center min-h-[240px]">
            {isImageLoading && !imageError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/80 text-xs text-indigo-300">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                <span>در حال بارگذاری تصویر مستند علمی...</span>
              </div>
            )}

            {imageError ? (
              <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-xs text-slate-400">
                <AlertTriangle className="h-8 w-8 text-amber-400" />
                <span>تصویر به دلیل محدودیت شبکه بارگذاری نشد.</span>
                <button
                  type="button"
                  onClick={handleRetryImage}
                  className="mt-2 flex items-center gap-1.5 rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs text-white transition hover:bg-indigo-600"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  بارگذاری تصویر جایگزین
                </button>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={currentImageSrc}
                alt={currentImageTitle || visualPrompt || "تصویر آموزشی"}
                onLoad={() => setIsImageLoading(false)}
                onError={() => {
                  // اگر بارگذاری مستقیم از ویکی‌پدیا به دلیل فیلترینگ/شبکه خطا داد، به‌طور خودکار از پروکسی سرور خودمان عبور بده
                  if (
                    !triedProxy &&
                    currentImageSrc &&
                    currentImageSrc.startsWith("http") &&
                    !currentImageSrc.includes("/api/image?proxyUrl=")
                  ) {
                    setTriedProxy(true);
                    setCurrentImageSrc(
                      `/api/image?proxyUrl=${encodeURIComponent(currentImageSrc)}`
                    );
                    return;
                  }
                  setImageError(true);
                  setIsImageLoading(false);
                }}
                onClick={() => !isImageLoading && setIsLightboxOpen(true)}
                className={`max-h-96 w-full cursor-pointer object-contain bg-white/5 p-1 transition duration-300 ${
                  isImageLoading ? "opacity-0" : "opacity-100 group-hover:scale-[1.01]"
                }`}
                loading="lazy"
              />
            )}
          </div>

          {(currentImageTitle || visualPrompt) && !imageError && (
            <div className="mt-2 flex items-start gap-1.5 px-2 text-[11px] text-slate-300">
              {currentImageSource === "web_encyclopedia" ? (
                <Globe className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
              )}
              <p className="line-clamp-2 font-medium" dir="auto">
                {currentImageTitle || visualPrompt}
              </p>
            </div>
          )}
        </div>
      )}

      {/* مودال لایت‌باکس بزرگ‌نمایی */}
      {isLightboxOpen && currentImageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-2 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-3">
              <span className="text-xs font-semibold text-slate-200 line-clamp-1" dir="auto">
                {currentImageTitle || visualPrompt || "تصویر آموزشی"}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={currentImageSrc}
                  target="_blank"
                  rel="noreferrer"
                  download="educational_visual.png"
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-500"
                >
                  <Download className="h-3.5 w-3.5" />
                  دانلود
                </a>
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex max-h-[80vh] items-center justify-center overflow-auto p-2 bg-slate-950/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImageSrc}
                alt="تصویر بزرگ‌نمایی شده"
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* ۴. پلیر صوتی پیشرفته (تدریس شفاهی استاد + روخوانی بخش‌به‌بخش از روی متن درس با هایلایت زنده) */}
      {audioUrl && (
        <div className="mt-1">
          <AudioPlayer
            audioUrl={audioUrl}
            spokenText={ttsSummary}
            fullExplanation={explanation}
            sections={audioTracks}
            onTrackChange={setActiveAudioTrack}
            externalPlayRequest={externalPlayRequest}
          />
        </div>
      )}

      {/* ۵. سوالات پیگیری هوشمند (Follow-up Questions) */}
      {followUpQuestions && followUpQuestions.length > 0 && !isLoading && (
        <div className="mt-3 border-t border-slate-800/70 pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <HelpCircle className="h-3.5 w-3.5 text-indigo-400" />
            <span>پیشنهاد برای ادامه یادگیری:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {followUpQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onFollowUpClick && onFollowUpClick(q)}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-500/20 bg-indigo-950/30 px-3 py-1.5 text-xs text-indigo-200 transition hover:border-indigo-500/50 hover:bg-indigo-900/50 hover:text-white"
              >
                <Sparkles className="h-3 w-3 text-indigo-400 shrink-0" />
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
