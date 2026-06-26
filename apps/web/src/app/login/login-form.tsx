"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/auth/actions";

const initial: LoginState = { error: "" };

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-600">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-600">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </label>

      {state.error ? (
        <p className="text-sm text-red-500" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-accent px-4 py-2.5 font-medium text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
