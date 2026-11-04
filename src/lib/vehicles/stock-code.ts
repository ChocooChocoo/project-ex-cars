// T06: stock codes are numbered automatically, GCE-001, GCE-002, ... Codes that do not follow the pattern
// (older hand-typed ones) are ignored, so they never break the sequence.
const STOCK_CODE = /^GCE-(\d+)$/i;

export function nextStockCode(existing: readonly (string | null | undefined)[]): string {
  let max = 0;
  for (const code of existing) {
    const match = STOCK_CODE.exec(code?.trim() ?? "");
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `GCE-${String(max + 1).padStart(3, "0")}`;
}
