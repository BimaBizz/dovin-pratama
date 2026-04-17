"use client";

import { useActionState } from "react";
import { LoaderCircle, LogIn } from "lucide-react";

import { loginAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState = { message: "" };

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="superuser@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Masukkan password"
        />
      </div>

      {state?.message ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        className="w-full"
      >
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" />
            Memproses...
          </>
        ) : (
          <>
            <LogIn />
            Login
          </>
        )}
      </Button>
    </form>
  );
}
