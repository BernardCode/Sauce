const sourcePrefix = "Source: ";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function readItemContext(storedDescription: string | null): {
  description: string | null;
  sourceUrl: string | null;
} {
  if (!storedDescription) return { description: null, sourceUrl: null };
  if (storedDescription.startsWith(sourcePrefix)) {
    const sourceUrl = storedDescription.slice(sourcePrefix.length).trim();
    if (isHttpUrl(sourceUrl)) return { description: null, sourceUrl };
  }

  const separator = `\n\n${sourcePrefix}`;
  const sourceStart = storedDescription.lastIndexOf(separator);
  if (sourceStart < 0) return { description: storedDescription, sourceUrl: null };
  const sourceUrl = storedDescription.slice(sourceStart + separator.length).trim();
  if (!isHttpUrl(sourceUrl)) {
    return { description: storedDescription, sourceUrl: null };
  }
  return {
    description: storedDescription.slice(0, sourceStart).trim() || null,
    sourceUrl,
  };
}

export function writeItemContext(
  description: string | null | undefined,
  sourceUrl: string | null | undefined,
): string | null {
  const parts = [
    description?.trim() || null,
    sourceUrl ? `${sourcePrefix}${sourceUrl}` : null,
  ];
  return parts.filter((part): part is string => part !== null).join("\n\n") || null;
}
