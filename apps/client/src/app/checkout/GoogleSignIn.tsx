"use client";

import Script from "next/script";
import { useRef } from "react";
import { Button } from "@merch/ui";
import { isFixturesMode } from "../../lib/api";

type GoogleId = {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, string>): void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

/** Google's own sign-in button (Google Identity Services). Hands the ID token to `onToken`. */
export function GoogleSignIn({ onToken }: { onToken: (idToken: string) => void }) {
  const button = useRef<HTMLDivElement>(null);

  if (isFixturesMode()) {
    // TODO(Thai copy for the sign-in button)
    return <Button onClick={() => onToken("fixture-id-token")}>Sign in with Google</Button>;
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        onReady={() => {
          const id = window.google?.accounts.id;
          if (!id || !button.current) return;
          id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
            callback: ({ credential }) => onToken(credential),
          });
          id.renderButton(button.current, { theme: "outline", size: "large", text: "signin_with", locale: "th" });
        }}
      />
      <div ref={button} className="min-h-11" />
    </>
  );
}
