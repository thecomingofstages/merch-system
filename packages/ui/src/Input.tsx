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
      <label htmlFor={inputId} className="font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-11 rounded-lg border bg-house px-3 text-ink disabled:opacity-40 read-only:bg-rigging/40 ${error ? "border-curtain" : "border-rigging"} ${className}`}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-small text-curtain">
          {error}
        </p>
      ) : null}
    </div>
  );
}
