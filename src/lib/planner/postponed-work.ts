type WorkLabel = {
  title?: string | null;
  course?: string | null;
};

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

export function isPostponedWork(
  item: WorkLabel,
  keywords: string[],
): boolean {
  const itemWords = words(`${item.title ?? ""} ${item.course ?? ""}`);
  return keywords.some((keyword) => {
    const normalized = keyword.toLowerCase().trim();
    return normalized !== "" && itemWords.has(normalized);
  });
}
