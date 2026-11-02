import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `primary` is curtain red: one per screen, for the main action. */
  variant?: "primary" | "secondary";
};

const variants = {
  primary: "bg-curtain text-house hover:bg-curtain/90",
  secondary: "border border-rigging bg-house text-ink hover:bg-rigging/40",
};

export function Button({ variant = "primary", type = "button", className = "", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 font-medium disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
