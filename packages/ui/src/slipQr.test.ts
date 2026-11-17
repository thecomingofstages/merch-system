import { describe, expect, it } from "vitest";
import { readSlipQrFromFrame } from "./slipQr";

// A synthetic QR (25×25, made with the `qrcode` package) for this fake payload. Real slips are
// checked by hand and never committed. The spaces prove the payload is not trimmed.
const PAYLOAD = " fake-slip 0041 payload ";
const MODULES = [
  "#######.#.#...#.#.#######",
  "#.....#...####.#..#.....#",
  "#.###.#.#....#.##.#.###.#",
  "#.###.#....#..#.#.#.###.#",
  "#.###.#.#.####..#.#.###.#",
  "#.....#..##.####..#.....#",
  "#######.#.#.#.#.#.#######",
  ".........###...#.........",
  ".#..#.#...########..#.#.#",
  "#.#.#..##.####...####...#",
  ".#.####.#..##...#.#..##..",
  "#.#..#..#.#.##.#.##.##.#.",
  "#.#.#.#.#.#.....#####.#.#",
  ".#..##.##..##.####.###.##",
  "#..#..##.......#..##....#",
  "##.###.#...#...#..##.#...",
  "..##..#.#.....#######.###",
  "...........#.#.##...####.",
  "#######..##.###.#.#.#...#",
  "#.....#...##....#...###..",
  "#.###.#.#.##..###########",
  "#.###.#..##..##...##..#.#",
  "#.###.#...#..#....#..##..",
  "#.....#.########.#.#...##",
  "#######..######.###...#.#",
];

/** Draws the modules as an RGBA frame: `scale` px per module, a 4-module white quiet zone. */
function frame(modules: string[], scale = 8): ImageData {
  const size = (modules.length + 8) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  modules.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (cell !== "#") return;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + 4) * scale + dy) * size + (x + 4) * scale + dx) * 4;
          data.fill(0, i, i + 3);
        }
    }),
  );
  return { data, width: size, height: size } as ImageData;
}

describe("readSlipQrFromFrame", () => {
  it("returns the payload exactly as encoded", () => {
    expect(readSlipQrFromFrame(frame(MODULES))).toBe(PAYLOAD);
  });

  it("returns null when the frame has no QR", () => {
    expect(readSlipQrFromFrame(frame(MODULES.map((row) => ".".repeat(row.length))))).toBeNull();
  });
});
