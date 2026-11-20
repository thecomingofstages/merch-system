"use client";

import { useId, useState } from "react";
import { mapDashboardError } from "@/app/(admin)/products/helpers";
import { uploadImage } from "@/lib/api";
import { shrinkImage } from "@/lib/shrinkImage";

// TODO(Thai copy for the upload button)
const COPY = { upload: "Upload from device", uploading: "Uploading..." };

/**
 * Picks a photo from the device, shrinks it, uploads it to R2 and hands back its URL (D17).
 * Sits next to an image link field; a pasted link is copied into R2 by the server on save.
 */
export function UploadImageButton({ onUploaded, disabled }: { onUploaded: (url: string) => void; disabled?: boolean }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await uploadImage(await shrinkImage(file)));
    } catch (err) {
      setError(mapDashboardError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {/* A label styled as a button: the native file picker, so keyboard and phones work as usual. */}
      <label
        htmlFor={id}
        className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-rigging bg-house px-4 font-medium text-ink hover:bg-rigging/40 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-spotlight ${disabled || busy ? "pointer-events-none opacity-40" : ""}`}
      >
        {busy ? COPY.uploading : COPY.upload}
        <input
          id={id}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled || busy}
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = ""; // picking the same file again still fires
          }}
        />
      </label>
      {error ? (
        <p role="alert" className="text-small text-curtain">
          {error}
        </p>
      ) : null}
    </div>
  );
}
