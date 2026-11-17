"use client";

import React, { useRef, useEffect } from "react";
import { TutorMessage } from "@/types/tutor";
import MediaViewer from "./MediaViewer";
import { User, Bot, GraduationCap, Compass, FileText, ImageIcon } from "lucide-react";

interface ChatBoxProps {
  messages: TutorMessage[];
  onQuickPromptClick: (prompt: string, subject: string) => void;
  isLoading?: boolean;
}

const SAMPLE_QUESTIONS = [
  {
    title: "فیزیک و دینامیک",
    prompt: "قانون دوم نیوتون و رابطه نیرو با شتاب و جرم را با فرمول و تصویر مفهومی توضیح بده.",
    subject: "physics",
  },
  {
    title: "زیست‌شناسی و سلول",
    prompt: "مراحل تقسیم میتوز در سلول و تفاوت آن با میوز را همراه با تصویر شماتیک شرح بده.",
    subject: "biology",
  },
  {
    title: "ریاضی و هندسه",
    prompt: "قضیه فیثاغورس را اثبات کن و یک نمونه محاسبه وتر مثلث قائم‌الزاویه را با فرمول نشان بده.",
    subject: "math",
  },
  {
    title: "طراحی وب و برنامه‌نویسی",
    prompt: "چگونه یک فرم ورود (Login) مدرن و واکنش‌گرا با HTML و CSS بسازیم؟ کد کامل بده.",
    subject: "coding",
  },
];

export default function ChatBox({
  messages,
  onQuickPromptClick,
  isLoading = false,
}: ChatBoxProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Empty State / Welcome Screen */}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-xl shadow-indigo-500/20">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              به دستیار آموزشی <span className="text-indigo-400">NeuroStudy</span> خوش آمدید
            </h2>
            <p className="mt-2.5 max-w-md text-sm leading-relaxed text-slate-400">
              سوالات درسی‌تان را تایپ کنید یا بگویید؛ هوش مصنوعی با ترکیب
              <span className="font-semibold text-indigo-300"> متن تشریحی</span>،
              <span className="font-semibold text-purple-300"> تصویر آموزشی</span> و
              <span className="font-semibold text-pink-300"> توضیح صوتی </span>
              مفهوم را به شما آموزش می‌دهد.
            </p>

            {/* Quick suggested questions */}
            <div className="mt-10 w-full max-w-2xl">
              <div className="mb-3 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400">
                <Compass className="h-4 w-4 text-indigo-400" />
                <span>نمونه پرسش‌های پیشنهادی برای شروع:</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-right">
                {SAMPLE_QUESTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onQuickPromptClick(item.prompt, item.subject)}
                    className="group rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-right transition-all hover:border-indigo-500/50 hover:bg-slate-800/60 hover:shadow-lg hover:shadow-indigo-500/5"
                  >
                    <div className="text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
                      {item.title}
                    </div>
                    <div className="mt-1.5 text-xs leading-5 text-slate-300 group-hover:text-white">
                      {item.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Message List */
          messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 sm:gap-4 ${
                  isUser ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-md ${
                    isUser
                      ? "bg-slate-700 text-slate-200"
                      : "bg-gradient-to-tr from-indigo-600 to-violet-600 text-white"
                  }`}
                >
                  {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[88%] rounded-2xl p-4 sm:max-w-[82%] ${
                    isUser
                      ? "bg-indigo-600/90 text-white shadow-md shadow-indigo-600/10"
                      : "border border-slate-800/90 bg-slate-900/80 text-slate-100 shadow-xl backdrop-blur-sm"
                  }`}
                >
                  {isUser ? (
                    <div className="space-y-2.5">
                      {/* تصویر پیوست‌شده توسط کاربر */}
                      {msg.attachment?.type === "image" && msg.attachment.url && (
                        <div className="overflow-hidden rounded-xl border border-white/20 bg-black/30 shadow-md">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={msg.attachment.url}
                            alt={msg.attachment.name}
                            className="max-h-60 w-auto rounded-lg object-contain"
                          />
                          <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-indigo-100/90">
                            <ImageIcon className="h-3.5 w-3.5" />
                            <span className="truncate">{msg.attachment.name}</span>
                          </div>
                        </div>
                      )}

                      {/* فایل سندی پیوست‌شده توسط کاربر */}
                      {msg.attachment?.type === "file" && (
                        <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-indigo-900/60 p-2.5 text-xs text-indigo-100">
                          <FileText className="h-4 w-4 shrink-0 text-indigo-200" />
                          <span className="truncate font-medium">{msg.attachment.name}</span>
                        </div>
                      )}

                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {msg.questionText}
                      </p>

                      {msg.audioUrl && (
                        <div className="pt-1">
                          <audio
                            src={msg.audioUrl}
                            controls
                            className="h-8 max-w-full rounded-md"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <MediaViewer
                      explanation={msg.explanation}
                      imageUrl={msg.imageUrl}
                      imageSource={msg.imageSource}
                      imageTitle={msg.imageTitle}
                      isVerified={msg.isVerified}
                      visualEntity={msg.visualEntity}
                      diagramCode={msg.diagramCode}
                      visualPrompt={msg.visualPrompt}
                      audioUrl={msg.audioUrl}
                      ttsSummary={msg.ttsSummary}
                      followUpQuestions={msg.followUpQuestions}
                      onFollowUpClick={(q) => onQuickPromptClick(q, msg.subject || "general")}
                      isLoading={msg.isLoading}
                      loadingStep={msg.loadingStep}
                    />
                  )}

                  <div
                    className={`mt-2 text-[10px] ${
                      isUser ? "text-indigo-200/70 text-left" : "text-slate-500 text-left"
                    }`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString("fa-IR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
