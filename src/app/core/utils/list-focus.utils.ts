export function listItemDomId(prefix: string, id: string): string {
  return `${prefix}-${id}`;
}

/** Scroll a list row into view and briefly highlight it (e.g. from activity deep links). */
export function scrollToListItem(elementId: string, highlightMs = 2500): void {
  requestAnimationFrame(() => {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('list-item-focused');
    window.setTimeout(() => el.classList.remove('list-item-focused'), highlightMs);
  });
}
