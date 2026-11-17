import { NextRequest, NextResponse } from "next/server";
import { generateEducationalImageUrl } from "@/lib/ai-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, width = 800, height = 500 } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "پرامپت تصویر الزامی است." },
        { status: 400 }
      );
    }

    const imageUrl = generateEducationalImageUrl(prompt, width, height);

    return NextResponse.json({
      success: true,
      imageUrl,
      prompt,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "خطا در تولید تصویر" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const prompt = searchParams.get("prompt") || "science educational diagram";
  const imageUrl = generateEducationalImageUrl(prompt);
  return NextResponse.redirect(imageUrl);
}
