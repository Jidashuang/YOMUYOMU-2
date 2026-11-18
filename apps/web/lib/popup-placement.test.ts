import { describe, expect, it } from "vitest";

import { computePopupPlacement } from "./popup-placement";

describe("computePopupPlacement", () => {
  it("uses a bottom sheet on narrow screens", () => {
    expect(computePopupPlacement({ x: 30, y: 400, viewportWidth: 375, viewportHeight: 812 })).toEqual({ mode: "sheet" });
  });

  it("places the popup below the token when there is room", () => {
    const p = computePopupPlacement({ x: 500, y: 200, anchorTop: 170, viewportWidth: 1024, viewportHeight: 768 });
    expect(p).toMatchObject({ mode: "below", top: 200, left: 330 });
    if (p.mode === "below") expect(p.maxHeight).toBe(768 - 200 - 8);
  });

  it("keeps the popup inside the left and right edges", () => {
    const left = computePopupPlacement({ x: 20, y: 100, viewportWidth: 1024, viewportHeight: 768 });
    expect(left).toMatchObject({ mode: "below", left: 8 });
    const right = computePopupPlacement({ x: 1020, y: 100, viewportWidth: 1024, viewportHeight: 768 });
    expect(right).toMatchObject({ mode: "below", left: 1024 - 340 - 8 });
  });

  it("flips above the token when below is cramped and above is roomier", () => {
    // 重现问题：1024x768 视口中点击靠下的词（y=650），下方只剩 110px
    const p = computePopupPlacement({ x: 500, y: 650, anchorTop: 620, viewportWidth: 1024, viewportHeight: 768 });
    expect(p.mode).toBe("above");
    if (p.mode === "above") {
      expect(p.bottom).toBe(768 - 620);
      expect(p.maxHeight).toBe(620 - 8);
    }
  });

  it("never lets the popup exceed the available height", () => {
    const p = computePopupPlacement({ x: 500, y: 650, anchorTop: 620, viewportWidth: 1024, viewportHeight: 768 });
    if (p.mode === "above") expect(p.maxHeight + 8).toBeLessThanOrEqual(620);
  });
});
