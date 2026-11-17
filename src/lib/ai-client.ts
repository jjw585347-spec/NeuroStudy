/**
 * تنظیمات پایه اتصال به سرویس‌های هوش مصنوعی (تکمیل در فاز ۳)
 */
export const AI_CONFIG = {
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  baseUrl: process.env.AI_BASE_URL || "",
  textModel: process.env.AI_TEXT_MODEL || "gemini-2.5-flash",
  imageProvider: process.env.AI_IMAGE_PROVIDER || "pollinations",
};
