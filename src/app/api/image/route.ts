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

    const imageUrl = generateEducationalImageUrl(prompt, undefined, undefined, width, height);

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
  const proxyUrl = searchParams.get("proxyUrl");

  // پروکسی امن برای بارگذاری تصاویر علمی ویکی‌پدیا در صورت اختلال یا فیلترینگ شبکه کاربر
  if (proxyUrl) {
    try {
      const parsed = new URL(proxyUrl);
      const allowedHosts = [
        "wikimedia.org",
        "wikipedia.org",
        "image.pollinations.ai",
      ];
      if (!allowedHosts.some((h) => parsed.hostname.endsWith(h))) {
        return NextResponse.json({ error: "دامنه تصویر مجاز نیست." }, { status: 403 });
      }

      const upstream = await fetch(proxyUrl, {
        headers: {
          "User-Agent":
            "NeuroStudy-Educational-Platform/3.0 (https://neurostudy-tutor.netlify.app)",
          Accept: "image/*,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (upstream.ok) {
        const contentType = upstream.headers.get("content-type") || "image/png";
        const buf = await upstream.arrayBuffer();
        return new NextResponse(buf, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    } catch (e) {
      console.warn("Image proxy error:", e);
    }
  }

  const prompt = searchParams.get("prompt") || "science educational diagram";
  const imageUrl = generateEducationalImageUrl(prompt);
  return NextResponse.redirect(imageUrl);
}
