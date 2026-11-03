import { useId, type SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
};

/** A native select, so the keyboard and the phone pickers work as users expect. Pass `<option>`s as children. */
export function Select({ label, error, id, className = "", children, ...props }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = `${selectId}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="font-medium">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-11 rounded-lg border bg-house px-3 text-ink disabled:opacity-40 ${error ? "border-curtain" : "border-rigging"} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} className="text-small text-curtain">
          {error}
        </p>
      ) : null}
    </div>
  );
}
