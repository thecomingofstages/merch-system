import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `primary` is gold with canvas text: one per screen, for the main action. */
  variant?: "primary" | "secondary";
  /** `sm`: 36 px tall, small text, for buttons repeated on every card. */
  size?: "md" | "sm";
};

const sizes = { md: "min-h-11 px-4", sm: "min-h-9 px-3 text-small" };

const variants = {
  primary: "bg-gold text-canvas hover:bg-gold-hover",
  secondary: "border border-line bg-raised text-fg hover:bg-line",
};

export function Button({ variant = "primary", size = "md", type = "button", className = "", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex ${sizes[size]} items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
