"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, AlertCircle } from "lucide-react";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export default function AudioRecorder({
  onRecordingComplete,
  onCancel,
  isProcessing = false,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      cleanupStream();
    };
  }, []);

  const cleanupStream = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    setErrorMsg(null);
    audioChunksRef.current = [];
    setRecordDuration(0);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("مرورگر شما از قابلیت ضبط صدا پشتیبانی نمی‌کند.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        if (audioBlob.size > 0) {
          onRecordingComplete(audioBlob, recordDuration);
        }
        cleanupStream();
      };

      mediaRecorder.start(200); // Collect data every 200ms
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      cleanupStream();
      console.error("Audio recording error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMsg("دسترسی به میکروفون مسدود شده است. لطفاً در تنظیمات مرورگر اجازه ضبط صدا را صادر کنید.");
      } else {
        setErrorMsg(err.message || "خطا در شروع ضبط صدا");
      }
    }
  };

  const stopAndSubmit = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCancel = () => {
    cleanupStream();
    setIsRecording(false);
    onCancel();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 shadow-lg backdrop-blur-sm transition-all sm:flex-row">
      <div className="flex items-center gap-3">
        {/* Animated pulsating recording dot */}
        <div className="relative flex h-10 w-10 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60"></span>
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-white shadow-md">
            <Mic className="h-5 w-5 animate-pulse" />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-rose-300">در حال ضبط صدای شما...</span>
            <span className="font-mono text-sm font-bold text-rose-200">
              {formatDuration(recordDuration)}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            سوال درسی خود را به وضوح بیان کنید
          </p>
        </div>
      </div>

      {errorMsg ? (
        <div className="flex items-center gap-2 text-xs text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      ) : null}

      <div className="flex items-center gap-2 self-end sm:self-center">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isProcessing}
          className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
        >
          <Trash2 className="h-3.5 w-3.5" />
          لغو
        </button>

        <button
          type="button"
          onClick={stopAndSubmit}
          disabled={isProcessing || recordDuration < 1}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:from-rose-500 hover:to-indigo-500 disabled:opacity-50"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          اتمام و ارسال سوال
        </button>
      </div>
    </div>
  );
}
