// TODO(1.9): Products page (Shops -> products -> variants table; Add stock; Transfer to POS)
// TODO(Thai copy): placeholder wording until 1.9 is implemented
const HEADING = "Products";
const PLACEHOLDER = "Coming soon.";

export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-h2 font-semibold">{HEADING}</h1>
      <p className="text-ink/70">{PLACEHOLDER}</p>
    </div>
  );
}
