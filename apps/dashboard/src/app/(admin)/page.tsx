// TODO(Thai copy for Dashboard heading and empty state): docs/FRONTEND.md wording until the team picks the Thai
const HEADING = "Dashboard";
const EMPTY_STATE = "Sales overview comes later.";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-h2 font-semibold">{HEADING}</h1>
      <p className="text-ink/70">{EMPTY_STATE}</p>
    </div>
  );
}
