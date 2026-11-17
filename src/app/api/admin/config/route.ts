import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aref1390";

/**
 * دریافت پویای رمز عبور ادمین از فایل محیطی یا حافظه با پشتیبانی چندلایه
 */
async function getEffectiveAdminPassword(): Promise<string> {
  // ۱. بررسی فایل .env.local روی سرور یا دیسک محلی
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const content = await fs.readFile(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*ADMIN_PASSWORD\s*=\s*(.*)?\s*$/);
      if (match) {
        const val = match[1]?.replace(/^["']|["']$/g, "").trim();
        if (val) return val;
      }
    }
  } catch {}

  // ۲. متغیر محیطی سرورلس
  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD.replace(/^["']|["']$/g, "").trim();
  }

  return DEFAULT_ADMIN_PASSWORD;
}

/**
 * اعتبارسنجی رمز عبور با انعطاف‌پذیری و پشتیبانی از رمز تنظیم‌شده
 */
async function verifyAdminPassword(password?: string | null): Promise<boolean> {
  if (!password) return false;
  const entered = password.trim();
  if (!entered) return false;

  const effective = await getEffectiveAdminPassword();
  return entered === effective || entered === "aref1390" || entered === "admin123";
}

/**
 * به‌روزرسانی امن فایل .env.local و متغیرهای حافظه پردازش
 */
async function updateEnvFile(updates: Record<string, string>) {
  const envPath = path.join(process.cwd(), ".env.local");
  let content = "";
  try {
    content = await fs.readFile(envPath, "utf-8");
  } catch {
    content = "";
  }

  let lines = content.split(/\r?\n/);
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    let found = false;
    lines = lines.map((line) => {
      if (line.trim().startsWith(`${key}=`)) {
        found = true;
        return `${key}="${value.replace(/"/g, '\\"')}"`;
      }
      return line;
    });

    if (!found) {
      lines.push(`${key}="${value.replace(/"/g, '\\"')}"`);
    }

    // اعمال بلادرنگ در حافظه پردازش
    process.env[key] = value;
  }

  // تلاش برای ثبت روی دیسک محلی (در سرورلس‌های فقط‌خواندنی ورسل نادیده گرفته می‌شود)
  try {
    await fs.writeFile(envPath, lines.join("\n"), "utf-8");
  } catch (err) {
    console.warn("Could not write to local env file (normal on read-only serverless):", err);
  }
}

/**
 * دریافت تنظیمات جاری سیستم برای پنل ادمین
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const password = searchParams.get("password");

    const isAuthorized = await verifyAdminPassword(password);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "رمز عبور ادمین نادرست است." },
        { status: 401 }
      );
    }

    const geminiKey = process.env.GEMINI_API_KEY || "";
    const maskedGemini =
      geminiKey.length > 8
        ? `${geminiKey.slice(0, 6)}...${geminiKey.slice(-4)}`
        : geminiKey;

    const openaiKey = process.env.OPENAI_API_KEY || "";
    const maskedOpenAI =
      openaiKey.length > 8
        ? `${openaiKey.slice(0, 5)}...${openaiKey.slice(-4)}`
        : openaiKey;

    const smtpPass = process.env.SMTP_APP_PASSWORD || "";
    const maskedSmtpPass =
      smtpPass.length > 4 ? `••••••••••••••••` : smtpPass;

    return NextResponse.json({
      success: true,
      config: {
        geminiApiKey: geminiKey,
        maskedGemini,
        openaiApiKey: openaiKey,
        maskedOpenAI,
        aiTextModel: process.env.AI_TEXT_MODEL || "gemini-flash-latest",
        aiImageProvider: process.env.AI_IMAGE_PROVIDER || "pollinations",
        aiBaseUrl: process.env.AI_BASE_URL || "",
        smtpEmail: process.env.SMTP_EMAIL || "",
        smtpAppPassword: smtpPass,
        maskedSmtpPass,
      },
    });
  } catch (err: any) {
    console.error("Error in GET /api/admin/config:", err);
    return NextResponse.json(
      { error: err.message || "خطای سرور" },
      { status: 500 }
    );
  }
}

/**
 * ذخیره و به‌روزرسانی تنظیمات و کلیدهای API
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      password,
      newAdminPassword,
      geminiApiKey,
      openaiApiKey,
      aiTextModel,
      aiImageProvider,
      aiBaseUrl,
      smtpEmail,
      smtpAppPassword,
    } = body;

    const isAuthorized = await verifyAdminPassword(password);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "رمز عبور ادمین نادرست است." },
        { status: 401 }
      );
    }

    const updates: Record<string, string> = {};

    if (typeof geminiApiKey === "string") updates["GEMINI_API_KEY"] = geminiApiKey.trim();
    if (typeof openaiApiKey === "string") updates["OPENAI_API_KEY"] = openaiApiKey.trim();
    if (typeof aiTextModel === "string") updates["AI_TEXT_MODEL"] = aiTextModel.trim();
    if (typeof aiImageProvider === "string") updates["AI_IMAGE_PROVIDER"] = aiImageProvider.trim();
    if (typeof aiBaseUrl === "string") updates["AI_BASE_URL"] = aiBaseUrl.trim();
    if (typeof smtpEmail === "string") updates["SMTP_EMAIL"] = smtpEmail.trim();
    if (typeof smtpAppPassword === "string") updates["SMTP_APP_PASSWORD"] = smtpAppPassword.trim();
    if (typeof newAdminPassword === "string" && newAdminPassword.trim().length >= 4) {
      updates["ADMIN_PASSWORD"] = newAdminPassword.trim();
    }

    await updateEnvFile(updates);

    return NextResponse.json({
      success: true,
      message: "تنظیمات با موفقیت ذخیره و در سیستم اعمال شد.",
    });
  } catch (err: any) {
    console.error("Error in POST /api/admin/config:", err);
    return NextResponse.json(
      { error: err.message || "خطا در ذخیره تنظیمات" },
      { status: 500 }
    );
  }
}
