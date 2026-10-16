/** Open native disclosures before scrolling to their anchor. */
export function revealAdminSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return null;
  let element: HTMLElement | null = target;
  while (element) {
    if (element instanceof HTMLDetailsElement) element.open = true;
    element = element.parentElement;
  }
  return target;
}
