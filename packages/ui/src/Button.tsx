import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `primary` is gold with canvas text: one per screen, for the main action. */
  variant?: "primary" | "secondary";
};

const variants = {
  primary: "bg-gold text-canvas hover:bg-gold-hover",
  secondary: "border border-line bg-raised text-fg hover:bg-line",
};

export function Button({ variant = "primary", type = "button", className = "", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
