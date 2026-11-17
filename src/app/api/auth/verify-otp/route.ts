import { NextRequest, NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: "ایمیل و کد تایید الزامی است." },
        { status: 400 }
      );
    }

    const isValid = verifyOtp(email, code);

    if (!isValid) {
      return NextResponse.json(
        { error: "کد تایید اشتباه است یا منقضی شده است." },
        { status: 400 }
      );
    }

    const username = email.split("@")[0];

    return NextResponse.json({
      success: true,
      message: "ورود با موفقیت انجام شد.",
      user: {
        email,
        name: username,
      },
    });
  } catch (err: any) {
    console.error("Error in /api/auth/verify-otp:", err);
    return NextResponse.json(
      { error: err.message || "خطای سرور در بررسی کد" },
      { status: 500 }
    );
  }
}
