import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 text-center text-slate-100">
      <h1 className="text-4xl font-extrabold text-indigo-400">۴۰۴</h1>
      <p className="mt-2 text-sm text-slate-400">صفحه مورد نظر یافت نشد.</p>
      <Link
        href="/"
        className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
      >
        بازگشت به صفحه اصلی
      </Link>
    </div>
  );
}
