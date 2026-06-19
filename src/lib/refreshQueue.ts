export function createSnapshotRefreshQueue(refresh: () => Promise<void>) {
  let requested = false;
  let running: Promise<void> | null = null;

  async function drain() {
    while (requested) {
      requested = false;
      await refresh();
    }
  }

  return function requestRefresh() {
    requested = true;

    if (!running) {
      running = drain().finally(() => {
        running = null;
      });
    }

    return running;
  };
}
