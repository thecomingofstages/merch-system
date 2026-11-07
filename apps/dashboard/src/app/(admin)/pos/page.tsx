// TODO(2.9): POS page (Create, list, stock table, End sale)
// TODO(Thai copy): placeholder wording until 2.9 is implemented
const HEADING = "POS";
const PLACEHOLDER = "Coming soon.";

export default function PosPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-h2 font-semibold">{HEADING}</h1>
      <p className="text-ink/70">{PLACEHOLDER}</p>
    </div>
  );
}
