const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeConditionItems(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value !== "string" || !value.trim()) return [];

  try {
    return normalizeConditionItems(JSON.parse(value));
  } catch {
    return [value.trim()];
  }
}

export function getConditionItemIds(value: unknown): string[] {
  return normalizeConditionItems(value).filter((item) => UUID_PATTERN.test(item));
}

export function resolveConditionItemLabels(value: unknown, nodeNames: Readonly<Record<string, string>>): string[] {
  return normalizeConditionItems(value).map((item) => nodeNames[item]?.trim() || item);
}
