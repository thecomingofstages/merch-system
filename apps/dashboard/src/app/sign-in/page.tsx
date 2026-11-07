"use client";

import { Button, Input } from "@merch/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  ApiError,
  clearAdminToken,
  hasAdminToken,
  isFixturesMode,
  setAdminToken,
  subscribeAdminToken,
  verifyAdminToken,
} from "@/lib/api";

// TODO(Thai copy for Sign in screen): POC/docs wording until the team picks the Thai
const HEADING = "Sign in";
const TOKEN_LABEL = "Admin access token";
const SUBMIT_LABEL = "Sign in";
const BUSY_LABEL = "Signing in...";
const EMPTY_ERROR = "Enter the admin access token";
const WRONG_TOKEN_ERROR = "Invalid admin access token";
const SERVER_ERROR = "Cannot reach the server, try again";
const FIXTURES_NOTE = "Fixtures mode: any token works";

const TOKEN_INPUT_ID = "admin-access-token";
const subscribeNoop = () => () => {};

function focusTokenInput() {
  if (typeof document !== "undefined") {
    const el = document.getElementById(TOKEN_INPUT_ID);
    if (el instanceof HTMLInputElement) {
      el.focus();
    }
  }
}

export default function SignInPage() {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const alreadySignedIn = useSyncExternalStore(subscribeAdminToken, hasAdminToken, () => false);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!submitting && alreadySignedIn) {
      router.replace("/");
    }
  }, [alreadySignedIn, router, submitting]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const trimmed = token.trim();
    if (!trimmed) {
      setError(EMPTY_ERROR);
      focusTokenInput();
      return;
    }

    setError(undefined);
    setSubmitting(true);
    setAdminToken(trimmed);

    try {
      await verifyAdminToken();
      router.replace("/");
    } catch (err) {
      clearAdminToken();
      setSubmitting(false);
      if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
        setError(WRONG_TOKEN_ERROR);
      } else {
        setError(SERVER_ERROR);
      }
      requestAnimationFrame(focusTokenInput);
    }
  }

  if (!hydrated || (alreadySignedIn && !submitting)) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <h1 className="text-h2 font-semibold">{HEADING}</h1>

        {isFixturesMode() ? (
          <p className="rounded-lg border border-rigging bg-rigging/40 px-3 py-2 text-small text-ink">
            {FIXTURES_NOTE}
          </p>
        ) : null}

        <Input
          id={TOKEN_INPUT_ID}
          label={TOKEN_LABEL}
          type="password"
          autoComplete="off"
          value={token}
          disabled={submitting}
          error={error}
          onChange={(e) => {
            setToken(e.target.value);
            if (error) setError(undefined);
          }}
        />

        <Button type="submit" variant="primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? BUSY_LABEL : SUBMIT_LABEL}
        </Button>
      </form>
    </main>
  );
}
