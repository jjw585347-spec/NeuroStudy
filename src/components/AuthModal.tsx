"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: { email: string; name: string }) => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
}: AuthModalProps) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(180);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ریست وضعیت هنگام باز شدن
  useEffect(() => {
    if (isOpen) {
      setStep("email");
      setErrorMsg(null);
      setInfoMsg(null);
      setOtpDigits(["", "", "", "", "", ""]);
      setCountdown(180);
    }
  }, [isOpen]);

  // تایمر معکوس
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "otp" && countdown > 0) {
      timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  if (!isOpen) return null;

  // مرحله ۱: ارسال ایمیل
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isLoading) return;

    setErrorMsg(null);
    setInfoMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "خطا در ارسال کد تایید");
      }

      setStep("otp");
      setCountdown(180);
      if (data.isSimulated && data.previewCode) {
        setInfoMsg(
          `💡 حالت آزمایشی: کد تایید شما ${data.previewCode} است (می‌توانید برای ارسال واقعی به جیمیل، تنظیمات SMTP را در .env.local وارد کنید).`
        );
      } else {
        setInfoMsg("کد تایید با موفقیت به صندوق ورودی ایمیل شما ارسال شد.");
      }

      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setErrorMsg(err.message || "خطا در ارسال ایمیل");
    } finally {
      setIsLoading(false);
    }
  };

  // مدیریت تغییر ارقام کد تایید
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // اگر کاربر کل کد ۶ رقمی را Paste کرد
      const pastedDigits = value.slice(0, 6).split("");
      const newDigits = [...otpDigits];
      pastedDigits.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setOtpDigits(newDigits);
      const nextFocus = Math.min(pastedDigits.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    // پرش به خانه بعدی
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // مرحله ۲: بررسی و تایید کد
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const fullCode = otpDigits.join("");
    if (fullCode.length !== 6 || isLoading) return;

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: fullCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "کد تایید اشتباه است");
      }

      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "کد تایید نامعتبر است");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCountdown = () => {
    const mins = Math.floor(countdown / 60);
    const secs = countdown % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl">
        {/* دکمه بستن */}
        <button
          type="button"
          onClick={onClose}
          className="absolute left-4 top-4 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* سربرگ */}
        <div className="text-center pt-2 pb-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30">
            {step === "email" ? (
              <Mail className="h-6 w-6" />
            ) : (
              <Lock className="h-6 w-6" />
            )}
          </div>
          <h3 className="text-lg font-bold text-white">
            {step === "email" ? "ورود یا ثبت‌نام با ایمیل" : "تایید کد امنیتی"}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {step === "email"
              ? "برای دسترسی و ذخیره جلسات، آدرس ایمیل خود را وارد نمایید"
              : `کد ۶ رقمی ارسال‌شده به ${email} را وارد کنید`}
          </p>
        </div>

        {/* پیام‌های وضعیت */}
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <span className="leading-5">{infoMsg}</span>
          </div>
        )}

        {/* فرم مرحله ۱: ایمیل */}
        {step === "email" && (
          <form onSubmit={handleSendEmail} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                آدرس ایمیل شما:
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="مثال: student@gmail.com"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder-slate-500 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>در حال ارسال کد...</span>
                </>
              ) : (
                <>
                  <span>دریافت کد تایید یکبار مصرف</span>
                  <ArrowRight className="h-4 w-4 rotate-180" />
                </>
              )}
            </button>
          </form>
        )}

        {/* فرم مرحله ۲: ورود کد ۶ رقمی */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="mb-3 flex justify-between gap-2" dir="ltr">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="h-12 w-12 rounded-xl border border-slate-700 bg-slate-950/80 text-center font-mono text-lg font-bold text-white transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50"
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  ویرایش ایمیل
                </button>

                {countdown > 0 ? (
                  <span className="font-mono text-slate-400">
                    ارسال مجدد تا {formatCountdown()}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => handleSendEmail(e)}
                    className="font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    ارسال مجدد کد
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || otpDigits.join("").length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>در حال راستی‌آزمایی...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>تایید و ورود به سایت</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* فوتر توضیحات امنیتی */}
        <div className="mt-5 border-t border-slate-800/80 pt-3 text-center">
          <p className="text-[11px] text-slate-500">
            سیستم امنیتی بدون رمز عبور (Passwordless) با کد یکبار مصرف اختصاصی
          </p>
        </div>
      </div>
    </div>
  );
}
