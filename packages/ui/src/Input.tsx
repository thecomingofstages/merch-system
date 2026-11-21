import { useId, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Shown under the field and announced with it; also marks the field invalid. */
  error?: string;
};

export function Input({ label, error, id, className = "", ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label className="font-medium text-fg-2" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-11 rounded-lg border bg-raised px-3 text-fg placeholder:text-fg-3 disabled:opacity-40 read-only:bg-surface read-only:text-fg-2 ${error ? "border-danger" : "border-line"} ${className}`}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
