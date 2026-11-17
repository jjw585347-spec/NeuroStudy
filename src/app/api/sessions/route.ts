import { NextRequest, NextResponse } from "next/server";
import {
  getUserSessions,
  saveUserSessions,
  deleteUserSession,
} from "@/lib/session-store";

/**
 * دریافت جلسات و چت‌های فعال ۲ روز اخیر کاربر با ایمیل
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "ایمیل کاربر الزامی است." },
        { status: 400 }
      );
    }

    const sessions = await getUserSessions(email);

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (err: any) {
    console.error("Error in GET /api/sessions:", err);
    return NextResponse.json(
      { error: err.message || "خطای سرور در دریافت جلسات" },
      { status: 500 }
    );
  }
}

/**
 * ذخیره و همگام‌سازی جلسات در سرور (با انقضای خودکار ۲ روزه)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, sessions } = body;

    if (!email || !Array.isArray(sessions)) {
      return NextResponse.json(
        { error: "ایمیل و لیست جلسات معتبر الزامی است." },
        { status: 400 }
      );
    }

    const savedSessions = await saveUserSessions(email, sessions);

    return NextResponse.json({
      success: true,
      sessions: savedSessions,
    });
  } catch (err: any) {
    console.error("Error in POST /api/sessions:", err);
    return NextResponse.json(
      { error: err.message || "خطای سرور در ذخیره جلسات" },
      { status: 500 }
    );
  }
}

/**
 * حذف یک جلسه چت توسط کاربر
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, sessionId } = body;

    if (!email || !sessionId) {
      return NextResponse.json(
        { error: "ایمیل و شناسه جلسه الزامی است." },
        { status: 400 }
      );
    }

    const success = await deleteUserSession(email, sessionId);

    return NextResponse.json({
      success,
    });
  } catch (err: any) {
    console.error("Error in DELETE /api/sessions:", err);
    return NextResponse.json(
      { error: err.message || "خطای سرور در حذف جلسه" },
      { status: 500 }
    );
  }
}
