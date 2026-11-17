import { NextRequest, NextResponse } from "next/server";
import { QuestionSolution } from "@/types/solver";

const SOLVER_SYSTEM_PROMPT = `
شما یک استاد خبره و تحلیل‌گر ارشد سوالات تستی و کنکوری در سامانه آموزشی NeuroStudy هستید.
وظیفه شما بررسی دقیق تصویر سوال ارسالی توسط دانش‌آموز، حل کامل مسئله و تعیین قاطعانه گزینه صحیح است.

قوانین الزامی پاسخ‌دهی:
۱. متن سوال و صورت مسئله را دقیقاً از روی تصویر استخراج کنید.
۲. اگر سوال ۴ گزینه‌ای است، فیلد isMultipleChoice را true بگذارید و فیلد correctOptionNumber را دقیقاً با عدد گزینه درست (۱، ۲، ۳ یا ۴) پر کنید. در صورت تشریحی بودن عدد 0 را قرار دهید.
۳. گزینه‌ها را در آرایه options به تفکیک شماره، متن و علت رد/قبول بنویسید.
۴. راه‌حل تشریحی (stepByStepSolution) باید کامل، شفاف و با فرمول‌های دقیق ریاضی/فیزیک/شیمی به فرمت لاتک ($...$ و $$...$$) باشد.
۵. در فیلد keyExamTip، دام آموزشی طراح سوال و تکنیک تستی حل سریع را شرح دهید.
۶. در فیلد ttsSummary، خلاصه روان ۲ تا ۳ جمله‌ای شامل اعلام گزینه درست و دلیل اصلی آن را برای قرائت صوتی بنویسید.

خروجی شما باید منحصراً یک JSON معتبر با ساختار زیر باشد:
{
  "questionText": "متن استخراج‌شده سوال از روی تصویر",
  "isMultipleChoice": true,
  "correctOptionNumber": 3,
  "correctOptionSummary": "گزینه ۳ پاسخ صحیح است",
  "options": [
    { "number": 1, "text": "متن گزینه ۱", "isCorrect": false, "explanation": "دلیل نادرست بودن" },
    { "number": 2, "text": "متن گزینه ۲", "isCorrect": false, "explanation": "دلیل نادرست بودن" },
    { "number": 3, "text": "متن گزینه ۳", "isCorrect": true, "explanation": "دلیل صحیح بودن طبق محاسبات" },
    { "number": 4, "text": "متن گزینه ۴", "isCorrect": false, "explanation": "دلیل نادرست بودن" }
  ],
  "stepByStepSolution": "مراحل گام‌به‌گام حل تشریحی با فرمول‌های لاتک",
  "keyExamTip": "دام تستی یا نکته طلایی برای حل سریع سوال",
  "ttsSummary": "تحلیل سوال انجام شد و گزینه ۳ پاسخ صحیح است زیرا...",
  "subject": "ریاضی / فیزیک / زیست / شیمی / عمومـی"
}
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg", notes, subject = "general" } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { error: "ارسال تصویر سوال الزامی است." },
        { status: 400 }
      );
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const model = process.env.AI_TEXT_MODEL || "gemini-3-flash-preview";

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "کلید API هوش مصنوعی در سرور تنظیم نشده است." },
        { status: 500 }
      );
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    let promptText = `${SOLVER_SYSTEM_PROMPT}\n\n[موضوع سوال]: ${subject}`;
    if (notes) {
      promptText += `\n[یادداشت/راهنمایی دانش‌آموز]: ${notes}`;
    }
    promptText += `\n\nلطفاً تصویر سوال را بررسی و تحلیل را تنها در قالب JSON بالا ارسال کن:`;

    const candidateModels = [
      "gemini-flash-latest",
      "gemini-3.1-flash-lite-preview",
      "gemini-3.7-flash",
      "gemini-flash-lite-latest",
    ];

    let rawContent: string | undefined = undefined;

    for (const modelName of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: promptText },
                  {
                    inlineData: {
                      mimeType,
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2, // دمای پایین برای دقت محاسباتی حداکثری
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawContent) break;
        } else {
          console.warn(`Solver model ${modelName} returned status: ${res.status}`);
        }
      } catch (err) {
        console.warn(`Solver call failed for model ${modelName}:`, err);
      }
    }

    if (!rawContent) {
      return NextResponse.json(
        { error: "خطا در پردازش تصویر سوال با هوش مصنوعی. لطفاً مجدداً تلاش کنید." },
        { status: 500 }
      );
    }

    let parsed: QuestionSolution;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // پاک‌سازی بلاک‌های کد احتمالی
      const cleaned = rawContent
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "")
        .trim();
      parsed = JSON.parse(cleaned);
    }

    parsed.id = `solution-${Date.now()}`;
    parsed.createdAt = new Date().toISOString();

    if (parsed.ttsSummary || parsed.correctOptionSummary) {
      const speechText = `${parsed.correctOptionSummary}. ${parsed.ttsSummary || ""}`;
      parsed.audioUrl = `/api/speech?text=${encodeURIComponent(speechText.slice(0, 300))}`;
    }

    return NextResponse.json({
      success: true,
      solution: parsed,
    });
  } catch (err: any) {
    console.error("Error in /api/solve-question:", err);
    return NextResponse.json(
      { error: err.message || "خطای ناشناخته در حل سوال" },
      { status: 500 }
    );
  }
}
