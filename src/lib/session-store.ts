import fs from "fs/promises";
import path from "path";
import { TutorSession } from "@/types/tutor";

// مدت زمان مجاز نگهداری پیام‌ها و مکالمات: ۲ روز (۴۸ ساعت به میلی‌ثانیه)
export const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

// سازگار با محیط‌های ابری و سرورلس ورسل و نتلیفای (/tmp) و سرورهای محلی (data/sessions)
const SESSIONS_DIR = (process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME)
  ? path.join("/tmp", "sessions")
  : path.join(process.cwd(), "data", "sessions");

/**
 * ایجاد مسیر امن و یکتا برای ذخیره فایل جلسات کاربر
 */
function getSafeUserFilePath(email: string): string {
  const safeName = Buffer.from(email.toLowerCase().trim()).toString("hex");
  return path.join(SESSIONS_DIR, `${safeName}.json`);
}

/**
 * اطمینان از وجود پوشه ذخیره‌سازی داده‌ها
 */
async function ensureSessionsDir() {
  try {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  } catch (err) {
    console.error("Error creating sessions directory:", err);
  }
}

/**
 * بررسی منقضی شدن جلسه بر اساس زمان آخرین فعالیت
 */
function isSessionExpired(session: TutorSession, now: number): boolean {
  const timestamp = new Date(session.updatedAt || session.createdAt || 0).getTime();
  if (isNaN(timestamp) || timestamp === 0) return true;
  return now - timestamp > TWO_DAYS_MS;
}

/**
 * پاکسازی خودکار جلسات و پیام‌های قدیمی‌تر از ۲ روز
 */
export function pruneExpiredSessions(
  sessions: TutorSession[],
  now: number = Date.now()
): TutorSession[] {
  if (!Array.isArray(sessions)) return [];

  return sessions
    .filter((s) => !isSessionExpired(s, now))
    .map((s) => {
      // فیلتر کردن پیام‌های داخل جلسه که عمرشان از ۲ روز گذشته است
      const validMessages = (s.messages || []).filter((m) => {
        const msgTime = new Date(m.createdAt || 0).getTime();
        return !isNaN(msgTime) && now - msgTime <= TWO_DAYS_MS;
      });

      return {
        ...s,
        messages: validMessages,
      };
    })
    .filter((s) => s.messages.length > 0 || !isSessionExpired(s, now))
    .sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
}

/**
 * دریافت جلسات فعال ۲ روز گذشته کاربر با ایمیل
 */
export async function getUserSessions(email: string): Promise<TutorSession[]> {
  if (!email) return [];

  await ensureSessionsDir();
  const filePath = getSafeUserFilePath(email);

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const storedSessions: TutorSession[] = Array.isArray(parsed)
      ? parsed
      : parsed.sessions || [];

    const now = Date.now();
    const activeSessions = pruneExpiredSessions(storedSessions, now);

    // اگر جلسه‌ای به دلیل انقضای ۴۸ ساعته حذف شده بود، فایل به‌روزرسانی شود
    if (activeSessions.length !== storedSessions.length) {
      await fs.writeFile(filePath, JSON.stringify(activeSessions, null, 2), "utf-8");
    }

    return activeSessions;
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      console.warn(`Error reading sessions for user ${email}:`, err);
    }
    return [];
  }
}

/**
 * ذخیره و همگام‌سازی جلسات کاربر در سرور با حذف خودکار موارد منقضی
 */
export async function saveUserSessions(
  email: string,
  sessions: TutorSession[]
): Promise<TutorSession[]> {
  if (!email || !Array.isArray(sessions)) return [];

  await ensureSessionsDir();
  const filePath = getSafeUserFilePath(email);

  const now = Date.now();
  const validSessions = pruneExpiredSessions(sessions, now);

  try {
    await fs.writeFile(filePath, JSON.stringify(validSessions, null, 2), "utf-8");
    return validSessions;
  } catch (err) {
    console.error(`Error saving sessions for user ${email}:`, err);
    return validSessions;
  }
}

/**
 * حذف یک جلسه خاص برای کاربر
 */
export async function deleteUserSession(
  email: string,
  sessionId: string
): Promise<boolean> {
  if (!email || !sessionId) return false;

  await ensureSessionsDir();
  const filePath = getSafeUserFilePath(email);

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const storedSessions: TutorSession[] = Array.isArray(parsed)
      ? parsed
      : parsed.sessions || [];

    const updatedSessions = storedSessions.filter((s) => s.id !== sessionId);
    await fs.writeFile(filePath, JSON.stringify(updatedSessions, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error(`Error deleting session ${sessionId} for user ${email}:`, err);
    return false;
  }
}
