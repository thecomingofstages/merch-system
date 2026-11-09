"use client";

import { useState } from "react";
import { handleUnauthorized } from "@/components/AuthGuard";
import { ApiError } from "@/lib/api";
import { COPY } from "./copy";

export function isValidHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseStrictInt(value: string): number | null {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (!Number.isSafeInteger(num)) return null;
  return num;
}

export function mapDashboardError(
  err: unknown,
  onRedirect: (path: string) => void,
): string | null {
  if (handleUnauthorized(err, onRedirect)) {
    return null;
  }
  if (err instanceof ApiError) {
    switch (err.code) {
      case "OUT_OF_STOCK":
        return COPY.stockBelowZeroError;
      case "NOT_FOUND":
        return COPY.notFoundError;
      case "NETWORK":
        return COPY.networkError;
      case "VALIDATION":
        return err.message || COPY.requiredField;
      default:
        return err.message || COPY.networkError;
    }
  }
  return COPY.networkError;
}

function BrokenImagePreview({ url, alt, sizeClass }: { url: string; alt: string; sizeClass: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!isValidHttpUrl(url) || failedUrl === url) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-rigging bg-rigging/20 p-1 text-center text-small leading-tight break-words text-ink/60 ${sizeClass}`}
      >
        {COPY.imageLoadFailed}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote product image URLs entered by admin
    <img
      src={url}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(url)}
      className={`shrink-0 rounded-sm border border-rigging bg-rigging/20 object-cover ${sizeClass}`}
    />
  );
}

export function ImagePreview({
  url,
  alt,
  sizeClass = "h-12 w-12",
}: {
  url: string | null | undefined;
  alt: string;
  sizeClass?: string;
}) {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-rigging bg-rigging/20 p-1 text-center text-small leading-tight break-words text-ink/50 ${sizeClass}`}
      >
        {COPY.noImage}
      </div>
    );
  }

  return <BrokenImagePreview url={trimmed} alt={alt} sizeClass={sizeClass} />;
}
