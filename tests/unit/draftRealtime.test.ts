import { describe, expect, it } from "vitest";
import { createSnapshotRefreshQueue } from "@/lib/refreshQueue";

describe("createSnapshotRefreshQueue", () => {
  it("coalesces events received during an active refresh", async () => {
    let releaseFirstRefresh: () => void = () => undefined;
    let refreshCount = 0;
    const firstRefresh = new Promise<void>((resolve) => {
      releaseFirstRefresh = resolve;
    });
    const requestRefresh = createSnapshotRefreshQueue(async () => {
      refreshCount += 1;

      if (refreshCount === 1) {
        await firstRefresh;
      }
    });

    const firstRequest = requestRefresh();
    const secondRequest = requestRefresh();
    const thirdRequest = requestRefresh();

    expect(refreshCount).toBe(1);
    releaseFirstRefresh();
    await Promise.all([firstRequest, secondRequest, thirdRequest]);

    expect(refreshCount).toBe(2);
  });

  it("starts a later refresh after the previous cycle completes", async () => {
    let refreshCount = 0;
    const requestRefresh = createSnapshotRefreshQueue(async () => {
      refreshCount += 1;
    });

    await requestRefresh();
    await requestRefresh();

    expect(refreshCount).toBe(2);
  });
});
