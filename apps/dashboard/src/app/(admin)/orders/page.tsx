// TODO(2.8): Orders page (List with new-order badge, detail, Submit for shipping)
// TODO(Thai copy): placeholder wording until 2.8 is implemented
const HEADING = "Orders";
const PLACEHOLDER = "Coming soon.";

export default function OrdersPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-h2 font-semibold">{HEADING}</h1>
      <p className="text-ink/70">{PLACEHOLDER}</p>
    </div>
  );
}
