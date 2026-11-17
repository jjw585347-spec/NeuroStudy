import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { service, apiKey, model, smtpEmail, smtpAppPassword } = body;

    if (service === "gemini") {
      const key = apiKey || process.env.GEMINI_API_KEY;
      if (!key) {
        return NextResponse.json(
          { success: false, error: "کلید API جمینای وارد نشده است." },
          { status: 400 }
        );
      }

      const testModel = model || "gemini-flash-latest";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${key}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Hello, reply with OK" }] }],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return NextResponse.json({
          success: false,
          error: `خطا در اتصال به جمینای (${res.status}): ${
            errData.error?.message || res.statusText
          }`,
        });
      }

      return NextResponse.json({
        success: true,
        message: `اتصال به مدل ${testModel} با موفقیت برقرار شد.`,
      });
    }

    if (service === "smtp") {
      const email = smtpEmail || process.env.SMTP_EMAIL;
      const pass = smtpAppPassword || process.env.SMTP_APP_PASSWORD;

      if (!email || !pass) {
        return NextResponse.json(
          { success: false, error: "ایمیل یا رمز برنامه جیمیل وارد نشده است." },
          { status: 400 }
        );
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: email, pass },
      });

      await transporter.verify();

      return NextResponse.json({
        success: true,
        message: "اتصال به سرویس ایمیل جیمیل (SMTP) با موفقیت تایید شد.",
      });
    }

    return NextResponse.json(
      { success: false, error: "سرویس مورد نظر معتبر نیست." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Test connection error:", err);
    return NextResponse.json({
      success: false,
      error: err.message || "خطا در تست اتصال",
    });
  }
}
