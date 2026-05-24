export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

export async function runWithConcurrency<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  limit: number,
): Promise<void> {
  await mapWithConcurrency(items, limit, async (item) => {
    await worker(item);
  });
}
