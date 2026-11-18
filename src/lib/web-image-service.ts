/**
 * سرویس فوق‌دقیق واکشی، رتبه‌بندی چندمنبعی و داوری بینایی تصاویر علمی از ویکی‌پدیا و Wikimedia Commons
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
  searchQueriesEn?: string[];
  category?: string;
  excludeUrls?: string[];
}

interface WikiCandidate {
  url: string;
  thumbUrl: string;
  title: string;
  description?: string;
  origin: "en_wiki_exact" | "fa_wiki_exact" | "en_wiki_search" | "commons";
}

const WIKI_HEADERS = {
  "User-Agent":
    "NeuroStudy-Educational-Platform/3.0 (https://neurostudy-tutor.netlify.app; educational science tutor)",
  Accept: "application/json",
};

/**
 * تبدیل آدرس تصویر تامبنیل ویکی‌پدیا به کیفیت بالا (1000px PNG)
 * به ویژه برای فایل‌های دیاگرام علمی SVG که تامبنیل آن‌ها PNG باکیفیت است
 */
function upgradeWikiThumbToHighRes(thumbUrl?: string, originalUrl?: string): string {
  if (!thumbUrl && !originalUrl) return "";
  const isSvg = originalUrl?.toLowerCase().endsWith(".svg") || thumbUrl?.toLowerCase().includes(".svg/");
  if (isSvg && thumbUrl) {
    return thumbUrl.replace(/(\/|-)(\d+)px-/, "$11000px-");
  }
  if (originalUrl && !isSvg) {
    return originalUrl;
  }
  return thumbUrl ? thumbUrl.replace(/(\/|-)(\d+)px-/, "$11000px-") : "";
}

/**
 * پاک‌سازی و استخراج موضوع اصلی از متن سوال فارسی
 */
function extractPersianSubject(question?: string): string[] {
  if (!question) return [];

  const clean = question
    .replace(/[؟?؟!،.]/g, " ")
    .replace(
      /\b(در مورد|درباره|مربوط به|چیست|چیه|چگونه است|چگونه|چطور|توضیح بده|توضیح دهید|کار میکند|را بررسی کن|یعنی چی|کدامند|کدام است|چه بخش‌هایی دارد|ویژگی‌های|ساختار|نحوه|فرآیند|فرایند|انجام می‌شود|می‌شود|بگو|لطفا|لطفاً|کامل|جامع)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  const words = clean.split(/\s+/).filter((w) => w.length > 2);
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
 * استخراج کلیدواژه‌های جستجوی علمی از پرامپت انگلیسی
 */
function extractEnglishCandidates(prompt: string): string[] {
  const filtered = prompt
    .replace(
      /\b(realistic|3d|render|medical|cross-section|showing|internal|view|illustration|model|macro|isolated|clean|studio|lighting|detailed|scientific|visualization|laboratory|microscopic|accurate|fantasy|artifacts|high-precision|style|photo|image|diagram|chart|photograph|exact|of|a|an|the|in|with|and|from|for|various|structures|high-detail)\b/gi,
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
function isDisambiguationOrIrrelevant(data: any, category?: string): boolean {
  if (!data) return true;
  if (data.type === "disambiguation") return true;

  const desc = (data.description || "").toLowerCase();
  const title = (data.title || "").toLowerCase();

  const negativeGeneral = [
    "automobile",
    "car manufacturer",
    "car brand",
    "video game",
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
    "disambiguation",
    "surname",
    "given name",
    "municipality",
    "footballer",
    "politician",
    "actor",
    "singer",
  ];

  for (const neg of negativeGeneral) {
    if (desc.includes(neg) || title.includes(`(${neg})`)) return true;
  }

  if (category === "astronomy") {
    const astronomyNegative = ["mythological", "god of", "goddess of", "mythology"];
    for (const neg of astronomyNegative) {
      if (desc.includes(neg)) return true;
    }
  }

  return false;
}

/**
 * بررسی معتبر بودن آدرس تصویر (حذف آیکون‌های عمومی ویکی‌پدیا)
 */
function isValidImageUrl(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  const bannedPatterns = [
    "disambig",
    "question_book",
    "ambox",
    "commons-logo",
    "wiki_letter",
    "edit-clear",
    "padlock",
    "speaker_icon",
    "nuvola",
    "crystal_clear",
    "flag_of_",
    "coat_of_arms",
    "red_pencil",
    "folder_hexagonal",
  ];
  return !bannedPatterns.some((p) => lower.includes(p));
}

/**
 * ۱. واکشی تصویر شاخص مقاله ویکی‌پدیا (با پشتیبانی کامل از دیاگرام‌های برداری SVG تبدیل‌شده به PNG)
 */
async function fetchWikiLeadImage(
  term: string,
  lang: "en" | "fa",
  category?: string
): Promise<WikiCandidate | null> {
  if (!term || term.length < 2) return null;

  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      term.trim()
    )}`;

    const res = await fetch(url, {
      headers: WIKI_HEADERS,
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(4500),
    });

    if (!res.ok) return null;
    const data = await res.json();

    if (isDisambiguationOrIrrelevant(data, category)) {
      return null;
    }

    const origSource = data.originalimage?.source;
    const thumbSource = data.thumbnail?.source;

    if (!origSource && !thumbSource) return null;

    // اگر فایل اصلی SVG باشد، حتماً از نسخه PNG رندر شده توسط ویکی‌پدیا (thumbSource) استفاده می‌کنیم
    const displayUrl = upgradeWikiThumbToHighRes(thumbSource, origSource);
    const visionThumbUrl = thumbSource || origSource;

    if (
      isValidImageUrl(displayUrl) &&
      visionThumbUrl &&
      !visionThumbUrl.toLowerCase().endsWith(".svg") &&
      !visionThumbUrl.toLowerCase().endsWith(".gif") &&
      !visionThumbUrl.toLowerCase().endsWith(".tif")
    ) {
      return {
        url: displayUrl,
        thumbUrl: visionThumbUrl,
        title: data.title || term,
        description: data.description || data.extract?.slice(0, 140),
        origin: lang === "en" ? "en_wiki_exact" : "fa_wiki_exact",
      };
    }
  } catch {
    // نادیده گرفتن خطای شبکه
  }

  return null;
}

/**
 * ۲. جستجوی صفحات علمی مرتبط در ویکی‌پدیای انگلیسی و استخراج تصاویر شاخص آن‌ها
 */
async function searchEnWikipediaImages(
  query: string,
  category?: string
): Promise<WikiCandidate[]> {
  if (!query || query.length < 2) return [];

  try {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=4&prop=pageimages|description&piprop=thumbnail|original&pithumbsize=900&format=json`;

    const res = await fetch(apiUrl, {
      headers: WIKI_HEADERS,
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(4500),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {}) as any[];
    pages.sort((a, b) => (a.index || 99) - (b.index || 99));

    const results: WikiCandidate[] = [];
    for (const p of pages) {
      if (isDisambiguationOrIrrelevant(p, category)) continue;
      const thumbSource = p.thumbnail?.source;
      const origSource = p.original?.source;
      if (!thumbSource) continue;

      const displayUrl = upgradeWikiThumbToHighRes(thumbSource, origSource);
      if (
        isValidImageUrl(displayUrl) &&
        !thumbSource.toLowerCase().endsWith(".svg") &&
        !thumbSource.toLowerCase().endsWith(".gif")
      ) {
        results.push({
          url: displayUrl,
          thumbUrl: thumbSource,
          title: p.title,
          description: p.description,
          origin: "en_wiki_search",
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * ۳. جستجوی دیاگرام‌ها و تصاویر آموزشی در Wikimedia Commons
 */
async function searchWikimediaCommonsImages(
  query: string,
  category?: string
): Promise<WikiCandidate[]> {
  if (!query || query.length < 2) return [];

  const categoryFilters: Record<string, string> = {
    astronomy: "planet OR astronomy OR space OR solar",
    biology: "biology OR cell OR anatomy OR diagram OR organism",
    chemistry: "chemistry OR molecule OR atom OR reaction",
    physics: "physics OR diagram OR force OR wave OR optics",
    anatomy: "anatomy OR organ OR human OR medical",
    math: "geometry OR math OR theorem OR graph",
  };

  const domainHint = category && categoryFilters[category] ? ` (${categoryFilters[category]})` : "";
  const scopedQuery = `${query}${domainHint} -car -game -logo -flag -stamp -portrait`;

  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      scopedQuery
    )}&gsrlimit=4&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=900&format=json`;

    const res = await fetch(url, {
      headers: WIKI_HEADERS,
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(4500),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {}) as any[];

    const results: WikiCandidate[] = [];
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl && !info?.url) continue;

      const thumbUrl = String(info.thumburl || info.url);
      const origUrl = String(info.url);

      if (!isValidImageUrl(origUrl) || !isValidImageUrl(thumbUrl)) continue;
      if (
        thumbUrl.toLowerCase().endsWith(".svg") ||
        thumbUrl.toLowerCase().endsWith(".gif") ||
        thumbUrl.toLowerCase().endsWith(".tif") ||
        thumbUrl.toLowerCase().endsWith(".pdf") ||
        thumbUrl.toLowerCase().endsWith(".webm") ||
        thumbUrl.toLowerCase().endsWith(".ogv")
      ) {
        continue;
      }

      const cleanTitle =
        page.title
          ?.replace(/^File:/i, "")
          ?.replace(/\.[^/.]+$/, "")
          ?.replace(/[_-]/g, " ")
          ?.trim() || query;

      const rawDesc =
        info.extmetadata?.ImageDescription?.value ||
        info.extmetadata?.ObjectName?.value ||
        "";
      const cleanDesc = String(rawDesc).replace(/<[^>]*>/g, "").slice(0, 140);

      results.push({
        url: upgradeWikiThumbToHighRes(thumbUrl, origUrl),
        thumbUrl,
        title: cleanTitle,
        description: cleanDesc,
        origin: "commons",
      });
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * داوری و انتخاب بهترین تصویر از میان کاندیداها با استفاده از هوش مصنوعی بینایی (Vision Ranking)
 */
async function selectBestCandidateWithVision(
  candidates: WikiCandidate[],
  question: string,
  targetTopic: string,
  category?: string
): Promise<{ selected: WikiCandidate; captionFa?: string } | null> {
  if (candidates.length === 0) return null;

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return { selected: candidates[0] };
  }

  // دانلود موازی تامبنیل حداکثر ۴ کاندیدای برتر برای ارسال هم‌زمان به مدل بینایی
  const topCandidates = candidates.slice(0, 4);
  const downloaded = await Promise.all(
    topCandidates.map(async (cand) => {
      try {
        const res = await fetch(cand.thumbUrl, {
          headers: WIKI_HEADERS,
          signal: AbortSignal.timeout(4500),
        });
        if (!res.ok) return null;
        const rawMime = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
        if (!rawMime.startsWith("image/") || rawMime.includes("svg")) return null;
        const buf = await res.arrayBuffer();
        if (buf.byteLength < 1500 || buf.byteLength > 4 * 1024 * 1024) return null;
        return {
          candidate: cand,
          base64: Buffer.from(buf).toString("base64"),
          mimeType: rawMime,
        };
      } catch {
        return null;
      }
    })
  );

  const validItems = downloaded.filter(
    (item): item is { candidate: WikiCandidate; base64: string; mimeType: string } =>
      item !== null
  );

  if (validItems.length === 0) {
    // اگر دانلود بایت‌ها به هر دلیل انجام نشد ولی کاندیدای دقیق ویکی‌پدیا داشتیم
    const exactMatch = candidates.find(
      (c) => c.origin === "en_wiki_exact" || c.origin === "fa_wiki_exact"
    );
    return exactMatch ? { selected: exactMatch } : null;
  }

  const visionModels = [
    "gemini-3-flash-preview",
    "gemma-4-26b-a4b-it",
    "gemini-3.1-flash-lite-preview",
  ];

  const promptParts: any[] = [
    {
      text: `You are a strict scientific visual editor for an educational platform.
Student Question: "${question}"
Target Scientific Concept: "${targetTopic}" (Category: ${category || "science"})

Below are ${validItems.length} candidate images (indexed 0 to ${validItems.length - 1}) retrieved from Wikipedia/Wikimedia.
Your task:
1. Examine all candidate images carefully.
2. Select the SINGLE BEST, most accurate, clearest educational diagram or authentic scientific photograph that directly illustrates "${targetTopic}" and helps answer "${question}".
3. REJECT any image that shows an unrelated person/portrait, city map, building, car, book cover, logo, or wrong scientific concept.
4. If NONE of the images are relevant and scientifically accurate for "${targetTopic}", set "bestIndex": -1.

Return ONLY valid JSON:
{
  "bestIndex": 0,
  "confidence": 0.95,
  "captionFa": "توضیح علمی کوتاه و دقیق به زبان فارسی درباره آنچه در این تصویر/نمودار دیده می‌شود"
}`,
    },
  ];

  validItems.forEach((item, idx) => {
    promptParts.push({
      text: `\n--- Candidate Image [${idx}]: Title="${item.candidate.title}", Info="${
        item.candidate.description || ""
      }" ---`,
    });
    promptParts.push({
      inlineData: {
        mimeType: item.mimeType,
        data: item.base64,
      },
    });
  });

  for (const model of visionModels) {
    try {
      const isGemma = model.startsWith("gemma");
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(9000),
          body: JSON.stringify({
            contents: [{ role: "user", parts: promptParts }],
            generationConfig: isGemma
              ? { temperature: 0.1 }
              : { responseMimeType: "application/json", temperature: 0.1 },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        if (text.startsWith("```json")) {
          text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (text.startsWith("```")) {
          text = text.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }
        const parsed = JSON.parse(text);
        const idx = typeof parsed.bestIndex === "number" ? parsed.bestIndex : -1;
        const conf = typeof parsed.confidence === "number" ? parsed.confidence : 0.85;

        if (idx >= 0 && idx < validItems.length && conf >= 0.7) {
          return {
            selected: validItems[idx].candidate,
            captionFa: parsed.captionFa,
          };
        }
        if (idx === -1) {
          return null;
        }
      }
    } catch {
      // تلاش با مدل بعدی
    }
  }

  // اگر سرویس بینایی پاسخ نداد، فقط در صورتی که کاندیدای دقیق مقاله اصلی ویکی‌پدیا داریم آن را برگردان
  const fallbackExact = validItems.find(
    (v) => v.candidate.origin === "en_wiki_exact" || v.candidate.origin === "fa_wiki_exact"
  );
  return fallbackExact ? { selected: fallbackExact.candidate } : null;
}

/**
 * جستجو، رتبه‌بندی و انتخاب بهترین تصویر علمی مستند از دانشنامه‌های معتبر جهانی
 */
export async function searchEducationalWebImage(
  promptOrOptions: string | SearchEducationalWebImageOptions,
  legacyQuestion?: string
): Promise<EducationalImageResult | null> {
  let prompt: string;
  let question: string = "";
  let canonicalEn: string | undefined;
  let canonicalFa: string | undefined;
  let searchQueriesEn: string[] = [];
  let category: string | undefined;
  let excludeUrls: string[] = [];

  if (typeof promptOrOptions === "object") {
    prompt = promptOrOptions.prompt;
    question = promptOrOptions.question || "";
    canonicalEn = promptOrOptions.canonicalEn;
    canonicalFa = promptOrOptions.canonicalFa;
    searchQueriesEn = promptOrOptions.searchQueriesEn || [];
    category = promptOrOptions.category;
    excludeUrls = promptOrOptions.excludeUrls || [];
  } else {
    prompt = promptOrOptions;
    question = legacyQuestion || "";
  }

  const targetTopic = canonicalEn || canonicalFa || question || prompt;

  // آماده‌سازی کلیدواژه‌های انگلیسی و فارسی
  const enTerms: string[] = [];
  if (canonicalEn) {
    enTerms.push(canonicalEn);
    const stripped = canonicalEn.replace(/\s*\([^)]*\)/g, "").trim();
    if (stripped && stripped !== canonicalEn) enTerms.push(stripped);
  }
  for (const q of searchQueriesEn) {
    if (q && !enTerms.includes(q)) enTerms.push(q);
  }
  for (const q of extractEnglishCandidates(prompt)) {
    if (q && !enTerms.includes(q)) enTerms.push(q);
  }

  const faTerms: string[] = [];
  if (canonicalFa) {
    faTerms.push(canonicalFa);
    const strippedFa = canonicalFa.replace(/\s*\([^)]*\)/g, "").trim();
    if (strippedFa && strippedFa !== canonicalFa) faTerms.push(strippedFa);
  }
  for (const q of extractPersianSubject(question)) {
    if (q && !faTerms.includes(q)) faTerms.push(q);
  }

  // واکشی موازی از ویکی‌پدیای انگلیسی، ویکی‌پدیای فارسی و Wikimedia Commons
  const primaryEn = enTerms[0];
  const secondaryEn = enTerms[1];
  const primaryFa = faTerms[0];

  const [enLead1, enLead2, faLead1, enSearchList, commonsList] = await Promise.all([
    primaryEn ? fetchWikiLeadImage(primaryEn, "en", category) : Promise.resolve(null),
    secondaryEn ? fetchWikiLeadImage(secondaryEn, "en", category) : Promise.resolve(null),
    primaryFa ? fetchWikiLeadImage(primaryFa, "fa", category) : Promise.resolve(null),
    primaryEn ? searchEnWikipediaImages(primaryEn, category) : Promise.resolve([]),
    primaryEn
      ? searchWikimediaCommonsImages(`${primaryEn} diagram`, category)
      : Promise.resolve([]),
  ]);

  // تجمیع و حذف تکراری‌ها با اولویت ویکی‌پدیای انگلیسی و دیاگرام‌های علمی
  const allCandidates: WikiCandidate[] = [];
  const seenUrls = new Set<string>(excludeUrls);

  const addCandidate = (c: WikiCandidate | null) => {
    if (!c || !c.url || !c.thumbUrl) return;
    const normUrl = c.url.split("?")[0];
    if (seenUrls.has(c.url) || seenUrls.has(normUrl) || seenUrls.has(c.thumbUrl)) return;
    seenUrls.add(c.url);
    seenUrls.add(normUrl);
    allCandidates.push(c);
  };

  addCandidate(enLead1);
  addCandidate(faLead1);
  addCandidate(enLead2);
  for (const item of enSearchList) addCandidate(item);
  for (const item of commonsList) addCandidate(item);

  if (allCandidates.length === 0) {
    return null;
  }

  // داوری هوشمند بینایی روی کاندیداهای برتر برای انتخاب بهترین عکس ممکن
  const best = await selectBestCandidateWithVision(
    allCandidates,
    question || targetTopic,
    targetTopic,
    category
  );

  if (best) {
    return {
      url: best.selected.url,
      title: best.captionFa || best.selected.title || targetTopic,
      source: "web_encyclopedia",
      sourceLabel: "تصویر مستند علمی (برگزیده و تاییدشده توسط هوش مصنوعی)",
      isVerified: true,
    };
  }

  return null;
}
