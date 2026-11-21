/**
 * Shop copy: Thai first, the English after it, one weight lighter (docs/FRONTEND.md "Copy").
 * `stack` puts a sentence's English on its own line. Same colour as the Thai: dimming it put
 * the red and grey text under 4.5:1 contrast.
 * One span around both: inside a flex button, loose text and the English would be separate items and lose the space.
 */
export function Bilingual({ th, en, stack = false }: { th: string; en: string; stack?: boolean }) {
  return (
    <span>
      {th}
      {stack ? <br /> : " "}
      <span lang="en" className="font-normal">
        {en}
      </span>
    </span>
  );
}
