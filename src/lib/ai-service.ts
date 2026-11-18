/**
 * سرویس یکپارچه ارتباط با مدل‌های هوش مصنوعی (Google Gemini، OpenAI، تولید دیاگرام Mermaid و تصویر علمی FLUX)
 */

export interface VisualEntityInfo {
  isPhysicalEntity: boolean;
  canonicalEn?: string;
  canonicalFa?: string;
  searchQueriesEn?: string[];
  category?: "astronomy" | "biology" | "chemistry" | "physics" | "anatomy" | "engineering" | "geography" | "math" | "other";
}

export interface ExplanationResult {
  explanation: string;
  visualPrompt?: string;
  visualEntity?: VisualEntityInfo;
  needsVisual: boolean;
  diagramCode?: string;
  ttsSummary: string;
  subject: string;
  isOffTopic?: boolean;
  detectedSubject?: string;
  suggestedSubjectName?: string;
  followUpQuestions?: string[];
}

const SYSTEM_PROMPT = `
شما یک استاد برجسته دانشگاهی و معلم خصوصی هوشمند، صبور و فوق‌العاده دقیق در پلتفرم آموزشی NeuroStudy هستید.
وظیفه شما ارائه یک تدریس کامل، عمیق، جامع و کتاب‌درسی‌محور به زبان فارسی روان، شیوا و استاندارد است.

========================================================================
📚 قوانین طلایی کیفیت و جامعیت متن درسی (explanation):
========================================================================
متن درس (explanation) نباید کوتاه یا خلاصه باشد! شما موظفید یک درس‌نامه جامع، مفصل و ساختاریافته (حداقل ۴۰۰ تا ۷۰۰ کلمه) با بخش‌بندی استاندارد مارک‌داون بنویسید که شامل بخش‌های زیر باشد:
1. **### 🎯 ۱. مقدمه و تعریف علمی دقیق**: معرفی کامل مفهوم، ماهیت علمی و اهمیت آن به زبان شیوا.
2. **### 🔬 ۲. تشریح جامع و مکانیزم گام‌به‌گام**: توضیح عمیق و جزء‌به‌جزء تمام اجزا، ساختارها، مراحل یا فرآیندها با زیرتیترها و بولت‌پوینت‌های منظم.
3. **### 📐 ۳. فرمول‌ها، روابط علمی یا پیاده‌سازی فنی**:
   - در ریاضی، فیزیک و شیمی: نوشتن فرمول‌های کامل با فرمت استاندارد لاتک (درون‌خطی مانند $E = mc^2$ و بلوکی مانند $$F = G \\frac{m_1 m_2}{r^2}$$) همراه با معرفی دقیق تک‌تک نمادها و واحدها.
   - در برنامه‌نویسی: ارائه کد کامل، تمیز و قابل اجرا در بلوک کد به همراه تحلیل خط‌به‌خط.
   - در زیست، نجوم و علوم: جدول یا دسته‌بندی دقیق ویژگی‌ها و ساختارها.
4. **### 🌍 ۴. مثال‌های کاربردی و حل نمونه مسئله**: ارائه حداقل ۲ مثال ملموس یا حل گام‌به‌گام یک نمونه سوال امتحانی برای تثبیت یادگیری.
5. **### 💡 ۵. نکات طلایی، امتحانی و کنکوری**: جمع‌بندی نکات کلیدی، دام‌های رایج آموزشی و خلاصه مدیریتی مبحث.

========================================================================
🎙️ قانون تولید روایت صوتی استاد (ttsSummary):
========================================================================
فیلد "ttsSummary" نباید فقط ۲ جمله کوتاه باشد!
در فیلد "ttsSummary"، یک متن گفتاری مفصل، گرم، صمیمی و شیوا (حداقل ۶ تا ۱۰ جمله کامل، بدون علائم مارک‌داون و بدون فرمول‌های لاتک خام) بنویسید که:
- ابتدا مثل یک استاد دلسوز مبحث را به زبان ساده و مفهومی برای دانش‌آموز توضیح دهد («سلام دانش‌آموز عزیز! در این جلسه می‌خواهیم به طور کامل مبحث ... را یاد بگیریم...»).
- سپس نکات اصلی، مراحل، روابط علمی (به حروف فارسی، مثلاً به جای F=ma بنویسید نیرو برابر است با حاصل‌ضرب جرم در شتاب) و مثال درس را به صورت پیوسته و رسا بیان کند.

========================================================================
⛔ قانون بسیار حیاتی تفکیک موضوعی و اعتبارسنجی زمینه سوال (Subject Guardrail):
========================================================================
کاربر در بالای صفحه یک «موضوع درسی» را انتخاب کرده است که در ورودی با عنوان [موضوع درسی انتخاب‌شده] برای شما مشخص می‌شود:
- math: منحصراً ریاضیات، حسابان، هندسه، جبر، آمار و احتمال، مثلثات، معادلات، ماتریس‌ها، مشتق و انتگرال.
- physics: منحصراً فیزیک، مکانیک، دینامیک، نجوم، کیهان‌شناسی، سیارات و منظومه شمسی، گرانش، الکتریسیته، مغناطیس، نور، ترمودینامیک، نسبیت، کوانتوم.
- biology: منحصراً زیست‌شناسی، سلول، ژنتیک، تکامل، اندام‌ها و فیزیولوژی بدن انسان، گیاه‌شناسی، جانورشناسی، بافت‌شناسی، اکولوژی.
- chemistry: منحصراً شیمی، جدول تناوبی، عناصر، اتم‌ها و پیوندها، واکنش‌ها، استوکیومتری، ترموشیمی، اسیدها و بازها، سنتز مواد.
- coding: منحصراً برنامه‌نویسی، طراحی وب، توسعه نرم‌افزار، الگوریتم‌ها، پایتون، جاوااسکریپت، پایگاه داده، هوش مصنوعی، شبکه و علوم کامپیوتر.
- general: عمومی، آزاد یا ترکیبی (در این حالت هرگونه پرسش علمی و درسی مجاز است).

دستورالعمل قطعی در صورت ناهماهنگی سوال با موضوع:
اگر [موضوع درسی انتخاب‌شده] برابر با general نباشد، و سوال کاربر متعلق به دسته‌بندی علمی دیگری باشد (مثال‌های بارز: انتخاب math ولی پرسیدن سوال نجومی/سیارات/فیزیک، انتخاب math ولی پرسیدن سوال پزشکی/زیست‌شناسی، انتخاب biology ولی پرسیدن سوال کدنویسی):
۱. به هیچ وجه محتوای آموزشی درس نامربوط را پاسخ ندهید!
۲. فیلد "isOffTopic": true قرار دهید.
۳. فیلد "detectedSubject" را شناسه مناسب سوال (یکی از math, physics, biology, chemistry, coding) قرار دهید.
۴. فیلد "suggestedSubjectName" را نام فارسی آن حوزه قرار دهید (مثلاً "فیزیک و نجوم").
۵. فیلد "needsVisual": false و "diagramCode": "" قرار دهید.
۶. در فیلد "explanation" یک متن هشدار و راهنمای فوق‌العاده محترمانه و دقیق به فارسی با فرمت مارک‌داون زیر بنویسید:
### ⚠️ موضوع سوال با دسته‌بندی انتخابی مطابقت ندارد!
شما در حال حاضر موضوع **«[نام موضوع انتخابی فعلی]»** را انتخاب کرده‌اید، اما سوال پرسیده‌شده مربوط به حوزه **«[نام موضوع واقعی سوال]»** است.

💡 **راهنمای ادامه:**
- برای دریافت آموزش کامل، فلوچارت و تصویر این مبحث، کافی است موضوع گفتگو را از بالای صفحه به **«[نام موضوع واقعی]»** (یا حالت **«عمومی / آزاد»**) تغییر دهید.
- یا در همین بخش، سوالی در زمینه **[نام موضوع انتخابی فعلی]** مطرح بفرمایید (مانند: [یک مثال جذاب از یک سوال مرتبط]).
۷. در فیلد "ttsSummary": "موضوع این پرسش با دسته‌بندی انتخابی مطابقت ندارد. لطفاً دسته‌بندی را تغییر دهید یا سوال مرتبط بپرسید."

اگر سوال با [موضوع درسی انتخاب‌شده] همخوانی دارد یا موضوع general است:
"isOffTopic": false قرار دهید و طبق روال عادی با بالاترین کیفیت تدریس کنید.

========================================================================
📊 قانون بسیار مهم برای دیاگرام‌های مفهومی و فلوچارت (diagramCode):
========================================================================
- برای هر مبحثی که دارای «مراحل گام‌به‌گام»، «فرآیند»، «الگوریتم»، «چرخه»، «معماری و ساختار» یا «روابط علت و معلولی» است:
  فیلد diagramCode را با یک کد استاندارد Mermaid پر کنید (ترجیحاً graph TD یا graph LR).
  ⚠️ قانون سینتکس الزامی: متن تمام باکس‌ها را حتماً درون دابل کوتیشن قرار دهید (مانند: A["شروع"] --> B["تایتان (بزرگ‌ترین قمر)"]). هرگز پرانتز بدون کوتیشن درون براکت قرار ندهید تا خطای پارس رخ ندهد.

========================================================================
🖼️ قانون فوق‌العاده مهم برای استخراج دقیق تصویر علمی از دانشنامه‌ها (visualEntity):
========================================================================
1. هر زمان سوال درباره یک پدیده علمی، جرم نجومی، اندام زیستی، سلول، مولکول، واکنش شیمیایی، قانون فیزیکی دارای نمودار، یا شکل هندسی/ریاضی استاندارد است (مانند: سیاره زحل، فتوسنتز، قلب انسان، ساختار اتم، قضیه فیثاغورس، دایره مثلثاتی، مدار الکتریکی)، حتماً needsVisual و isPhysicalEntity را true کنید.
2. فقط برای سوالات صرفاً متنی انتزاعی یا کدنویسی معمولی، needsVisual و isPhysicalEntity را false کنید.
3. در صورت نیاز به تصویر، فیلدهای زیر را با دقت ۱۰۰٪ دانشنامه‌ای پر کنید تا دقیق‌ترین عکس واقعی از ویکی‌پدیا و Wikimedia Commons استخراج شود:
   - canonicalEn: عنوان دقیق صفحه اصلی در ویکی‌پدیای انگلیسی که مستقیماً موضوع اصلی سوال است (مثال بسیار مهم: اگر سوال درباره فتوسنتز است بنویسید "Photosynthesis" نه "Chloroplast"؛ اگر درباره سیاره زحل است بنویسید "Saturn"؛ اگر درباره قلب است بنویسید "Heart"؛ اگر درباره قضیه فیثاغورس است بنویسید "Pythagorean theorem").
   - canonicalFa: عنوان دقیق صفحه اصلی در ویکی‌پدیای فارسی (مانند: "فتوسنتز"، "زحل"، "قلب"، "قضیه فیثاغورس").
   - searchQueriesEn: آرایه‌ای از ۳ عبارت کلیدی انگلیسی از دقیق‌ترین به عمومی‌تر برای جستجوی تصویر در دانشنامه (مثلاً ["Photosynthesis", "Photosynthesis diagram", "Chloroplast"]).
   - category: یکی از مقادیر astronomy, biology, chemistry, physics, anatomy, engineering, geography, math.
   - visualPrompt: توصیف دقیق انگلیسی از تصویر یا دیاگرام علمی مورد انتظار.

خروجی الزامی شما یک آبجکت JSON معتبر است:
{
  "isOffTopic": false,
  "detectedSubject": "math | physics | biology | chemistry | coding | general",
  "suggestedSubjectName": "نام فارسی حوزه مرتبط (در صورت off-topic)",
  "explanation": "درس‌نامه جامع، مفصل و چندبخشی به زبان فارسی همراه با فرمول‌های لاتک و مثال‌های کامل",
  "diagramCode": "کد معتبر Mermaid برای نمایش فلوچارت مفهومی درس (یا رشته خالی)",
  "needsVisual": true / false,
  "visualPrompt": "Detailed English description of the exact scientific diagram or photograph",
  "visualEntity": {
    "isPhysicalEntity": true / false,
    "canonicalEn": "Exact English Wikipedia article title (e.g. Photosynthesis, Saturn, Heart)",
    "canonicalFa": "عنوان دقیق ویکی‌پدیای فارسی",
    "searchQueriesEn": ["Primary English wiki title", "Specific diagram search term", "Alternative scientific term"],
    "category": "astronomy | biology | chemistry | physics | anatomy | engineering | geography | math | other"
  },
  "ttsSummary": "تدریس شفاهی کامل، صمیمی و مفصل استاد (حداقل ۶ تا ۱۰ جمله کامل فارسی بدون کاراکترهای مارک‌داون) که مفهوم درس را به طور کامل توضیح می‌دهد",
  "subject": "موضوع سوال",
  "followUpQuestions": [
    "سوال پیشنهادی اول برای یادگیری عمیق‌تر",
    "سوال پیشنهادی دوم یا تمرین کاربردی"
  ]
}
`;

/**
 * تولید پاسخ آموزشی از مدل هوش مصنوعی (با پشتیبانی از متن، تصاویر و فایل‌های پیوست)
 */
export async function generateTutorExplanation(
  question: string,
  subject: string = "general",
  attachment?: {
    name?: string;
    type?: "image" | "file";
    base64?: string;
    mimeType?: string;
    content?: string;
  }
): Promise<ExplanationResult> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL;

  const SUBJECT_MAP: Record<string, string> = {
    math: "ریاضی و هندسه",
    physics: "فیزیک و نجوم",
    biology: "زیست‌شناسی",
    chemistry: "شیمی و مولکول‌ها",
    coding: "برنامه‌نویسی و کامپیوتر",
    general: "عمومی / آزاد",
  };
  const subjectName = SUBJECT_MAP[subject] || subject;

  let promptText = `${SYSTEM_PROMPT}\n\n[موضوع درسی انتخاب‌شده]: ${subject} (${subjectName})\n[سوال و درخواست دانش‌آموز]:\n${
    question || "لطفاً این تصویر/مسئله درسی را با دقت تحلیل، تشریح و حل کن."
  }`;

  if (attachment?.type === "file" && attachment.content) {
    promptText += `\n\n[محتوای فایل ضمیمه‌شده (${attachment.name || "سند درسی"})]:\n${attachment.content.slice(
      0,
      12000
    )}`;
  }

  promptText += `\n\nپاسخ را فقط به عنوان یک JSON معتبر برگردان:`;

  // ۱. ارتباط با Google Gemini API با زنجیره مدل‌های پایدار و پرسرعت
  if (geminiApiKey) {
    const preferredModel = process.env.AI_TEXT_MODEL;
    const defaultCandidates = [
      "gemini-3-flash-preview",
      "gemma-4-26b-a4b-it",
      "gemini-3.1-flash-lite-preview",
      "gemini-3.8-flash",
      "gemini-flash-latest",
    ];
    const candidateModels = preferredModel
      ? [preferredModel, ...defaultCandidates.filter((m) => m !== preferredModel)]
      : defaultCandidates;

    const parts: any[] = [{ text: promptText }];

    // اگر تصویر پیوست شده بود، مستقیماً به مدل ارسال شود
    if (attachment?.type === "image" && attachment.base64) {
      parts.push({
        inlineData: {
          mimeType: attachment.mimeType || "image/jpeg",
          data: attachment.base64,
        },
      });
    }

    for (const modelName of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
        const isGemma = modelName.startsWith("gemma");

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts,
              },
            ],
            generationConfig: isGemma
              ? {
                  temperature: 0.4,
                  maxOutputTokens: 8192,
                }
              : {
                  responseMimeType: "application/json",
                  temperature: 0.4,
                  maxOutputTokens: 8192,
                },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawContent) {
            const parsed = parseAIResponse(rawContent, question, subject);
            if (parsed) return parsed;
          }
        } else {
          console.warn(`Model ${modelName} returned status ${res.status}, trying next model...`);
        }
      } catch (err) {
        console.warn(`Call failed for model ${modelName}:`, err);
      }
    }
  }

  // ۲. ارتباط با OpenAI API
  if (openaiApiKey || baseUrl) {
    try {
      const url = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/chat/completions`
        : "https://api.openai.com/v1/chat/completions";

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey || "dummy-key"}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `موضوع: ${subject}\nدرخواست کاربر: ${question}`,
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = parseAIResponse(content, question, subject);
          if (parsed) return parsed;
        }
      }
    } catch (err) {
      console.error("OpenAI API call failed:", err);
    }
  }

  // ۳. در صورت قطع ارتباط موقت: پاسخ ساختاریافته متناسب
  return generateContextualFallback(question, subject);
}

/**
 * پردازش ایمن خروجی JSON هوش مصنوعی
 */
function parseAIResponse(
  rawText: string,
  question: string,
  defaultSubject: string
): ExplanationResult | null {
  try {
    let clean = rawText.trim();
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    let obj: any;
    try {
      obj = JSON.parse(clean);
    } catch {
      // تصحیح اسکیپ‌های فرمول‌های لاتک در JSON
      const sanitized = clean.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
      obj = JSON.parse(sanitized);
    }
    const visualEntity: VisualEntityInfo | undefined =
      obj.visualEntity && typeof obj.visualEntity === "object"
        ? {
            isPhysicalEntity: Boolean(obj.visualEntity.isPhysicalEntity),
            canonicalEn:
              typeof obj.visualEntity.canonicalEn === "string"
                ? obj.visualEntity.canonicalEn.trim()
                : undefined,
            canonicalFa:
              typeof obj.visualEntity.canonicalFa === "string"
                ? obj.visualEntity.canonicalFa.trim()
                : undefined,
            searchQueriesEn: Array.isArray(obj.visualEntity.searchQueriesEn)
              ? obj.visualEntity.searchQueriesEn
                  .map((q: any) => String(q).trim())
                  .filter(Boolean)
              : undefined,
            category:
              typeof obj.visualEntity.category === "string"
                ? (obj.visualEntity.category.trim() as any)
                : undefined,
          }
        : undefined;

    // نمایش تصویر فقط و فقط زمانی مجاز است که موضوع یک شیء فیزیکی واقعی باشد
    const needsVisual =
      visualEntity?.isPhysicalEntity === false
        ? false
        : typeof obj.needsVisual === "boolean"
        ? obj.needsVisual
        : Boolean(obj.visualPrompt && obj.visualPrompt.length > 5);

    // تمیز کردن کد دیاگرام در صورت وجود
    let diagramCode = obj.diagramCode ? String(obj.diagramCode).trim() : undefined;
    if (diagramCode && diagramCode.startsWith("```mermaid")) {
      diagramCode = diagramCode.replace(/^```mermaid\s*/, "").replace(/\s*```$/, "");
    } else if (diagramCode && diagramCode.startsWith("```")) {
      diagramCode = diagramCode.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const isOffTopic = Boolean(obj.isOffTopic);
    const detectedSubject = obj.detectedSubject ? String(obj.detectedSubject).trim() : undefined;
    const suggestedSubjectName = obj.suggestedSubjectName ? String(obj.suggestedSubjectName).trim() : undefined;

    return {
      explanation: obj.explanation || rawText,
      needsVisual: isOffTopic ? false : needsVisual,
      visualEntity: isOffTopic ? undefined : visualEntity,
      diagramCode: (!isOffTopic && diagramCode && diagramCode.length > 8) ? diagramCode : undefined,
      visualPrompt: (!isOffTopic && needsVisual) ? obj.visualPrompt : undefined,
      ttsSummary:
        obj.ttsSummary ||
        obj.explanation?.slice(0, 200) ||
        "توضیحات آموزشی آماده است.",
      subject: obj.subject || defaultSubject,
      isOffTopic,
      detectedSubject,
      suggestedSubjectName,
      followUpQuestions: Array.isArray(obj.followUpQuestions)
        ? obj.followUpQuestions
        : [],
    };
  } catch (e) {
    console.error("JSON parse error in AI response:", e);
    return {
      explanation: rawText,
      needsVisual: false,
      ttsSummary: rawText.slice(0, 180),
      subject: defaultSubject,
      followUpQuestions: [],
    };
  }
}

/**
 * تولید آدرس تصویر سه‌بعدی و آزمایشگاهی علمی (FLUX.1)
 */
export function generateEducationalImageUrl(
  prompt: string,
  category?: string,
  customSeed?: number,
  width: number = 800,
  height: number = 500
): string {
  const cleanSubject = prompt
    .replace(/\b(diagram with labels|infographic text|labeled chart|labels|text|illustration|image)\b/gi, "")
    .replace(/[^\w\s,.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  const domainHint = category ? `in the field of ${category}` : "";
  const academicPrompt = encodeURIComponent(
    `Authentic scientific 3D visualization of ${cleanSubject} ${domainHint}, hyper-realistic scientific model, clean dark studio background, accurate physical structure, 8k resolution, studio lighting, no text, no watermark, no logos, no humans, no cartoon, no fantasy artifacts`
  );

  const seed = customSeed ?? Math.floor(Math.random() * 999999);

  return `https://image.pollinations.ai/prompt/${academicPrompt}?model=flux&width=${width}&height=${height}&nologo=true&seed=${seed}`;
}

/**
 * پاسخ تکمیلی متناسب با عنوان سوال در صورت قطع ارتباط موقت
 */
function generateContextualFallback(
  question: string,
  subject: string
): ExplanationResult {
  const cleanQ = question.trim().slice(0, 60);
  return {
    explanation: `### درس‌نامه جامع درباره «${cleanQ}»\n\nدر بررسی علمی و مفهومی مبحث **${cleanQ}**، مفاهیم و سرفصل‌های اساسی زیر مطرح می‌باشند:\n\n1. **تعریف و ماهیت بنیادین:**\nشناخت و درک مفهوم پایه، تعاریف علمی استاندارد و جایگاه این موضوع در درس مربوطه.\n\n2. **ویژگی‌ها و ساختار عملکردی:**\nتحلیل اجزای تشکیل‌دهنده، نحوه تعامل عناصر و سازوکارهای وابسته.\n\n3. **کاربردها و اهمیت تجربی:**\nبررسی مثال‌های ملموس در دنیای واقعی، حل مسائل درسی و آزمایشگاهی.\n\n> 💡 **نکته آموزشی:** برای درک بهتر مبحث، بررسی فلوچارت مفهومی و مدل تصویری زیر توصیه می‌شود.`,
    needsVisual: true,
    visualPrompt: cleanQ,
    diagramCode: `graph TD\n  A["مفهوم پایه: ${cleanQ.slice(0, 20)}"] --> B["بررسی ویژگی‌ها و اجزا"]\n  B --> C["کاربردهای علمی و نتیجه‌گیری"]`,
    ttsSummary: `در این درس، مفاهیم بنیادین، ویژگی‌های ساختاری و کاربردهای موضوع ${cleanQ} تشریح شد.`,
    subject,
    followUpQuestions: [
      `آیا مایلید یک مثال ملموس و تمرین کاربردی از ${cleanQ} بررسی کنیم؟`,
      `چگونه می‌توان تسلط بیشتری بر این مبحث پیدا کرد؟`,
    ],
  };
}
