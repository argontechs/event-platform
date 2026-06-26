import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Event Platform" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      {/* Deep-blue event backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 25% 15%, rgba(37,99,235,0.35), transparent 60%), radial-gradient(55% 55% at 85% 90%, rgba(14,116,233,0.30), transparent 60%), #060c1c",
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-sky-300">
            Back Office
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Group &amp; per-company access to leads, quotes, invoices and planning.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-2xl shadow-blue-950/40">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
