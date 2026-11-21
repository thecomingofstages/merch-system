/**
 * Shop copy: Thai first, the English after it, a step quieter (docs/FRONTEND.md "Copy").
 * `stack` puts a sentence's English on its own line. Opacity, not a colour, so it reads on any background.
 * One span around both: inside a flex button, loose text and the English would be separate items and lose the space.
 */
export function Bilingual({ th, en, stack = false }: { th: string; en: string; stack?: boolean }) {
  return (
    <span>
      {th}
      {stack ? <br /> : " "}
      <span lang="en" className="opacity-70">
        {en}
      </span>
    </span>
  );
}
