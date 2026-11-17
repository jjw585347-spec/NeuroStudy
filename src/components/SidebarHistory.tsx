"use client";

import React from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  X,
  Sparkles,
  BookOpen,
  Shield,
  User,
  LogOut,
} from "lucide-react";
import { TutorSession } from "@/types/tutor";

interface SidebarHistoryProps {
  sessions: TutorSession[];
  currentSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  user?: { email: string; name: string } | null;
  onOpenAdmin?: () => void;
  onOpenAuth?: () => void;
}

export default function SidebarHistory({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isOpen,
  onClose,
  user,
  onOpenAdmin,
  onOpenAuth,
}: SidebarHistoryProps) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-72 flex-col border-l border-slate-800 bg-slate-950/95 p-4 transition-transform duration-300 md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">NeuroStudy</h1>
              <p className="text-[10px] text-slate-400">دستیار آموزشی هوشمند</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* وضعیت حساب کاربری */}
        {user ? (
          <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-2.5 text-xs">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white uppercase text-xs">
              {user.name.slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-200 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 truncate" dir="ltr">
                {user.email}
              </p>
            </div>
          </div>
        ) : (
          <div
            onClick={onOpenAuth}
            className="mb-3 cursor-pointer rounded-xl border border-amber-500/25 bg-amber-950/20 p-2 text-center text-[11px] text-amber-300 transition hover:bg-amber-950/40"
          >
            حالت مهمان (کلیک جهت ورود با ایمیل)
          </div>
        )}

        {/* New Chat Button */}
        <button
          type="button"
          onClick={() => {
            onNewSession();
            onClose();
          }}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-violet-500"
        >
          <Plus className="h-4 w-4" />
          گفتگوی درسی جدید
        </button>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
          <div className="mb-2 flex items-center justify-between px-2 text-[11px] font-medium text-slate-400">
            <span>جلسات اخیر</span>
            <span className="text-[10px] text-indigo-400/80 bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-500/20">
              ذخیره ۲ روزه
            </span>
          </div>

          {sessions.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              هنوز گفتگویی ذخیره نشده است
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === currentSessionId;
              return (
                <div
                  key={session.id}
                  className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition ${
                    isActive
                      ? "bg-slate-800/90 text-white font-medium"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSession(session.id);
                      onClose();
                    }}
                    className="flex flex-1 items-center gap-2 truncate text-right"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                    <span className="truncate">{session.title}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    title="حذف نشست"
                    className="opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info badge and Admin */}
        <div className="mt-auto border-t border-slate-900 pt-3 space-y-2">
          {onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 py-2 text-xs text-indigo-300 transition hover:bg-slate-800 hover:text-white"
            >
              <Shield className="h-3.5 w-3.5 text-indigo-400" />
              <span>پنل مدیریت و تنظیمات API</span>
            </button>
          )}

          <div className="flex items-center gap-2 rounded-xl bg-slate-900/60 p-2.5 text-[11px] text-slate-400">
            <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>پشتیبانی از متن، تصویر و صوت آموزشی</span>
          </div>
        </div>
      </aside>
    </>
  );
}
