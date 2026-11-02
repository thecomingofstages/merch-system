"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * A modal on the native <dialog>: the browser traps focus, closes on Escape and
 * restores focus to the opener. Clicking the backdrop also closes it.
 */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault(); // the parent's `open` stays the source of truth
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-house p-0 text-ink shadow-xl backdrop:bg-ink/50"
    >
      {/* The padding lives here, not on <dialog>: a tap on the dialog's own padding
          would have the <dialog> as its target and close it by mistake. */}
      <div className="p-6">
        <h2 id={titleId} className="mb-4 font-display text-h3">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
