import { describe, expect, it } from "vitest";
import {
  createBodyScrollLock,
  createOverlayStack,
  mergeAriaInvalid,
  resolveRovingTabValue,
  resolveToastDuration,
} from "@/components/ui/primitiveInternals";

describe("UI primitive state coordination", () => {
  it("keeps only the topmost concurrent overlay active across non-LIFO removal", () => {
    const stack = createOverlayStack();
    const parent = Symbol("parent");
    const child = Symbol("child");
    const releaseParent = stack.add(parent);
    const releaseChild = stack.add(child);

    expect(stack.isTop(parent)).toBe(false);
    expect(stack.isTop(child)).toBe(true);
    releaseParent();
    expect(stack.isTop(child)).toBe(true);
    releaseChild();
    expect(stack.isTop(child)).toBe(false);
  });

  it("restores the first body snapshot only after the final scroll lock releases", () => {
    const lock = createBodyScrollLock();
    const body = { style: { overflow: "scroll", paddingRight: "7px" } };
    const parent = Symbol("parent");
    const child = Symbol("child");
    const releaseParent = lock.acquire(parent, body, 15, 7);
    const releaseChild = lock.acquire(child, body, 15, 7);

    expect(body.style).toEqual({ overflow: "hidden", paddingRight: "22px" });
    releaseParent();
    expect(body.style).toEqual({ overflow: "hidden", paddingRight: "22px" });
    releaseChild();
    expect(body.style).toEqual({ overflow: "scroll", paddingRight: "7px" });
  });

  it("falls back to the first enabled tab for invalid or disabled values", () => {
    const tabs = [
      { id: "disabled", disabled: true },
      { id: "general" },
      { id: "teams" },
    ];

    expect(resolveRovingTabValue(tabs, "missing")).toBe("general");
    expect(resolveRovingTabValue(tabs, "disabled")).toBe("general");
    expect(resolveRovingTabValue(tabs, "teams")).toBe("teams");
  });

  it("preserves literal aria-invalid values unless the field is invalid", () => {
    expect(mergeAriaInvalid("false", false)).toBe("false");
    expect(mergeAriaInvalid("grammar", false)).toBe("grammar");
    expect(mergeAriaInvalid("spelling", false)).toBe("spelling");
    expect(mergeAriaInvalid(false, false)).toBe(false);
    expect(mergeAriaInvalid("false", true)).toBe(true);
  });

  it("makes toasts transient by default with an explicit persistent opt-in", () => {
    expect(resolveToastDuration(undefined, false)).toBe(5000);
    expect(resolveToastDuration(2500, false)).toBe(2500);
    expect(resolveToastDuration(undefined, true)).toBeNull();
  });
});
