export const LIST_PREVIEW_COUNT = 3;
export const LIST_EXPANDED_COUNT = 10;

export function visibleListItems<T>(items: readonly T[], expanded: boolean): T[] {
  const limit = expanded ? LIST_EXPANDED_COUNT : LIST_PREVIEW_COUNT;
  return items.slice(0, limit);
}

export function showListExpand(items: readonly unknown[], expanded: boolean): boolean {
  return !expanded && items.length > LIST_PREVIEW_COUNT;
}

export function showListCollapse(items: readonly unknown[], expanded: boolean): boolean {
  return expanded && items.length > LIST_PREVIEW_COUNT;
}
