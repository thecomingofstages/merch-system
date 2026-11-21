"use client";

import Script from "next/script";
import { useRef } from "react";
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
    // Looks like Google's real button below (outline, "continue with"), so fixtures screens match.
    return (
      <button
        type="button"
        onClick={() => onToken("fixture-id-token")}
        className="inline-flex min-h-11 items-center gap-3 rounded-md border border-google-line bg-google px-4 font-medium text-google-fg"
      >
        <img src="/google-g.svg" alt="" width={20} height={20} />
        ดำเนินการต่อด้วย Google
      </button>
    );
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
          // "Continue with Google", outline: in Thai it reads "ดำเนินการต่อด้วย Google".
          id.renderButton(button.current, { theme: "outline", size: "large", text: "continue_with", shape: "rectangular", logo_alignment: "left", locale: "th" });
        }}
      />
      <div ref={button} className="min-h-11" />
    </>
  );
}
