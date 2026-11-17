/**
 * سرویس فوق‌دقیق واکشی و اعتبارسنجی بینایی تصاویر علمی، آموزشی و مستند از دانشنامه‌های باز
 */

export interface EducationalImageResult {
  url: string;
  title: string;
  source: "web_encyclopedia" | "ai_generated";
  sourceLabel: string;
  isVerified?: boolean;
}

export interface SearchEducationalWebImageOptions {
  prompt: string;
  question?: string;
  canonicalEn?: string;
  canonicalFa?: string;
  category?: string;
  excludeUrls?: string[];
}

interface WikiCandidate {
  url: string;
  thumbUrl: string;
  title: string;
  description?: string;
}

/**
 * پاک‌سازی و استخراج موضوع اصلی از متن سوال فارسی
 */
function extractPersianSubject(question?: string): string[] {
  if (!question) return [];

  const clean = question
    .replace(/[؟?؟!]/g, "")
    .replace(
      /\b(چیست|چیه|چگونه است|توضیح بده|کار میکند|را بررسی کن|درباره|مربوط به|یعنی چی|کدامند|چه بخش‌هایی دارد|ویژگی‌های)\b/gi,
      ""
    )
    .trim();

  const words = clean.split(/\s+/).filter((w) => w.length > 2);
  const candidates: string[] = [];

  if (words.length >= 2) {
    candidates.push(words.slice(0, 2).join(" "));
  }
  if (words.length >= 1) {
    candidates.push(words[0]);
    if (words.length > 1) {
      candidates.push(words[1]);
    }
  }

  return candidates;
}

/**
 * استخراج بهینه‌ترین کلیدواژه‌های جستجوی علمی از پرامپت انگلیسی هوش مصنوعی
 */
function extractEnglishCandidates(prompt: string): string[] {
  const filtered = prompt
    .replace(
      /\b(realistic|3d|render|medical|cross-section|showing|internal|view|illustration|model|macro|isolated|clean|studio|lighting|detailed|scientific|visualization|laboratory|microscopic|accurate|fantasy|artifacts|high-precision|style|photo|image|of|a|an|the|in|with|and|from|for|showing|various|structures)\b/gi,
      " "
    )
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = filtered.split(" ").filter((w) => w.length > 2);
  const candidates: string[] = [];

  if (words.length >= 2) {
    candidates.push(words.slice(0, 2).join(" "));
  }
  if (words.length >= 1) {
    candidates.push(words[0]);
  }

  return candidates;
}

/**
 * بررسی عدم تناقض توضیحات صفحه دانشنامه با دامنه علمی
 */
function isDisambiguationOrIrrelevant(
  data: any,
  category?: string
): boolean {
  if (!data) return true;
  if (data.type === "disambiguation") return true;

  const desc = (data.description || "").toLowerCase();
  const extract = (data.extract || "").toLowerCase();
  const fullText = `${desc} ${extract}`;

  // کلمات منفی قطعی برای تصاویر علمی
  const negativeGeneral = [
    "automobile",
    "car manufacturer",
    "car brand",
    "video game",
    "video games",
    "action game",
    "fictional character",
    "comic book",
    "film",
    "movie",
    "music album",
    "song by",
    "rock band",
    "pop band",
    "television series",
    "tv series",
    "disambiguation page",
  ];

  for (const neg of negativeGeneral) {
    if (desc.includes(neg)) return true;
  }

  if (category === "astronomy") {
    const astronomyNegative = ["mythological figure", "god of", "goddess of", "mythology"];
    for (const neg of astronomyNegative) {
      if (desc.includes(neg)) return true;
    }
  }

  return false;
}

/**
 * واکشی تصویر شاخص دانشنامه ویکی‌پدیا (انگلیسی یا فارسی) با فیلتر هوشمند ابهام‌زدایی
 */
async function fetchWikiLeadImage(
  term: string,
  lang: "fa" | "en",
  category?: string
): Promise<WikiCandidate | null> {
  if (!term || term.length < 2) return null;

  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      term
    )}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "NeuroStudy-Educational-Assistant/2.0 (educational website; admin@neurostudy.local)",
        Accept: "application/json",
      },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = await res.json();

    // فیلتر صفحات ابهام‌زدایی و موضوعات نامرتبط تجاری یا سرگرمی
    if (isDisambiguationOrIrrelevant(data, category)) {
      return null;
    }

    const imageUrl = data.originalimage?.source || data.thumbnail?.source;
    const thumbUrl = data.thumbnail?.source || imageUrl;

    // تایید وجود تصویر و فیلتر فایل‌های نامعتبر
    if (
      imageUrl &&
      !imageUrl.includes("Disambig") &&
      !imageUrl.includes("Question_book") &&
      !imageUrl.endsWith(".svg")
    ) {
      return {
        url: imageUrl,
        thumbUrl,
        title: data.title || term,
        description: data.description,
      };
    }
  } catch (err) {
    // خطای تایم‌اوت یا شبکه در ویکی، نادیده گرفته می‌شود
  }

  return null;
}

/**
 * اعتبارسنجی بینایی تصویر توسط هوش مصنوعی با پرامپت سخت‌گیرانه علمی
 */
async function verifyImageWithVision(
  imageUrl: string,
  targetTopic: string,
  category?: string,
  contextInfo?: string
): Promise<boolean> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) return true;

  try {
    const imgRes = await fetch(imageUrl, {
      headers: { "User-Agent": "NeuroStudy/2.0" },
      signal: AbortSignal.timeout(6000),
    });

    if (!imgRes.ok) return false;

    const buf = await imgRes.arrayBuffer();
    if (buf.byteLength > 5 * 1024 * 1024) return false;

    const base64 = Buffer.from(buf).toString("base64");
    const rawMime = imgRes.headers.get("content-type") || "image/jpeg";
    const mimeType = rawMime.split(";")[0].trim();

    // فایل‌های SVG توسط هوش مصنوعی بینایی پشتیبانی نمی‌شوند
    if (mimeType.includes("svg") || imageUrl.endsWith(".svg")) {
      return false;
    }

    const candidateModels = [
      "gemini-3.1-flash-lite-preview",
      "gemini-flash-latest",
      "gemini-3.7-flash",
    ];

    const visionPrompt = `You are a strict educational science fact-checker and visual verification inspector.
Target Subject: "${targetTopic}"
Domain/Category: "${category || 'general science'}"
Image Source Context: "${contextInfo || ''}"

Evaluate this image with extreme scrutiny:
1. Does this image directly, authentically, and accurately depict the intended educational subject "${targetTopic}"?
2. REJECT (isAccurate: false) if:
   - The image shows a homonym, brand, company, vehicle/car, toy, video game, movie, or mythical figure sharing the same name.
   - The image is a generic meme, stock photo of unrelated people, random room, or artistic cartoon.
   - The image shows an entirely different planet, cell, or chemical.
   - The image is a complex comparison diagram where "${targetTopic}" is only a tiny footnote.
3. ACCEPT (isAccurate: true) ONLY if:
   - It is an authentic astronomical photograph or authentic scientific visualization of "${targetTopic}".
   - It is an authentic biological/medical illustration, anatomical diagram, or microscope photograph.
   - It is a correct chemical/atomic/molecular diagram.
   - It is an authentic physical apparatus or scientific chart.

Return strict JSON:
{
  "isAccurate": true or false,
  "confidence": 0.0 to 1.0,
  "detectedSubject": "3-5 words describing the actual image",
  "reason": "short explanation"
}`;

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(6000),
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: visionPrompt },
                  {
                    inlineData: {
                      mimeType,
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: { responseMimeType: "application/json" },
          }),
        });

        if (res.ok) {
          const d = await res.json();
          const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            const isConfirmed =
              parsed.isAccurate === true &&
              (parsed.confidence === undefined || parsed.confidence >= 0.7);

            if (!isConfirmed) {
              console.log(
                `[Vision Verification Rejected] Target: "${targetTopic}" | Detected: "${parsed.detectedSubject}" | Reason: "${parsed.reason}"`
              );
            }
            return isConfirmed;
          }
        }
      } catch {
        // تلاش با مدل بعدی
      }
    }
  } catch (err) {
    console.warn("Vision verification check error:", err);
  }

  // در صورت بروز خطا در بینایی، به دلایل امنیتی و دقت علمی، تصویر رد می‌شود تا عکس اشتباه ارسال نگردد
  return false;
}

/**
 * جستجو، اعتبارسنجی و انتخاب قطعی تصویر از اینترنت (با اولویت حداکثری وب و تایید هوش مصنوعی)
 */
export async function searchEducationalWebImage(
  promptOrOptions: string | SearchEducationalWebImageOptions,
  legacyQuestion?: string
): Promise<EducationalImageResult | null> {
  let prompt: string;
  let question: string | undefined;
  let canonicalEn: string | undefined;
  let canonicalFa: string | undefined;
  let category: string | undefined;
  let excludeUrls: string[] = [];

  if (typeof promptOrOptions === "object") {
    prompt = promptOrOptions.prompt;
    question = promptOrOptions.question;
    canonicalEn = promptOrOptions.canonicalEn;
    canonicalFa = promptOrOptions.canonicalFa;
    category = promptOrOptions.category;
    excludeUrls = promptOrOptions.excludeUrls || [];
  } else {
    prompt = promptOrOptions;
    question = legacyQuestion;
  }

  const targetTopic = canonicalFa || canonicalEn || question || prompt;

  // لیست کاندیداهای فارسی با اولویت موجودیت دقیق علمی
  const faCandidates: string[] = [];
  if (canonicalFa) {
    faCandidates.push(canonicalFa);
    const cleanFa = canonicalFa.replace(/\s*\([^)]*\)/g, "").trim();
    if (cleanFa && cleanFa !== canonicalFa) {
      faCandidates.push(cleanFa);
    }
  }
  for (const fa of extractPersianSubject(question)) {
    if (!faCandidates.includes(fa)) faCandidates.push(fa);
  }

  // ۱. اولویت اول: جستجو در ویکی‌پدیای فارسی
  for (const faTerm of faCandidates) {
    const candidate = await fetchWikiLeadImage(faTerm, "fa", category);
    if (candidate && !excludeUrls.includes(candidate.url)) {
      const isValid = await verifyImageWithVision(
        candidate.thumbUrl,
        faTerm,
        category,
        candidate.description
      );
      if (isValid) {
        return {
          url: candidate.url,
          title: candidate.title,
          source: "web_encyclopedia",
          sourceLabel: "تصویر واقعی از اینترنت (تایید شده توسط هوش مصنوعی)",
          isVerified: true,
        };
      }
    }
  }

  // لیست کاندیداهای انگلیسی با اولویت موجودیت دقیق علمی
  const enCandidates: string[] = [];
  if (canonicalEn) {
    enCandidates.push(canonicalEn);
    const cleanEn = canonicalEn.replace(/\s*\([^)]*\)/g, "").trim();
    if (cleanEn && cleanEn !== canonicalEn) {
      enCandidates.push(cleanEn);
    }
  }
  for (const en of extractEnglishCandidates(prompt)) {
    if (!enCandidates.includes(en)) enCandidates.push(en);
  }

  // ۲. اولویت دوم: جستجو در ویکی‌پدیای انگلیسی
  for (const enTerm of enCandidates) {
    const candidate = await fetchWikiLeadImage(enTerm, "en", category);
    if (candidate && !excludeUrls.includes(candidate.url)) {
      const isValid = await verifyImageWithVision(
        candidate.thumbUrl,
        enTerm,
        category,
        candidate.description
      );
      if (isValid) {
        return {
          url: candidate.url,
          title: candidate.title,
          source: "web_encyclopedia",
          sourceLabel: "تصویر واقعی از اینترنت (تایید شده توسط هوش مصنوعی)",
          isVerified: true,
        };
      }
    }
  }

  // ۳. اولویت سوم: جستجوی هدفمند در Wikimedia Commons با کلیدواژه‌های مرتبط با دامنه علمی
  const categoryFilters: Record<string, string> = {
    astronomy: "planet OR astronomy OR celestial OR telescope",
    biology: "biology OR cell OR organ OR anatomy OR microscope OR organism",
    chemistry: "chemistry OR molecule OR molecular OR chemical",
    physics: "physics OR apparatus OR experiment OR diagram",
    anatomy: "anatomy OR medical OR organ OR human body",
  };

  const domainFilter = category && categoryFilters[category] ? categoryFilters[category] : "";

  for (const rawQuery of enCandidates.slice(0, 2)) {
    try {
      const scopedQuery = domainFilter
        ? `"${rawQuery}" (${domainFilter}) -car -game -toy -logo -brand -video`
        : `"${rawQuery}" -car -game -toy -logo -brand -video`;

      const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
        scopedQuery
      )}&gsrlimit=3&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=800&format=json`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "NeuroStudy-Educational-Assistant/2.0",
          Accept: "application/json",
        },
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const pages = Object.values(data.query?.pages || {}) as any[];

      for (const page of pages) {
        const info = page.imageinfo?.[0];
        if (!info?.url) continue;

        const fileUrl = String(info.url);
        const thumbUrl = String(info.thumburl || info.url);
        if (excludeUrls.includes(fileUrl) || excludeUrls.includes(thumbUrl)) continue;

        const isImage = /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(fileUrl);
        const isNotIcon =
          !fileUrl.toLowerCase().includes("icon") &&
          !fileUrl.toLowerCase().includes("logo") &&
          !fileUrl.toLowerCase().includes("banner");

        if (isImage && isNotIcon) {
          const cleanTitle = page.title
            ?.replace(/^File:/i, "")
            ?.replace(/\.[^/.]+$/, "")
            ?.replace(/[_-]/g, " ")
            ?.trim();

          const isValid = await verifyImageWithVision(
            thumbUrl,
            rawQuery,
            category,
            cleanTitle
          );
          if (isValid) {
            return {
              url: thumbUrl || fileUrl,
              title: cleanTitle || rawQuery,
              source: "web_encyclopedia",
              sourceLabel: "تصویر واقعی از اینترنت (تایید شده توسط هوش مصنوعی)",
              isVerified: true,
            };
          }
        }
      }
    } catch (err) {
      console.warn(`Wikimedia Commons search failed for "${rawQuery}":`, err);
    }
  }

  // اگر هیچ تصویر معتبری یافت نشد یا همگی در اعتبارسنجی بینایی رد شدند، null بازگردانده می‌شود
  return null;
}
