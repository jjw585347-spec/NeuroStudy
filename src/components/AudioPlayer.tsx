"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Gauge,
  Mic2,
  SkipForward,
  SkipBack,
  BookOpen,
  Sparkles,
  Loader2,
} from "lucide-react";

export interface AudioTrackSection {
  id: number;
  title: string;
  text: string;
  type: "teacher_intro" | "lesson_section";
}

interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
  spokenText?: string;
  fullExplanation?: string;
  sections?: AudioTrackSection[];
  activeTrackIndex?: number;
  onTrackChange?: (index: number | null) => void;
  externalPlayRequest?: { index: number; timestamp: number } | null;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2, 0.75];

/**
 * تفکیک متن به جملات مجزا برای هایلایت زنده کلمه/جمله در حال خوانش (کارائوکه آموزشی)
 */
function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  const cleaned = text
    .replace(/```[\s\S]*?```/g, " [بررسی نمونه کد در متن درس] ")
    .replace(/[#*`$\\_~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const rawParts = cleaned.split(/(?<=[.؟!؛\n])\s+/);
  const sentences: string[] = [];
  for (const part of rawParts) {
    const trimmed = part.trim();
    if (trimmed.length > 2) {
      sentences.push(trimmed);
    }
  }
  return sentences.length > 0 ? sentences : [cleaned];
}

export default function AudioPlayer({
  audioUrl,
  title = "تدریس صوتی استاد و روخوانی کامل متن درس",
  spokenText,
  fullExplanation,
  sections: propSections,
  activeTrackIndex: controlledTrackIndex,
  onTrackChange,
  externalPlayRequest,
}: AudioPlayerProps) {
  // ساخت لیست ترک‌های صوتی: ۱. توضیح شفاهی استاد + ۲. بخش‌های کامل متن درس
  const tracks: AudioTrackSection[] = React.useMemo(() => {
    if (propSections && propSections.length > 0) {
      return propSections;
    }

    const list: AudioTrackSection[] = [];
    if (spokenText && spokenText.trim().length > 10) {
      list.push({
        id: 0,
        title: "🎙️ توضیح شفاهی استاد",
        text: spokenText.trim(),
        type: "teacher_intro",
      });
    }

    if (fullExplanation && fullExplanation.trim().length > 20) {
      const rawBlocks = fullExplanation
        .split(/\n(?=###?\s)/)
        .map((b) => b.trim())
        .filter((b) => b.length > 15);

      rawBlocks.forEach((block, idx) => {
        const firstLine = block.split("\n")[0].replace(/^###?\s*/, "").trim();
        const sectionTitle =
          firstLine.length < 65 ? firstLine : `بخش ${idx + 1} درس‌نامه`;
        list.push({
          id: list.length,
          title: `📖 ${sectionTitle}`,
          text: block,
          type: "lesson_section",
        });
      });
    }

    if (list.length === 0) {
      list.push({
        id: 0,
        title: "🎙️ توضیح صوتی درس",
        text: spokenText || "توضیحات درسی آماده است.",
        type: "teacher_intro",
      });
    }

    return list;
  }, [propSections, spokenText, fullExplanation]);

  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [isUsingSpeechSynth, setIsUsingSpeechSynth] = useState(false);
  const [showLiveReader, setShowLiveReader] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobCacheRef = useRef<Map<number, string>>(new Map());
  const inflightFetchRef = useRef<Map<number, Promise<string | null>>>(new Map());

  const activeTrack = tracks[currentTrackIdx] || tracks[0];
  const sentences = React.useMemo(
    () => splitIntoSentences(activeTrack?.text || ""),
    [activeTrack?.text]
  );

  // محاسبه جمله فعال بر اساس زمان پخش صوت برای هایلایت زنده روی متن
  const activeSentenceIdx = React.useMemo(() => {
    if (!sentences.length) return 0;
    if (duration <= 0 || currentTime <= 0) return 0;
    const totalChars = sentences.reduce((acc, s) => acc + s.length, 0) || 1;
    const progressRatio = Math.min(1, Math.max(0, currentTime / duration));
    const targetChar = progressRatio * totalChars;

    let runningChars = 0;
    for (let i = 0; i < sentences.length; i++) {
      runningChars += sentences[i].length;
      if (targetChar <= runningChars) {
        return i;
      }
    }
    return sentences.length - 1;
  }, [sentences, currentTime, duration]);

  // دریافت و کش کردن صوت هر بخش از سرور (POST /api/speech)
  const fetchTrackAudioBlobUrl = useCallback(
    async (trackIdx: number): Promise<string | null> => {
      if (blobCacheRef.current.has(trackIdx)) {
        return blobCacheRef.current.get(trackIdx)!;
      }
      if (inflightFetchRef.current.has(trackIdx)) {
        return inflightFetchRef.current.get(trackIdx)!;
      }

      const target = tracks[trackIdx];
      if (!target) return null;

      const promise = (async () => {
        try {
          const res = await fetch("/api/speech", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: target.text }),
          });

          if (res.ok && res.status === 200) {
            const blob = await res.blob();
            if (blob.size > 100) {
              const objUrl = URL.createObjectURL(blob);
              blobCacheRef.current.set(trackIdx, objUrl);
              return objUrl;
            }
          }
        } catch (err) {
          console.warn("TTS fetch error for track", trackIdx, err);
        } finally {
          inflightFetchRef.current.delete(trackIdx);
        }
        return null;
      })();

      inflightFetchRef.current.set(trackIdx, promise);
      return promise;
    },
    [tracks]
  );

  // پیش‌بارگذاری هوشمند بخش بعدی در پس‌زمینه برای پخش پیوسته و بدون مکث
  useEffect(() => {
    if (isPlaying && currentTrackIdx + 1 < tracks.length) {
      fetchTrackAudioBlobUrl(currentTrackIdx + 1);
    }
  }, [isPlaying, currentTrackIdx, tracks.length, fetchTrackAudioBlobUrl]);

  // اطلاع‌رسانی بخش فعال به کامپوننت والد برای هایلایت زنده روی متن درس‌نامه
  useEffect(() => {
    if (onTrackChange) {
      onTrackChange(isPlaying ? currentTrackIdx : null);
    }
  }, [isPlaying, currentTrackIdx, onTrackChange]);

  const playSpeechSynthesis = useCallback(
    (text: string, onDone?: () => void) => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();

      const clean = text.replace(/[#*`$\\_~]/g, " ");
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = "fa-IR";
      utterance.rate = SPEED_OPTIONS[speedIndex];

      utterance.onstart = () => {
        setIsUsingSpeechSynth(true);
        setIsPlaying(true);
        setIsLoadingAudio(false);
      };

      utterance.onend = () => {
        setIsUsingSpeechSynth(false);
        if (onDone) {
          onDone();
        } else {
          setIsPlaying(false);
          setCurrentTime(0);
        }
      };

      utterance.onerror = () => {
        setIsUsingSpeechSynth(false);
        setIsPlaying(false);
        setIsLoadingAudio(false);
      };

      window.speechSynthesis.speak(utterance);
    },
    [speedIndex]
  );

  // پخش یک بخش مشخص
  const playTrackAtIndex = useCallback(
    async (index: number) => {
      if (index < 0 || index >= tracks.length) {
        setIsPlaying(false);
        setCurrentTime(0);
        return;
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsUsingSpeechSynth(false);
      setCurrentTrackIdx(index);
      setCurrentTime(0);
      setDuration(0);
      setIsLoadingAudio(true);

      const audio = audioRef.current;
      if (audio) {
        audio.pause();
      }

      const blobUrl = await fetchTrackAudioBlobUrl(index);
      if (blobUrl && audioRef.current) {
        audioRef.current.src = blobUrl;
        audioRef.current.playbackRate = SPEED_OPTIONS[speedIndex];
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          setIsLoadingAudio(false);
          return;
        } catch (err) {
          console.warn("Audio element play error, falling back:", err);
        }
      }

      // پشتیبان خوانش مرورگر در صورت عدم دسترسی موقت شبکه
      setIsLoadingAudio(false);
      const trackText = tracks[index]?.text;
      if (trackText) {
        playSpeechSynthesis(trackText, () => {
          if (index + 1 < tracks.length) {
            playTrackAtIndex(index + 1);
          } else {
            setIsPlaying(false);
          }
        });
      }
    },
    [tracks, fetchTrackAudioBlobUrl, speedIndex, playSpeechSynthesis]
  );

  // واکنش به درخواست پخش مستقیم یک بخش از داخل متن درس
  useEffect(() => {
    if (externalPlayRequest && externalPlayRequest.index >= 0) {
      playTrackAtIndex(externalPlayRequest.index);
    }
  }, [externalPlayRequest, playTrackAtIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (Number.isFinite(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
      }
    };

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const onDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const onEnded = () => {
      // رفتن خودکار به بخش بعدی درس (ابتدا توضیح استاد، سپس روخوانی بخش‌به‌بخش متن)
      if (currentTrackIdx + 1 < tracks.length) {
        playTrackAtIndex(currentTrackIdx + 1);
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentTrackIdx, tracks.length, playTrackAtIndex]);

  // پاک‌سازی ObjectURLها هنگام خروج
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      blobCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobCacheRef.current.clear();
    };
  }, []);

  const togglePlay = () => {
    if (isLoadingAudio) return;

    if (isUsingSpeechSynth) {
      if ("speechSynthesis" in window) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          setIsPlaying(false);
        } else if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setIsPlaying(true);
        }
      }
      return;
    }

    const audio = audioRef.current;
    if (isPlaying && audio) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    // اگر قبلاً همین ترک لود شده و وسط پخش متوقف شده بود، ادامه بده
    if (audio && audio.src && audio.src.startsWith("blob:") && currentTime > 0) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => playTrackAtIndex(currentTrackIdx));
      return;
    }

    playTrackAtIndex(currentTrackIdx);
  };

  const restartAudio = () => {
    playTrackAtIndex(currentTrackIdx);
  };

  const handlePrevTrack = () => {
    if (currentTrackIdx > 0) {
      playTrackAtIndex(currentTrackIdx - 1);
    }
  };

  const handleNextTrack = () => {
    if (currentTrackIdx + 1 < tracks.length) {
      playTrackAtIndex(currentTrackIdx + 1);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (audio && Number.isFinite(newTime)) {
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const cycleSpeed = () => {
    const nextIndex = (speedIndex + 1) % SPEED_OPTIONS.length;
    setSpeedIndex(nextIndex);
    const newSpeed = SPEED_OPTIONS[nextIndex];
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const formatTime = (timeInSeconds: number) => {
    if (
      !Number.isFinite(timeInSeconds) ||
      isNaN(timeInSeconds) ||
      timeInSeconds < 0
    ) {
      return "00:00";
    }
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const validDuration =
    Number.isFinite(duration) && duration > 0 ? duration : 0;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 via-slate-900/90 to-slate-950/90 p-3.5 sm:p-4 shadow-xl backdrop-blur-md">
      <audio ref={audioRef} preload="none" />

      {/* ردیف بالا: عنوان پلیر، انتخاب حالت و سرعت */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
            {isLoadingAudio ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            ) : isUsingSpeechSynth ? (
              <Mic2 className="h-4 w-4 text-emerald-400 animate-pulse" />
            ) : (
              <Volume2 className="h-4 w-4 text-indigo-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-200 truncate">
                {title}
              </span>
              <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                بخش {currentTrackIdx + 1} از {tracks.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {activeTrack?.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowLiveReader(!showLiveReader)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
              showLiveReader
                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
                : "border-slate-700 bg-slate-800/60 text-slate-400 hover:text-white"
            }`}
            title="نمایش/مخفی‌سازی باکس روخوانی هم‌زمان متن"
          >
            <BookOpen className="h-3 w-3" />
            <span>روخوانی هم‌زمان متن</span>
          </button>

          <button
            type="button"
            onClick={cycleSpeed}
            title="تغییر سرعت پخش"
            className="flex items-center gap-1 rounded-lg border border-indigo-800/40 bg-indigo-900/40 px-2 py-1 text-[11px] font-mono font-semibold text-indigo-300 transition hover:bg-indigo-800/60"
          >
            <Gauge className="h-3 w-3" />
            <span>{SPEED_OPTIONS[speedIndex]}x</span>
          </button>
        </div>
      </div>

      {/* نوار انتخاب سریع بخش‌های صوتی (۱. توضیح شفاهی استاد + ۲. بخش‌های متن درس) */}
      {tracks.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
          {tracks.map((tr, idx) => {
            const isSelected = idx === currentTrackIdx;
            return (
              <button
                key={tr.id}
                type="button"
                onClick={() => playTrackAtIndex(idx)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition ${
                  isSelected
                    ? tr.type === "teacher_intro"
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm ring-1 ring-indigo-400/50"
                      : "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/50"
                    : "border border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800"
                }`}
              >
                <span>{tr.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* کادر روخوانی زنده روی متن (هایلایت جمله در حال خوانش توسط استاد) */}
      {showLiveReader && activeTrack && (
        <div
          dir="rtl"
          className="max-h-36 overflow-y-auto rounded-xl border border-slate-800/90 bg-slate-950/85 p-3 text-xs leading-7 text-slate-300 shadow-inner"
        >
          <div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800/80 pb-1">
            <span className="flex items-center gap-1 font-semibold text-indigo-300">
              <Sparkles className="h-3 w-3 text-amber-400" />
              {activeTrack.type === "teacher_intro"
                ? "متن تدریس شفاهی استاد (هم‌زمان با صوت):"
                : "در حال روخوانی خط‌به‌خط از روی متن درس:"}
            </span>
            {isLoadingAudio && (
              <span className="text-amber-300 animate-pulse">
                در حال سنتز صدای طبیعی استاد...
              </span>
            )}
          </div>
          <div className="space-y-1">
            {sentences.map((sentence, sIdx) => {
              const isCurrentSentence = isPlaying && sIdx === activeSentenceIdx;
              return (
                <span
                  key={sIdx}
                  className={`inline transition-all duration-200 rounded px-1 py-0.5 ${
                    isCurrentSentence
                      ? "bg-indigo-500/30 text-white font-semibold ring-1 ring-indigo-400/50 shadow-sm"
                      : sIdx < activeSentenceIdx && isPlaying
                      ? "text-slate-400"
                      : "text-slate-300"
                  }`}
                >
                  {sentence}{" "}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* کنترل‌های پخش و اسلایدر زمان */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={isLoadingAudio}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30 transition hover:from-indigo-500 hover:to-violet-500 active:scale-95 disabled:opacity-60"
          title={isPlaying ? "توقف موقت" : "پخش توضیح استاد و روخوانی متن"}
        >
          {isLoadingAudio ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 fill-current translate-x-[-1px]" />
          )}
        </button>

        {tracks.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevTrack}
              disabled={currentTrackIdx === 0 || isLoadingAudio}
              title="بخش قبلی"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-30"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNextTrack}
              disabled={currentTrackIdx >= tracks.length - 1 || isLoadingAudio}
              title="بخش بعدی"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-30"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={restartAudio}
          disabled={isLoadingAudio}
          title="خوانش مجدد این بخش"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        {/* اسلایدر زمان */}
        <div className="flex flex-1 items-center gap-2">
          <span className="font-mono text-[11px] text-slate-400">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={validDuration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            disabled={validDuration === 0}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-indigo-500 disabled:opacity-40"
          />
          <span className="font-mono text-[11px] text-slate-400">
            {validDuration > 0 ? formatTime(validDuration) : "--:--"}
          </span>
        </div>

        {/* قطع/وصل صدا */}
        <button
          type="button"
          onClick={toggleMute}
          title={isMuted ? "وصل صدا" : "قطع صدا"}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4 text-rose-400" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
