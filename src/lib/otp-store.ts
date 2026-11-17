import nodemailer from "nodemailer";

interface OtpData {
  code: string;
  expiresAt: number;
}

// استفاده از globalThis جهت اشتراک‌گذاری حافظه کدها میان تمام روت‌های Next.js
const globalForOtp = globalThis as unknown as {
  otpStore?: Map<string, OtpData>;
};

const otpStore =
  globalForOtp.otpStore || (globalForOtp.otpStore = new Map<string, OtpData>());

/**
 * پاک‌سازی خودکار کدهای منقضی‌شده
 */
function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (data.expiresAt < now) {
      otpStore.delete(email);
    }
  }
}

/**
 * تولید و ذخیره کد تایید ۶ رقمی
 */
export function generateAndSaveOtp(email: string): string {
  cleanupExpiredCodes();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 3 * 60 * 1000;

  otpStore.set(email.toLowerCase().trim(), { code, expiresAt });
  return code;
}

/**
 * اعتبارسنجی کد تایید
 */
export function verifyOtp(email: string, code: string): boolean {
  cleanupExpiredCodes();
  const normalizedEmail = email.toLowerCase().trim();
  const record = otpStore.get(normalizedEmail);

  if (!record) return false;
  if (record.expiresAt < Date.now()) {
    otpStore.delete(normalizedEmail);
    return false;
  }

  if (record.code === code.trim()) {
    otpStore.delete(normalizedEmail); // مصرف کد
    return true;
  }

  return false;
}

/**
 * ارسال ایمیل حاوی کد تایید با حساب رسمی جیمیل شما
 */
export async function sendOtpEmail(email: string, code: string): Promise<{
  success: boolean;
  isSimulated?: boolean;
  message?: string;
}> {
  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPassword = process.env.SMTP_APP_PASSWORD;

  if (!smtpEmail || !smtpPassword) {
    console.log(
      `\n=========================================\n📧 [NeuroStudy Auth Code]:\nEmail: ${email}\nOTP Code: ${code}\n=========================================\n`
    );
    return {
      success: true,
      isSimulated: true,
      message: `کد تایید: ${code}`,
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpEmail.trim(),
        pass: smtpPassword.replace(/\s+/g, ""),
      },
    });

    const htmlContent = `
      <div dir="rtl" style="font-family: Tahoma, 'Segoe UI', sans-serif; background-color: #090d16; color: #f8fafc; padding: 36px; border-radius: 20px; max-width: 500px; margin: 0 auto; text-align: center; border: 1px solid #1e293b;">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); width: 56px; height: 56px; border-radius: 16px; margin: 0 auto 18px auto; display: flex; align-items: center; justify-content: center; line-height: 56px; font-size: 26px;">
          🎓
        </div>
        <h2 style="color: #ffffff; margin-bottom: 6px; font-size: 22px;">پلتفرم آموزش هوشمند NeuroStudy</h2>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 0;">کد تایید یکبار مصرف شما جهت ورود به سامانه:</p>
        
        <div style="background: linear-gradient(135deg, #1e1b4b, #312e81); border: 1px solid #4338ca; padding: 20px; border-radius: 16px; margin: 26px 0; letter-spacing: 12px; font-size: 36px; font-weight: 800; color: #a5b4fc; font-family: monospace;">
          ${code}
        </div>
        
        <p style="color: #cbd5e1; font-size: 13px;">این کد تا <strong>۳ دقیقه</strong> آینده معتبر است.</p>
        <div style="margin-top: 30px; border-top: 1px solid #1e293b; padding-top: 14px;">
          <p style="color: #64748b; font-size: 11px; margin: 0;">اگر شما این درخواست را نداده‌اید، نیازی به انجام کاری نیست.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"NeuroStudy AI" <${smtpEmail.trim()}>`,
      to: email.trim(),
      subject: `کد تایید ورود به NeuroStudy: ${code}`,
      html: htmlContent,
    });

    return { success: true, isSimulated: false };
  } catch (error: any) {
    console.error("Error sending email via Nodemailer:", error);
    return {
      success: false,
      message: error.message || "خطا در برقراری ارتباط با سرور ایمیل گوگل",
    };
  }
}
