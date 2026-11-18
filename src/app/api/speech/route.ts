import { NextRequest, NextResponse } from "next/server";

/**
 * ایجاد هدر استاندارد ۴۴ بایتی فایل صوتی WAV برای استریم PCM خام
 */
function createWavHeader(
  pcmLength: number,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + pcmLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM Format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(pcmLength, 40);

  return buffer;
}

/**
 * پاک‌سازی هوشمند علائم مارک‌داون و تبدیل فرمول‌های ریاضی لاتک به عبارت‌های قابل روخوانی فارسی
 */
function preparePersianTextForSpeech(rawText: string): string {
  return rawText
    .replace(/```[\s\S]*?```/g, " ، در این بخش نمونه کد برنامه در صفحه درج شده است، ")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, " نسبت $1 به $2 ")
    .replace(/\^2\b/g, " به توان دو ")
    .replace(/\^3\b/g, " به توان سه ")
    .replace(/\\sqrt\{([^}]+)\}/g, " رادیکال $1 ")
    .replace(/\\Delta/g, " دلتا ")
    .replace(/\\pi/g, " پی ")
    .replace(/\\alpha/g, " آلفا ")
    .replace(/\\beta/g, " بتا ")
    .replace(/\\theta/g, " تتا ")
    .replace(/\\times/g, " ضربدر ")
    .replace(/\\div/g, " تقسیم بر ")
    .replace(/\\rightarrow|\\to|-->/g, " منجر به ")
    .replace(/`([^`]+)`/g, " $1 ")
    .replace(/[🎯🔬📐🌍💡⚠️🔊📖🎙️]/g, " ")
    .replace(/[#*`$\\_~\[\]\{\}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2200);
}

/**
 * تولید صوت فارسی با مدل‌های Gemini TTS
 */
async function synthesizeSpeechBuffer(rawText: string): Promise<NextResponse> {
  const cleanText = preparePersianTextForSpeech(rawText);
  if (!cleanText) {
    return new NextResponse(null, { status: 204 });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  // ۱. تولید صوت زنده و باکیفیت با مدل‌های صوتی Google Gemini TTS
  if (geminiApiKey) {
    const ttsModels = [
      "gemini-3.8-flash-tts",
      "gemini-3.8-flash-lite-tts",
      "gemini-3.1-flash-tts-preview",
      "gemini-2.5-flash-preview-tts",
    ];

    for (const ttsModel of ttsModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${geminiApiKey}`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `این متن آموزشی را به عنوان یک استاد خوش‌بیان، با صدای رسا، طبیعی، شمرده و کاملاً فارسی بخوان:\n\n${cleanText}`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Puck",
                  },
                },
              },
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const base64Audio =
            data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

          if (base64Audio) {
            const rawBuffer = Buffer.from(base64Audio, "base64");
            // بررسی اینکه آیا بافر خودش هدر استاندارد RIFF WAV دارد یا PCM خام است
            const isAlreadyWav =
              rawBuffer.length > 44 &&
              rawBuffer.subarray(0, 4).toString("ascii") === "RIFF";

            const wavBuffer = isAlreadyWav
              ? rawBuffer
              : Buffer.concat([createWavHeader(rawBuffer.length, 24000), rawBuffer]);

            return new NextResponse(wavBuffer, {
              headers: {
                "Content-Type": "audio/wav",
                "Content-Length": wavBuffer.length.toString(),
                "Cache-Control": "public, max-age=86400",
              },
            });
          }
        } else {
          console.warn(`Gemini TTS model ${ttsModel} returned status:`, res.status);
        }
      } catch (err) {
        console.warn(`Error with TTS model ${ttsModel}:`, err);
      }
    }
  }

  // ۲. استفاده از OpenAI TTS (در صورت وجود کلید اوپن‌ای‌آی)
  if (openaiApiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "tts-1",
          voice: "alloy",
          input: cleanText,
        }),
      });

      if (res.ok) {
        const audioBuffer = await res.arrayBuffer();
        return new NextResponse(audioBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    } catch (e) {
      console.error("OpenAI TTS error:", e);
    }
  }

  return new NextResponse(null, { status: 204 });
}

/**
 * تبدیل متن به گفتار (GET)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawText = searchParams.get("text") || "توضیحات درسی این بخش آماده است.";
  return synthesizeSpeechBuffer(rawText);
}

/**
 * پشتیبانی دوگانه در POST:
 * ۱. اگر JSON ارسال شود ({ text }): تولید صوت TTS برای متون طولانی بدون محدودیت طول URL
 * ۲. اگر FormData ارسال شود (audio): تبدیل صوت دانش‌آموز به متن (STT)
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // حالت اول: درخواست تولید صوت TTS برای متن‌های طولانی
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const text = body.text || "";
      return synthesizeSpeechBuffer(text);
    }

    // حالت دوم: تبدیل صدای ضبط‌شده کاربر به متن (STT)
    const formData = await req.formData();
    const audioFile = formData.get("audio") as Blob | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "فایل صوتی یافت نشد." },
        { status: 400 }
      );
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    // ۱. پردازش صوت با OpenAI Whisper
    if (openaiApiKey) {
      try {
        const whisperFormData = new FormData();
        whisperFormData.append("file", audioFile, "speech.webm");
        whisperFormData.append("model", "whisper-1");
        whisperFormData.append("language", "fa");

        const whisperRes = await fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiApiKey}`,
            },
            body: whisperFormData,
          }
        );

        if (whisperRes.ok) {
          const data = await whisperRes.json();
          if (data.text) {
            return NextResponse.json({
              success: true,
              text: data.text,
            });
          }
        }
      } catch (err) {
        console.error("Whisper transcription error:", err);
      }
    }

    // ۲. پردازش چندوجهی صوت با مدل‌های Gemini
    if (geminiApiKey) {
      const arrayBuffer = await audioFile.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = audioFile.type || "audio/webm";

      const sttModels = [
        "gemini-3-flash-preview",
        "gemini-3.5-transcribe",
        "gemma-4-26b-a4b-it",
      ];

      for (const sttModel of sttModels) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${sttModel}:generateContent?key=${geminiApiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: "لطفاً کلمات و جملات بیان‌شده در این فایل صوتی را به زبان فارسی رونویسی (Transcribe) کن. تنها متن گفته‌شده را بدون هیچ توضیح یا علامت اضافی بنویس:",
                      },
                      {
                        inlineData: {
                          mimeType,
                          data: base64Audio,
                        },
                      },
                    ],
                  },
                ],
              }),
            }
          );

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const transcribedText =
              geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (transcribedText && transcribedText.length > 0) {
              return NextResponse.json({
                success: true,
                text: transcribedText,
              });
            }
          }
        } catch (err) {
          console.warn(`Gemini STT error with ${sttModel}:`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      text: "",
      fallback: true,
    });
  } catch (err: any) {
    console.error("Error in /api/speech POST:", err);
    return NextResponse.json(
      { error: "خطا در پردازش صوت" },
      { status: 500 }
    );
  }
}
