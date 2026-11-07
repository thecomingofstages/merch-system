"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { ApiError, clearAdminToken, hasAdminToken, subscribeAdminToken } from "@/lib/api";

/**
 * Reusable helper for dashboard pages: when an api.ts call throws ApiError with
 * code UNAUTHORIZED (expired or rotated ADMIN_ACCESS_TOKEN), clears the stored
 * token and redirects to /sign-in. Returns true if it handled an UNAUTHORIZED error.
 */
export function handleUnauthorized(
  error: unknown,
  onRedirect: (path: string) => void = (path) => {
    if (typeof window !== "undefined") {
      window.location.replace(path);
    }
  },
): boolean {
  if (error instanceof ApiError && error.code === "UNAUTHORIZED") {
    clearAdminToken();
    onRedirect("/sign-in");
    return true;
  }
  return false;
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const authed = useSyncExternalStore(subscribeAdminToken, hasAdminToken, () => false);

  useEffect(() => {
    if (!authed) {
      router.replace("/sign-in");
    }
  }, [authed, router]);

  if (!authed) {
    return null;
  }

  return <>{children}</>;
}
