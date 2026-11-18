import { NextRequest, NextResponse } from "next/server";
import { generateEducationalImageUrl } from "@/lib/ai-service";
import { searchEducationalWebImage } from "@/lib/web-image-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      question,
      canonicalEn,
      canonicalFa,
      searchQueriesEn,
      category,
      currentUrl,
      mode = "auto", // "auto" | "force_ai" | "next_web"
    } = body;

    if (!prompt && !question && !canonicalEn && !canonicalFa) {
      return NextResponse.json(
        { error: "مشخصات موضوع برای بازیابی تصویر الزامی است." },
        { status: 400 }
      );
    }

    if (mode === "force_ai") {
      // تولید اجباری مدل سه‌بعدی هوش مصنوعی با سید جدید
      const newSeed = Math.floor(Math.random() * 999999);
      const imageUrl = generateEducationalImageUrl(
        prompt || canonicalEn || question || "scientific subject",
        category,
        newSeed
      );
      return NextResponse.json({
        success: true,
        imageUrl,
        imageSource: "ai_generated",
        imageTitle: "مدل‌سازی سه‌بعدی اختصاصی هوش مصنوعی",
        isVerified: true,
      });
    }

    // جستجوی تصویر معتبر بعدی از اینترنت با رد کردن تصویر فعلی
    const webImage = await searchEducationalWebImage({
      prompt: prompt || canonicalEn || question,
      question,
      canonicalEn,
      canonicalFa,
      searchQueriesEn,
      category,
      excludeUrls: currentUrl ? [currentUrl] : [],
    });

    if (webImage) {
      return NextResponse.json({
        success: true,
        imageUrl: webImage.url,
        imageSource: "web_encyclopedia",
        imageTitle: webImage.title,
        isVerified: true,
      });
    }

    // اگر تصویر دیگری در وب تایید نشد، تولید مدل سه‌بعدی هوش مصنوعی
    const newSeed = Math.floor(Math.random() * 999999);
    const imageUrl = generateEducationalImageUrl(
      prompt || canonicalEn || question || "scientific subject",
      category,
      newSeed
    );

    return NextResponse.json({
      success: true,
      imageUrl,
      imageSource: "ai_generated",
      imageTitle: "مدل‌سازی سه‌بعدی اختصاصی هوش مصنوعی",
      isVerified: true,
    });
  } catch (err: any) {
    console.error("Error in /api/regenerate-image:", err);
    return NextResponse.json(
      { error: err.message || "خطا در تغییر تصویر" },
      { status: 500 }
    );
  }
}
