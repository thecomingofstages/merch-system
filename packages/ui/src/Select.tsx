import { useId, type ReactNode, type SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode;
  error?: ReactNode;
};

/** A native select, so the keyboard and the phone pickers work as users expect. Pass `<option>`s as children. */
export function Select({ label, error, id, className = "", children, ...props }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = `${selectId}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label className="font-medium text-fg-2" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-11 rounded-lg border bg-raised px-3 text-fg disabled:opacity-40 ${error ? "border-danger" : "border-line"} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
