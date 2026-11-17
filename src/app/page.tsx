"use client";

import React, { useState, useEffect, useRef } from "react";
import SidebarHistory from "@/components/SidebarHistory";
import ChatBox from "@/components/ChatBox";
import ChatInput from "@/components/ChatInput";
import QuestionSolverView from "@/components/QuestionSolverView";
import AuthModal from "@/components/AuthModal";
import { TutorMessage, TutorSession, MessageAttachment } from "@/types/tutor";
import {
  Menu,
  Sparkles,
  Volume2,
  VolumeX,
  LogIn,
  LogOut,
  User,
  MessageSquare,
  Target,
} from "lucide-react";

interface UserProfile {
  email: string;
  name: string;
}

export default function HomePage() {
  const [sessions, setSessions] = useState<TutorSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);

  // وضعیت احراز هویت کاربر
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "solver">("chat");

  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // واکشی جلسات ۲ روز گذشته کاربر از سرور
  const fetchUserServerSessions = async (email: string) => {
    try {
      const res = await fetch(`/api/sessions?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.sessions && Array.isArray(data.sessions) && data.sessions.length > 0) {
          setSessions(data.sessions);
          setCurrentSessionId(data.sessions[0].id);
          localStorage.setItem("neurostudy_sessions", JSON.stringify(data.sessions));
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch server sessions:", err);
    }
  };

  // همگام‌سازی جلسات کاربر با سرور (با اعمال محدودیت ۲ روزه)
  const syncSessionsToServer = async (email: string, updatedSessions: TutorSession[]) => {
    try {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, sessions: updatedSessions }),
      });
    } catch (err) {
      console.warn("Failed to sync sessions to server:", err);
    }
  };

  // بارگذاری نشست‌ها و تنظیمات از حافظه مرورگر با فیلتر ۲ روزه
  useEffect(() => {
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let initialUser: UserProfile | null = null;

    try {
      const savedUser = localStorage.getItem("neurostudy_user");
      if (savedUser) {
        initialUser = JSON.parse(savedUser);
        setUser(initialUser);
      }

      const savedAutoPlay = localStorage.getItem("neurostudy_autoplay");
      if (savedAutoPlay !== null) {
        setAutoPlayAudio(savedAutoPlay === "true");
      }

      const saved = localStorage.getItem("neurostudy_sessions");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // فیلتر انقضای ۲ روزه (۴۸ ساعته) برای کش محلی مرورگر
          const valid = parsed.filter(
            (s: TutorSession) =>
              now - new Date(s.updatedAt || s.createdAt || 0).getTime() <= TWO_DAYS_MS
          );
          if (valid.length > 0) {
            setSessions(valid);
            setCurrentSessionId(valid[0].id);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load sessions from storage:", e);
    }

    // اگر کاربر لاگین بود، چت‌های ذخیره‌شده ۲ روزه از سرور واکشی شوند
    if (initialUser?.email) {
      fetchUserServerSessions(initialUser.email);
    } else {
      setSessions((prev) => {
        if (prev.length > 0) return prev;
        const initialSession: TutorSession = {
          id: "session-1",
          title: "گفتگوی آموزشی جدید",
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setCurrentSessionId(initialSession.id);
        return [initialSession];
      });
    }
  }, []);

  const handleLoginSuccess = async (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    try {
      localStorage.setItem("neurostudy_user", JSON.stringify(loggedInUser));
    } catch (e) {
      console.error(e);
    }

    // بارگذاری مکالمات ۲ روز اخیر متصل به این ایمیل از سرور
    try {
      const res = await fetch(`/api/sessions?email=${encodeURIComponent(loggedInUser.email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.sessions && Array.isArray(data.sessions) && data.sessions.length > 0) {
          setSessions(data.sessions);
          setCurrentSessionId(data.sessions[0].id);
          localStorage.setItem("neurostudy_sessions", JSON.stringify(data.sessions));
          return;
        }
      }
      // اگر در سرور چتی نداشت اما در صفحه فعلی پیامی ثبت شده بود، به سرور ارسال شود
      if (sessions.length > 0 && sessions.some((s) => s.messages.length > 0)) {
        syncSessionsToServer(loggedInUser.email, sessions);
      }
    } catch (err) {
      console.warn("Error loading user sessions upon login:", err);
    }
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem("neurostudy_user");
    } catch (e) {
      console.error(e);
    }
  };

  const toggleAutoPlay = () => {
    const newVal = !autoPlayAudio;
    setAutoPlayAudio(newVal);
    try {
      localStorage.setItem("neurostudy_autoplay", String(newVal));
    } catch (e) {
      console.error(e);
    }
  };

  const saveSessions = (updated: TutorSession[]) => {
    setSessions(updated);
    try {
      localStorage.setItem("neurostudy_sessions", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save sessions to storage:", e);
    }
    if (user?.email) {
      syncSessionsToServer(user.email, updated);
    }
  };

  const currentSession =
    sessions.find((s) => s.id === currentSessionId) || sessions[0];

  const handleNewSession = () => {
    const newSession: TutorSession = {
      id: `session-${Date.now()}`,
      title: "گفتگوی درسی جدید",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newSession, ...sessions];
    saveSessions(updated);
    setCurrentSessionId(newSession.id);
  };

  const handleDeleteSession = async (id: string) => {
    const filtered = sessions.filter((s) => s.id !== id);
    if (filtered.length === 0) {
      const fresh: TutorSession = {
        id: `session-${Date.now()}`,
        title: "گفتگوی درسی جدید",
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveSessions([fresh]);
      setCurrentSessionId(fresh.id);
    } else {
      saveSessions(filtered);
      if (currentSessionId === id) {
        setCurrentSessionId(filtered[0].id);
      }
    }

    if (user?.email) {
      try {
        await fetch("/api/sessions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, sessionId: id }),
        });
      } catch (err) {
        console.warn("Failed to delete session on server:", err);
      }
    }
  };

  const startDynamicLoadingSteps = (sessionId: string, assistantMsgId: string) => {
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
    }

    const steps: ("thinking" | "writing" | "illustrating" | "speaking")[] = [
      "thinking",
      "writing",
      "illustrating",
      "speaking",
    ];
    let stepIndex = 0;

    loadingIntervalRef.current = setInterval(() => {
      stepIndex++;
      if (stepIndex < steps.length) {
        updateAssistantMessage(sessionId, assistantMsgId, {
          loadingStep: steps[stepIndex],
        });
      }
    }, 3000);
  };

  const stopDynamicLoadingSteps = () => {
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
  };

  const streamTextToMessage = (
    sessionId: string,
    messageId: string,
    fullText: string,
    onComplete: () => void
  ) => {
    let currentIdx = 0;
    const chunkSize = Math.max(15, Math.floor(fullText.length / 40));

    const interval = setInterval(() => {
      currentIdx += chunkSize;
      if (currentIdx >= fullText.length) {
        clearInterval(interval);
        updateAssistantMessage(sessionId, messageId, {
          explanation: fullText,
        });
        onComplete();
      } else {
        updateAssistantMessage(sessionId, messageId, {
          explanation: fullText.slice(0, currentIdx),
        });
      }
    }, 25);
  };

  // تابع پخش پاسخ صوتی با پشتیبانی از Fallback مرورگر
  const playSpokenAnswer = (audioUrl?: string, spokenText?: string) => {
    if (!audioUrl && !spokenText) return;

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio
        .play()
        .then(() => {})
        .catch(() => {
          // در صورت خطای پخش یا بلاک اتوپلی مرورگر، خوانش با Web Speech
          if (
            spokenText &&
            typeof window !== "undefined" &&
            "speechSynthesis" in window
          ) {
            try {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(spokenText);
              utterance.lang = "fa-IR";
              window.speechSynthesis.speak(utterance);
            } catch (err) {
              console.warn("SpeechSynthesis error:", err);
            }
          }
        });
    } else if (
      spokenText &&
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.lang = "fa-IR";
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("SpeechSynthesis error:", err);
      }
    }
  };

  // ارسال سوال متنی یا فایل پیوست و فراخوانی API آموزشی
  const handleSendMessage = async (
    text: string,
    subject: string = "general",
    attachment?: MessageAttachment
  ) => {
    if (!currentSession || (!text.trim() && !attachment) || isLoading) return;

    const userMessage: TutorMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      questionText: text,
      subject,
      attachment,
      createdAt: new Date().toISOString(),
    };

    const assistantMsgId = `msg-${Date.now()}-assistant`;
    const initialAssistantMsg: TutorMessage = {
      id: assistantMsgId,
      role: "assistant",
      isLoading: true,
      loadingStep: "thinking",
      createdAt: new Date().toISOString(),
    };

    const updatedTitle =
      currentSession.messages.length === 0
        ? (text || attachment?.name || "پرسش درسی").slice(0, 32)
        : currentSession.title;

    const updatedMessages = [
      ...currentSession.messages,
      userMessage,
      initialAssistantMsg,
    ];

    const updatedSessions = sessions.map((s) =>
      s.id === currentSession.id
        ? {
            ...s,
            title: updatedTitle,
            messages: updatedMessages,
            updatedAt: new Date().toISOString(),
          }
        : s
    );

    saveSessions(updatedSessions);
    setIsLoading(true);
    startDynamicLoadingSteps(currentSession.id, assistantMsgId);

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, subject, attachment }),
      });

      stopDynamicLoadingSteps();

      if (!res.ok) {
        throw new Error(`پاسخ ناموفق از سرور: ${res.statusText}`);
      }

      const data = await res.json();

      streamTextToMessage(
        currentSession.id,
        assistantMsgId,
        data.explanation,
        () => {
          updateAssistantMessage(currentSession.id, assistantMsgId, {
            isLoading: false,
            loadingStep: "done",
            visualPrompt: data.visualPrompt,
            visualEntity: data.visualEntity,
            imageUrl: data.imageUrl,
            imageSource: data.imageSource,
            imageTitle: data.imageTitle,
            isVerified: data.isVerified,
            diagramCode: data.diagramCode,
            audioUrl: data.audioUrl,
            ttsSummary: data.ttsSummary,
            subject: data.subject,
            followUpQuestions: data.followUpQuestions,
          });
          setIsLoading(false);

          if (autoPlayAudio) {
            playSpokenAnswer(data.audioUrl, data.ttsSummary || data.explanation);
          }
        }
      );
    } catch (err: any) {
      stopDynamicLoadingSteps();
      console.error("Error communicating with tutor API:", err);
      updateAssistantMessage(currentSession.id, assistantMsgId, {
        isLoading: false,
        loadingStep: "done",
        explanation: `⚠️ متاسفانه در ارتباط با سرور هوش مصنوعی خطایی رخ داد: ${
          err.message || "خطای موقت"
        } \n\nلطفاً چند لحظه بعد مجدداً تلاش فرمایید.`,
      });
      setIsLoading(false);
    }
  };

  // ارسال سوال صوتی
  const handleSendAudio = async (
    blob: Blob,
    durationSeconds: number,
    subject: string = "general"
  ) => {
    if (!currentSession || isLoading) return;

    const localAudioUrl = URL.createObjectURL(blob);
    const userMessage: TutorMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      questionText: `🎤 در حال رونویسی گفتار صوتی (${durationSeconds} ثانیه)...`,
      audioUrl: localAudioUrl,
      audioBlob: blob,
      subject,
      createdAt: new Date().toISOString(),
    };

    const assistantMsgId = `msg-${Date.now()}-assistant`;
    const initialAssistantMsg: TutorMessage = {
      id: assistantMsgId,
      role: "assistant",
      isLoading: true,
      loadingStep: "thinking",
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [
      ...currentSession.messages,
      userMessage,
      initialAssistantMsg,
    ];

    const updatedSessions = sessions.map((s) =>
      s.id === currentSession.id
        ? {
            ...s,
            messages: updatedMessages,
            updatedAt: new Date().toISOString(),
          }
        : s
    );

    saveSessions(updatedSessions);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("audio", blob, "voice_question.webm");

      const sttRes = await fetch("/api/speech", {
        method: "POST",
        body: formData,
      });

      let transcribedText = "";
      if (sttRes.ok) {
        const sttData = await sttRes.json();
        transcribedText = sttData.text || "";
      }

      if (!transcribedText || transcribedText === "سوال درسی مطرح‌شده از طریق صوت") {
        transcribedText = `سوال صوتی در زمینه ${subject}`;
      }

      updateUserMessage(currentSession.id, userMessage.id, {
        questionText: `🎤 ${transcribedText}`,
      });

      startDynamicLoadingSteps(currentSession.id, assistantMsgId);

      const explainRes = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: transcribedText, subject }),
      });

      stopDynamicLoadingSteps();

      if (!explainRes.ok) {
        throw new Error("خطا در تولید پاسخ آموزشی برای صوت");
      }

      const explainData = await explainRes.json();

      streamTextToMessage(
        currentSession.id,
        assistantMsgId,
        explainData.explanation,
        () => {
          updateAssistantMessage(currentSession.id, assistantMsgId, {
            isLoading: false,
            loadingStep: "done",
            visualPrompt: explainData.visualPrompt,
            imageUrl: explainData.imageUrl,
            imageSource: explainData.imageSource,
            imageTitle: explainData.imageTitle,
            diagramCode: explainData.diagramCode,
            audioUrl: explainData.audioUrl,
            ttsSummary: explainData.ttsSummary,
            subject: explainData.subject,
            followUpQuestions: explainData.followUpQuestions,
          });
          setIsLoading(false);

          // چون سوال به صورت صوتی پرسیده شده، پاسخ صوتی استاد حتماً بلافاصله پخش می‌شود
          playSpokenAnswer(
            explainData.audioUrl,
            explainData.ttsSummary || explainData.explanation
          );
        }
      );
    } catch (err: any) {
      stopDynamicLoadingSteps();
      console.error("Audio question processing error:", err);
      updateAssistantMessage(currentSession.id, assistantMsgId, {
        isLoading: false,
        loadingStep: "done",
        explanation: `⚠️ خطا در پردازش صوت: ${err.message || "خطای ناشناخته"}`,
      });
      setIsLoading(false);
    }
  };

  const updateUserMessage = (
    sessionId: string,
    messageId: string,
    updates: Partial<TutorMessage>
  ) => {
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, ...updates } : m
          ),
        };
      });
      try {
        localStorage.setItem("neurostudy_sessions", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      if (user?.email && updates.isLoading === false) {
        syncSessionsToServer(user.email, updated);
      }
      return updated;
    });
  };

  const updateAssistantMessage = (
    sessionId: string,
    messageId: string,
    updates: Partial<TutorMessage>
  ) => {
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, ...updates } : m
          ),
        };
      });
      try {
        localStorage.setItem("neurostudy_sessions", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      if (user?.email && updates.isLoading === false) {
        syncSessionsToServer(user.email, updated);
      }
      return updated;
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* سایدبار تاریخچه و مدیریت جلسات */}
      <SidebarHistory
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* بخش اصلی گفتگو */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* هدر بالای صفحه */}
        <header className="flex h-14 items-center justify-between border-b border-slate-800/80 bg-slate-950/60 px-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
              <span className="text-xs font-semibold text-slate-200">
                {activeTab === "solver" ? "حل هوشمند سوال و تست" : (currentSession?.title || "دستیار چندوجهی")}
              </span>
            </div>
          </div>

          {/* سوئیچر حالت: گفتگوی درسی یا حل تست و سوال */}
          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/80 p-0.5 text-xs shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-medium transition ${
                activeTab === "chat"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">گفتگوی آموزشی</span>
              <span className="sm:hidden">چت</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("solver")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-medium transition ${
                activeTab === "solver"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Target className="h-3.5 w-3.5 text-emerald-400" />
              <span>حل سوال و تست</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* سوئیچ پخش خودکار صدا */}
            <button
              type="button"
              onClick={toggleAutoPlay}
              title={
                autoPlayAudio
                  ? "پخش خودکار صدای استاد فعال است"
                  : "پخش خودکار صدای استاد غیرفعال است"
              }
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs transition ${
                autoPlayAudio
                  ? "border-indigo-500/60 bg-indigo-950/50 text-indigo-300"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200"
              }`}
            >
              {autoPlayAudio ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="hidden md:inline">صوت خودکار: روشن</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">صوت خودکار: خاموش</span>
                </>
              )}
            </button>

            {/* بخش ورود / پروفایل کاربر */}
            {user ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 py-1 pl-2.5 pr-1.5 text-xs">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white uppercase text-[11px]">
                  {user.name.slice(0, 1)}
                </div>
                <span className="max-w-[120px] truncate text-slate-200 font-medium">
                  {user.name}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="خروج از حساب"
                  className="rounded-md p-1 text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-indigo-500 hover:to-violet-500"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">ورود با ایمیل</span>
              </button>
            )}
          </div>
        </header>

        {/* بدنه اصلی بر اساس تب انتخاب شده */}
        {activeTab === "solver" ? (
          <QuestionSolverView />
        ) : (
          <>
            {/* باکس پیام‌ها و نمایشگر چندوجهی */}
            <ChatBox
              messages={currentSession?.messages || []}
              onQuickPromptClick={(prompt, subject) =>
                handleSendMessage(prompt, subject)
              }
              isLoading={isLoading}
            />

            {/* کادر ورودی سوال، ضبط صدا و پیوست فایل */}
            <ChatInput
              onSendMessage={handleSendMessage}
              onSendAudio={handleSendAudio}
              isLoading={isLoading}
            />
          </>
        )}
      </div>

      {/* مودال ورود و تایید کد OTP با ایمیل */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}
