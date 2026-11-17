"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Key,
  Cpu,
  Mail,
  Lock,
  X,
  Check,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
} from "lucide-react";

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSettingsModal({
  isOpen,
  onClose,
}: AdminSettingsModalProps) {
  const [adminPassword, setAdminPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // فیلدهای تنظیمات
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [aiTextModel, setAiTextModel] = useState("gemini-flash-latest");
  const [aiImageProvider, setAiImageProvider] = useState("pollinations");
  const [smtpEmail, setSmtpEmail] = useState("");
  const [smtpAppPassword, setSmtpAppPassword] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");

  // نمایش/مخفی کردن کلیدها
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  // وضعیت ذخیره‌سازی و تست اتصال
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [saveErrorMsg, setSaveErrorMsg] = useState("");

  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestStatus, setGeminiTestStatus] = useState<{
    ok?: boolean;
    msg?: string;
  } | null>(null);

  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestStatus, setSmtpTestStatus] = useState<{
    ok?: boolean;
    msg?: string;
  } | null>(null);

  useEffect(() => {
    // بازیابی رمز ذخیره‌شده ادمین در سشن مرورگر
    const savedPass = sessionStorage.getItem("neurostudy_admin_pass");
    if (savedPass && isOpen) {
      setAdminPassword(savedPass);
      loadConfig(savedPass);
    }
  }, [isOpen]);

  const loadConfig = async (pass: string) => {
    setIsLoadingConfig(true);
    setAuthError("");
    try {
      const res = await fetch(`/api/admin/config?password=${encodeURIComponent(pass)}`);
      if (!res.ok) {
        throw new Error("رمز عبور اشتباه است یا دسترسی غیرمجاز است.");
      }
      const data = await res.json();
      if (data.config) {
        setGeminiApiKey(data.config.geminiApiKey || "");
        setOpenaiApiKey(data.config.openaiApiKey || "");
        setAiTextModel(data.config.aiTextModel || "gemini-flash-latest");
        setAiImageProvider(data.config.aiImageProvider || "pollinations");
        setSmtpEmail(data.config.smtpEmail || "");
        setSmtpAppPassword(data.config.smtpAppPassword || "");
        setIsAuthenticated(true);
        sessionStorage.setItem("neurostudy_admin_pass", pass);
      }
    } catch (err: any) {
      setAuthError(err.message || "خطا در احراز هویت ادمین");
      setIsAuthenticated(false);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setAuthError("لطفاً رمز عبور ادمین را وارد نمایید.");
      return;
    }
    loadConfig(adminPassword.trim());
  };

  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    setGeminiTestStatus(null);
    try {
      const res = await fetch("/api/admin/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "gemini",
          apiKey: geminiApiKey,
          model: aiTextModel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeminiTestStatus({ ok: true, msg: data.message });
      } else {
        setGeminiTestStatus({ ok: false, msg: data.error });
      }
    } catch (err: any) {
      setGeminiTestStatus({ ok: false, msg: err.message || "خطا در تست جمینای" });
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    setSmtpTestStatus(null);
    try {
      const res = await fetch("/api/admin/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "smtp",
          smtpEmail,
          smtpAppPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSmtpTestStatus({ ok: true, msg: data.message });
      } else {
        setSmtpTestStatus({ ok: false, msg: data.error });
      }
    } catch (err: any) {
      setSmtpTestStatus({ ok: false, msg: err.message || "خطا در تست ایمیل" });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccessMsg("");
    setSaveErrorMsg("");

    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: adminPassword,
          geminiApiKey,
          openaiApiKey,
          aiTextModel,
          aiImageProvider,
          smtpEmail,
          smtpAppPassword,
          newAdminPassword: newAdminPassword.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg(data.message || "تنظیمات با موفقیت ذخیره شد.");
        if (newAdminPassword.trim()) {
          setAdminPassword(newAdminPassword.trim());
          sessionStorage.setItem("neurostudy_admin_pass", newAdminPassword.trim());
          setNewAdminPassword("");
        }
        setTimeout(() => setSaveSuccessMsg(""), 4000);
      } else {
        setSaveErrorMsg(data.error || "خطا در ذخیره تنظیمات");
      }
    } catch (err: any) {
      setSaveErrorMsg(err.message || "خطا در برقراری ارتباط با سرور");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl">
        {/* هدر مودال */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
            <Shield className="h-5 w-5 text-indigo-400" />
            <span>پنل مدیریت و تنظیمات APIها</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* بخش ورود رمز ادمین */}
        {!isAuthenticated ? (
          <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
            <div className="flex flex-col items-center justify-center text-center space-y-2 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">ورود به پنل مدیریت</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                جهت تغییر کلیدهای هوش مصنوعی و تنظیمات اصلی، رمز عبور ادمین را وارد نمایید.
              </p>
            </div>

            {authError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                رمز عبور مدیریت
              </label>
              <div className="relative">
                <input
                  type={showLoginPass ? "text" : "password"}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="رمز عبور ادمین..."
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 pl-10 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPass(!showLoginPass)}
                  className="absolute left-3 top-3 text-slate-400 hover:text-white transition"
                  title={showLoginPass ? "مخفی‌سازی رمز" : "نمایش رمز"}
                >
                  {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoadingConfig}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {isLoadingConfig ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>در حال بررسی...</span>
                </>
              ) : (
                <span>ورود به پنل تنظیمات</span>
              )}
            </button>
          </form>
        ) : (
          /* فرم تنظیمات APIها */
          <form onSubmit={handleSaveConfig} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
            {saveSuccessMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-300">
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {saveErrorMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{saveErrorMsg}</span>
              </div>
            )}

            {/* ۱. تنظیمات Google Gemini */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                  <Key className="h-4 w-4 text-indigo-400" />
                  کلید API هوش مصنوعی (Google Gemini)
                </span>
                <button
                  type="button"
                  disabled={isTestingGemini}
                  onClick={handleTestGemini}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/50 px-2.5 py-1 text-[11px] font-medium text-indigo-300 transition hover:bg-indigo-900/60 hover:text-white disabled:opacity-50"
                >
                  {isTestingGemini ? (
                    <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                  ) : (
                    <RefreshCw className="h-3 w-3 text-indigo-400" />
                  )}
                  <span>تست اتصال زنده</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type={showGeminiKey ? "text" : "password"}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="کلید Gemini API را اینجا جای‌گذاری کنید..."
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 pl-10 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute left-2.5 top-2 text-slate-400 hover:text-white"
                >
                  {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {geminiTestStatus && (
                <div
                  className={`flex items-center gap-1.5 rounded-lg p-2 text-[11px] ${
                    geminiTestStatus.ok
                      ? "border border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                      : "border border-rose-500/30 bg-rose-950/40 text-rose-300"
                  }`}
                >
                  {geminiTestStatus.ok ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                  )}
                  <span>{geminiTestStatus.msg}</span>
                </div>
              )}

              {/* انتخاب مدل متنی */}
              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  مدل پیش‌فرض هوش مصنوعی متنی:
                </label>
                <select
                  value={aiTextModel}
                  onChange={(e) => setAiTextModel(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="gemini-flash-latest">gemini-flash-latest (توصیه‌شده - سریع و پایدار)</option>
                  <option value="gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite-preview (نسخه سریع ۳.۱)</option>
                  <option value="gemini-3.7-flash">gemini-3.7-flash (مدل قدرتمند ۳.۷)</option>
                  <option value="gemini-3-flash-preview">gemini-3-flash-preview (پیش‌نمایش)</option>
                  <option value="gpt-4o-mini">gpt-4o-mini (در صورت داشتن کلید OpenAI)</option>
                </select>
              </div>
            </div>

            {/* ۲. تنظیمات ایمیل ارسال کد یکبار مصرف (SMTP) */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Mail className="h-4 w-4 text-amber-400" />
                  تنظیمات ارسال ایمیل کد تایید (Gmail SMTP)
                </span>
                <button
                  type="button"
                  disabled={isTestingSmtp}
                  onClick={handleTestSmtp}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-950/50 px-2.5 py-1 text-[11px] font-medium text-amber-300 transition hover:bg-amber-900/60 hover:text-white disabled:opacity-50"
                >
                  {isTestingSmtp ? (
                    <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                  ) : (
                    <RefreshCw className="h-3 w-3 text-amber-400" />
                  )}
                  <span>تست اتصال جیمیل</span>
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    آدرس جیمیل فرستنده (SMTP_EMAIL):
                  </label>
                  <input
                    type="email"
                    value={smtpEmail}
                    onChange={(e) => setSmtpEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    رمز عبور برنامه ۱۶ حرفی گوگل (App Password):
                  </label>
                  <div className="relative">
                    <input
                      type={showSmtpPass ? "text" : "password"}
                      value={smtpAppPassword}
                      onChange={(e) => setSmtpAppPassword(e.target.value)}
                      placeholder="qoay ggur fpwj vdvg"
                      dir="ltr"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 pl-10 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                      className="absolute left-2.5 top-2 text-slate-400 hover:text-white"
                    >
                      {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {smtpTestStatus && (
                <div
                  className={`flex items-center gap-1.5 rounded-lg p-2 text-[11px] ${
                    smtpTestStatus.ok
                      ? "border border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                      : "border border-rose-500/30 bg-rose-950/40 text-rose-300"
                  }`}
                >
                  {smtpTestStatus.ok ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                  )}
                  <span>{smtpTestStatus.msg}</span>
                </div>
              )}
            </div>

            {/* ۳. تغییر رمز عبور پنل مدیریت */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
              <span className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Lock className="h-4 w-4 text-slate-400" />
                تغییر رمز عبور پنل ادمین (اختیاری)
              </span>
              <input
                type="password"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="رمز عبور جدید ادمین (حداقل ۴ کاراکتر)..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* دکمه‌های اکشن */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem("neurostudy_admin_pass");
                  setIsAuthenticated(false);
                }}
                className="rounded-xl border border-slate-700 px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                خروج از پنل
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-xs font-semibold text-white shadow-lg transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>در حال ذخیره‌سازی...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>ذخیره تغییرات</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
