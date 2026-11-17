import { NextRequest, NextResponse } from "next/server";
import { generateAndSaveOtp, sendOtpEmail } from "@/lib/otp-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "ایمیل معتبر الزامی است." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "فرمت آدرس ایمیل نامعتبر است." },
        { status: 400 }
      );
    }

    // ۱. تولید و ذخیره کد تایید
    const code = generateAndSaveOtp(email);

    // ۲. ارسال ایمیل واقعی (یا شبیه‌سازی در صورت تنظیم نبودن جیمیل)
    const sendResult = await sendOtpEmail(email, code);

    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.message || "خطا در ارسال ایمیل" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: sendResult.isSimulated
        ? `کد تایید آزمایشی: ${code}`
        : "کد تایید ۶ رقمی به ایمیل شما ارسال گردید.",
      isSimulated: sendResult.isSimulated,
      previewCode: sendResult.isSimulated ? code : undefined,
    });
  } catch (err: any) {
    console.error("Error in /api/auth/send-otp:", err);
    return NextResponse.json(
      { error: err.message || "خطای سرور در ارسال کد" },
      { status: 500 }
    );
  }
}
