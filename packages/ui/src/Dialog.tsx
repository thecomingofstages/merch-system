"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** A bottom sheet with 16px top corners (the product popup) instead of a centred box. */
  sheet?: boolean;
};

/**
 * A modal on the native <dialog>: the browser traps focus, closes on Escape and
 * restores focus to the opener. Clicking the backdrop also closes it.
 */
export function Dialog({ open, onClose, title, children, sheet = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal focuses the first field; a [data-autofocus] element inside asks for the focus instead.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
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
      className={`${sheet ? "mx-auto mt-auto mb-0 max-h-[90dvh] w-full max-w-xl rounded-t-2xl" : "m-auto w-[calc(100%-2rem)] max-w-md rounded-lg"} border border-line bg-surface p-0 text-fg shadow-xl backdrop:bg-sunk/80`}
    >
      {/* The padding lives here, not on <dialog>: a tap on the dialog's own padding
          would have the <dialog> as its target and close it by mistake. */}
      <div className="relative p-6">
        <h2 id={titleId} className="mb-4 pr-10 font-display text-h3">
          {title}
        </h2>
        {children}
        {/* A visible way out on a phone, where there's no Escape key and the sheet fills the screen.
            Last in the markup so that opening the dialog still focuses its first field. */}
        <button
          type="button"
          aria-label="ปิด"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-lg text-h3 text-fg-2 hover:bg-raised hover:text-fg"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </dialog>
  );
}
