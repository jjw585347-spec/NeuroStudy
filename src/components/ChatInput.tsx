"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  SendHorizontal,
  Mic,
  Paperclip,
  Sparkles,
  X,
  FileText,
  ImageIcon,
  Loader2,
} from "lucide-react";
import AudioRecorder from "./AudioRecorder";
import { MessageAttachment } from "@/types/tutor";

interface ChatInputProps {
  onSendMessage: (
    text: string,
    subject?: string,
    attachment?: MessageAttachment
  ) => void;
  onSendAudio: (blob: Blob, durationSeconds: number, subject?: string) => void;
  isLoading?: boolean;
  activeSubject?: string;
  onSubjectChange?: (subject: string) => void;
}

const QUICK_SUBJECTS = [
  { id: "math", name: "ریاضی و هندسه", icon: "📐" },
  { id: "physics", name: "فیزیک و نجوم", icon: "⚛️" },
  { id: "biology", name: "زیست‌شناسی", icon: "🧬" },
  { id: "chemistry", name: "شیمی و مولکول‌ها", icon: "🧪" },
  { id: "coding", name: "برنامه‌نویسی و کامپیوتر", icon: "💻" },
  { id: "general", name: "عمومی / آزاد", icon: "📚" },
];

export default function ChatInput({
  onSendMessage,
  onSendAudio,
  isLoading = false,
  activeSubject = "general",
  onSubjectChange,
}: ChatInputProps) {
  const [inputText, setInputText] = useState("");
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>(activeSubject);
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);

  useEffect(() => {
    if (activeSubject && activeSubject !== selectedSubject) {
      setSelectedSubject(activeSubject);
    }
  }, [activeSubject]);

  const handleSelectSubject = (subId: string) => {
    setSelectedSubject(subId);
    if (onSubjectChange) {
      onSubjectChange(subId);
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        160
      )}px`;
    }
  }, [inputText]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if ((!trimmed && !attachment) || isLoading || isReadingFile) return;

    onSendMessage(
      trimmed || (attachment?.type === "image" ? "لطفاً این تصویر/مسئله درسی را تشریح و حل کن." : "لطفاً فایل درسی را تحلیل کن."),
      selectedSubject,
      attachment || undefined
    );

    setInputText("");
    setAttachment(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReadingFile(true);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          const parts = dataUrl.split(",");
          const base64 = parts[1] || "";
          setAttachment({
            name: file.name,
            type: "image",
            url: dataUrl,
            base64,
            mimeType: file.type || "image/jpeg",
          });
        }
        setIsReadingFile(false);
      };
      reader.onerror = () => setIsReadingFile(false);
      reader.readAsDataURL(file);
    } else {
      // برای فایل‌های متنی، کد، مارک‌داون و سایر اسناد
      const reader = new FileReader();
      reader.onload = (event) => {
        const textContent = event.target?.result as string;
        setAttachment({
          name: file.name,
          type: "file",
          content: textContent || "",
        });
        setIsReadingFile(false);
      };
      reader.onerror = () => setIsReadingFile(false);
      reader.readAsText(file);
    }

    // پاک کردن مقدار اینپوت فایل جهت امکان انتخاب مجدد
    e.target.value = "";
  };

  const handleAudioCompleted = (blob: Blob, duration: number) => {
    setIsRecordingAudio(false);
    onSendAudio(blob, duration, selectedSubject);
  };

  const canSubmit = (inputText.trim().length > 0 || attachment !== null) && !isLoading && !isReadingFile;

  return (
    <div className="relative mx-auto w-full max-w-4xl px-2.5 sm:px-4 pb-3 sm:pb-4">
      {/* Subject tags with smooth horizontal swipe */}
      <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar touch-pan-x scroll-smooth">
        <span className="flex items-center gap-1 text-slate-400 pl-1 shrink-0 text-[11px] sm:text-xs">
          <Sparkles className="h-3 w-3 text-indigo-400" />
          <span className="hidden xs:inline">موضوع:</span>
        </span>
        {QUICK_SUBJECTS.map((sub) => {
          const isSelected = selectedSubject === sub.id;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => handleSelectSubject(sub.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-medium transition active:scale-95 ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/50"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 active:bg-slate-700"
              }`}
            >
              <span>{sub.icon}</span>
              <span>{sub.name}</span>
            </button>
          );
        })}
      </div>

      {/* If Audio Recording is active */}
      {isRecordingAudio ? (
        <AudioRecorder
          onRecordingComplete={handleAudioCompleted}
          onCancel={() => setIsRecordingAudio(false)}
          isProcessing={isLoading}
        />
      ) : (
        /* Text & File input box */
        <div className="relative rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-2xl backdrop-blur-md transition-all focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500/50">
          {/* File / Image attachment preview badge */}
          {attachment && (
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-800/50 px-3 py-2 text-xs text-indigo-300">
              <div className="flex items-center gap-2">
                {attachment.type === "image" && attachment.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={attachment.url}
                    alt="پیش‌نمایش تصویر"
                    className="h-9 w-9 rounded-lg object-cover border border-indigo-500/40 shadow-sm"
                  />
                ) : (
                  <FileText className="h-4 w-4 text-indigo-400" />
                )}
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-200 truncate max-w-[220px] sm:max-w-xs">
                    {attachment.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {attachment.type === "image" ? "تصویر پیوست شد (آماده تحلیل بصری)" : "سند / جزوه متنی پیوست شد"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAttachment(null)}
                title="حذف فایل پیوست"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {isReadingFile && (
            <div className="flex items-center gap-2 border-b border-slate-800 bg-indigo-950/40 px-3 py-1.5 text-xs text-indigo-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
              <span>در حال پردازش و بارگذاری فایل...</span>
            </div>
          )}

          <div className="flex items-end p-1.5 sm:p-2.5 gap-1 sm:gap-1.5">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*,.pdf,.txt,.md,.py,.js,.ts,.tsx,.jsx,.html,.css,.json,.csv"
              className="hidden"
            />

            {/* Attach file button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="آپلود تصویر تمرین، عکس کتاب یا فایل جزوه"
              disabled={isLoading || isReadingFile}
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-800 hover:text-indigo-300 active:bg-slate-800 disabled:opacity-50"
            >
              <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {/* Mic button */}
            <button
              type="button"
              onClick={() => setIsRecordingAudio(true)}
              title="پرسش با صوت (میکروفون)"
              disabled={isLoading || isReadingFile}
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-800 hover:text-rose-400 active:bg-slate-800 disabled:opacity-50"
            >
              <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || isReadingFile}
              placeholder={
                attachment
                  ? "سوال یا نکته‌ای درباره این فایل/تصویر بنویسید..."
                  : "سوال درسی، کد یا تمرین را بپرسید... (یا عکس سوال را پیوست کنید)"
              }
              className="max-h-36 min-h-[38px] sm:min-h-[44px] flex-1 resize-none bg-transparent px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm leading-relaxed text-slate-100 placeholder-slate-500 focus:outline-none"
            />

            {/* Send button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!canSubmit}
              title="ارسال سوال"
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md transition hover:from-indigo-500 hover:to-violet-500 active:scale-95 disabled:opacity-40 disabled:hover:from-indigo-600"
            >
              <SendHorizontal className="h-4 w-4 sm:h-5 sm:w-5 rotate-180" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
