// Static frontend (Phase 4b): there is no server cache to revalidate. Actions keep calling revalidatePath()
// after a write, and every mounted usePageData() reloads its data, which is what a revalidation achieved.

type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

/** Same call shape as next/cache's revalidatePath; the path is ignored (every mounted page reloads). */
export function revalidatePath(_path?: string, _type?: "layout" | "page"): void {
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribeRevalidate(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function revalidateVersion(): number {
  return version;
}
