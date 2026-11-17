"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Gauge, Mic2 } from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
  spokenText?: string;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2, 0.75];

export default function AudioPlayer({
  audioUrl,
  title = "توضیح صوتی درس",
  spokenText,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [isUsingSpeechSynth, setIsUsingSpeechSynth] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      // اگر فایل صوتی آنلاین پخش نشد و متن گفتاری داشتیم
      if (spokenText && "speechSynthesis" in window) {
        console.warn("Audio stream unavailable, ready to use Web Speech");
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [audioUrl, spokenText]);

  const togglePlay = () => {
    const audio = audioRef.current;

    // اگر در حال خوانش مرورگر هستیم
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

    if (!audio || audio.error) {
      if (spokenText && "speechSynthesis" in window) {
        playSpeechSynthesis(spokenText);
      }
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          // در صورت شکست پخش فایل آنلاین، تلاش برای خوانش متن با SpeechSynthesis
          if (spokenText && "speechSynthesis" in window) {
            playSpeechSynthesis(spokenText);
          }
        });
    }
  };

  const playSpeechSynthesis = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fa-IR";
    utterance.rate = SPEED_OPTIONS[speedIndex];

    utterance.onstart = () => {
      setIsUsingSpeechSynth(true);
      setIsPlaying(true);
    };

    utterance.onend = () => {
      setIsUsingSpeechSynth(false);
      setIsPlaying(false);
      setCurrentTime(0);
    };

    utterance.onerror = () => {
      setIsUsingSpeechSynth(false);
      setIsPlaying(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const restartAudio = () => {
    if (isUsingSpeechSynth && spokenText) {
      playSpeechSynthesis(spokenText);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
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
    if (isUsingSpeechSynth && spokenText && "speechSynthesis" in window) {
      playSpeechSynthesis(spokenText);
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
    <div className="flex flex-col gap-2 rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-3 backdrop-blur-sm">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-400">
            {isUsingSpeechSynth ? (
              <Mic2 className="h-4 w-4 text-emerald-400 animate-pulse" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </div>
          <span className="text-xs font-medium text-indigo-200">
            {title}
            {isUsingSpeechSynth && (
              <span className="mr-2 text-[10px] text-emerald-400">(خوانش زنده مرورگر)</span>
            )}
          </span>
        </div>

        {/* Speed button */}
        <button
          type="button"
          onClick={cycleSpeed}
          title="تغییر سرعت پخش"
          className="flex items-center gap-1 rounded-md border border-indigo-800/40 bg-indigo-900/40 px-2 py-0.5 text-[11px] font-mono font-semibold text-indigo-300 transition hover:bg-indigo-800/60"
        >
          <Gauge className="h-3 w-3" />
          <span>{SPEED_OPTIONS[speedIndex]}x</span>
        </button>
      </div>

      {/* Progress & Controls */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md transition hover:bg-indigo-500"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 fill-current translate-x-[-1px]" />
          )}
        </button>

        <button
          type="button"
          onClick={restartAudio}
          title="شروع مجدد"
          className="text-slate-400 transition hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        {/* Progress Slider */}
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

        {/* Volume Mute */}
        <button
          type="button"
          onClick={toggleMute}
          title={isMuted ? "وصل صدا" : "قطع صدا"}
          className="text-slate-400 transition hover:text-white"
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
