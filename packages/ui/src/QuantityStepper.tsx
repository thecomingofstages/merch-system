"use client";

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  /** Lowest allowed amount. */
  min?: number;
  /** Highest allowed amount: the caller passes the lower of stock and `buy_limit`; leave it out when there is no cap. */
  max?: number;
  decreaseLabel?: string;
  increaseLabel?: string;
};

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  decreaseLabel = "ลดจำนวน",
  increaseLabel = "เพิ่มจำนวน",
}: QuantityStepperProps) {
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;
  const button =
    "inline-flex size-11 items-center justify-center rounded-lg border border-line bg-raised text-h4 text-fg transition-colors duration-150 hover:bg-line disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="inline-flex items-center gap-2">
      <button type="button" aria-label={decreaseLabel} disabled={atMin} onClick={() => onChange(value - 1)} className={button}>
        −
      </button>
      <output aria-live="polite" className="min-w-8 text-center tabular-nums">
        {value}
      </output>
      <button type="button" aria-label={increaseLabel} disabled={atMax} onClick={() => onChange(value + 1)} className={button}>
        +
      </button>
    </div>
  );
}
