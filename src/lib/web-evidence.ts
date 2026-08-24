type WebEvidenceOutputItem = {
  type: string;
  action?: unknown;
  content?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function consultedWebUrls(output: ReadonlyArray<WebEvidenceOutputItem>) {
  const urls = new Set<string>();
  for (const item of output) {
    if (item.type === "web_search_call" && isRecord(item.action)) {
      if (Array.isArray(item.action.sources)) {
        for (const source of item.action.sources) {
          if (isRecord(source) && typeof source.url === "string") urls.add(source.url);
        }
      }
      if (typeof item.action.url === "string") urls.add(item.action.url);
    }
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (!isRecord(part) || !Array.isArray(part.annotations)) continue;
        for (const annotation of part.annotations) {
          if (isRecord(annotation) && annotation.type === "url_citation" && typeof annotation.url === "string") {
            urls.add(annotation.url);
          }
        }
      }
    }
  }
  return urls;
}
