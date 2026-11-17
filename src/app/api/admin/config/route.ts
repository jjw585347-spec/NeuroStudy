import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

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

  await fs.writeFile(envPath, lines.join("\n"), "utf-8");
}

/**
 * دریافت تنظیمات جاری سیستم برای پنل ادمین
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const password = searchParams.get("password");

    const currentAdminPass = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

    if (!password || password !== currentAdminPass) {
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

    const currentAdminPass = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

    if (!password || password !== currentAdminPass) {
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
