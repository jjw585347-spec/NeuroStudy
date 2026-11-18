import { NextRequest, NextResponse } from "next/server";
import {
  generateTutorExplanation,
  generateEducationalImageUrl,
} from "@/lib/ai-service";
import { searchEducationalWebImage } from "@/lib/web-image-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, subject = "general", attachment } = body;

    const finalQuestion = question?.trim() || (attachment ? "لطفاً این فایل / تصویر درسی پیوست‌شده را به طور کامل تحلیل و تدریس کن." : "");

    if (!finalQuestion) {
      return NextResponse.json(
        { error: "متن سوال یا فایل پیوست الزامی است." },
        { status: 400 }
      );
    }

    // ۱. تولید توضیحات آموزشی متنی، دیاگرام Mermaid و استخراج پرامپت تصویری
    const aiResult = await generateTutorExplanation(finalQuestion, subject, attachment);

    // ۲. در صورت عدم تطابق موضوع سوال با دسته‌بندی انتخابی، پاسخ راهنمایی فوری برگردان
    if (aiResult.isOffTopic) {
      const audioUrl = `/api/speech?text=${encodeURIComponent(
        aiResult.ttsSummary || "موضوع سوال با دسته‌بندی انتخابی همخوانی ندارد."
      )}`;

      return NextResponse.json({
        success: true,
        explanation: aiResult.explanation,
        isOffTopic: true,
        detectedSubject: aiResult.detectedSubject,
        suggestedSubjectName: aiResult.suggestedSubjectName,
        diagramCode: undefined,
        needsVisual: false,
        ttsSummary: aiResult.ttsSummary,
        subject: aiResult.subject,
        followUpQuestions: aiResult.followUpQuestions || [],
        imageUrl: undefined,
        audioUrl,
      });
    }

    // ۳. تولید یا واکشی تصویر آماده در صورت نیاز به نمایش بصری
    let imageUrl: string | undefined = undefined;
    let imageSource: "web_encyclopedia" | "ai_generated" = "ai_generated";
    let imageTitle: string | undefined = undefined;
    let isVerified: boolean = false;

    if (aiResult.needsVisual && (aiResult.visualPrompt || aiResult.visualEntity?.canonicalEn)) {
      // جستجوی چندمنبعی در دانشنامه‌های معتبر علمی (ویکی‌پدیای انگلیسی، فارسی و Wikimedia Commons) با داوری بینایی هوش مصنوعی
      const webImage = await searchEducationalWebImage({
        prompt: aiResult.visualPrompt || aiResult.visualEntity?.canonicalEn || finalQuestion,
        question: finalQuestion,
        canonicalEn: aiResult.visualEntity?.canonicalEn,
        canonicalFa: aiResult.visualEntity?.canonicalFa,
        searchQueriesEn: aiResult.visualEntity?.searchQueriesEn,
        category: aiResult.visualEntity?.category,
      });

      if (webImage) {
        imageUrl = webImage.url;
        imageSource = "web_encyclopedia";
        imageTitle = webImage.title;
        isVerified = true;
      }
    }

    // ۴. آماده‌سازی آدرس صوت برای TTS
    const audioUrl = `/api/speech?text=${encodeURIComponent(
      aiResult.ttsSummary || aiResult.explanation.slice(0, 200)
    )}`;

    return NextResponse.json({
      success: true,
      explanation: aiResult.explanation,
      isOffTopic: false,
      detectedSubject: aiResult.detectedSubject,
      suggestedSubjectName: aiResult.suggestedSubjectName,
      diagramCode: aiResult.diagramCode,
      needsVisual: aiResult.needsVisual,
      visualPrompt: aiResult.visualPrompt,
      visualEntity: aiResult.visualEntity,
      ttsSummary: aiResult.ttsSummary,
      subject: aiResult.subject,
      followUpQuestions: aiResult.followUpQuestions || [],
      imageUrl,
      imageSource,
      imageTitle,
      isVerified,
      audioUrl,
    });
  } catch (err: any) {
    console.error("Error in /api/explain route:", err);
    return NextResponse.json(
      { error: err.message || "خطای سرور در تولید پاسخ آموزشی" },
      { status: 500 }
    );
  }
}
