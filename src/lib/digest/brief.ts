export function headlineOf(text: string) {
  const [title, desc] = text.split(" — ");
  const head = (title ?? "").replace(/\s+/g, " ").trim();
  const rest = (desc ?? "").replace(/\s+/g, " ").trim();
  if (rest && head.length < 16) return rest.slice(0, 96);
  return (head || rest).slice(0, 96);
}

export function extractiveBrief(
  blocks: { title: string; posts: { text: string }[] }[],
): string[] {
  const items: string[] = [];
  for (const b of blocks) {
    const first = b.posts[0];
    if (!first) continue;
    items.push(`${b.title}: ${headlineOf(first.text)}`);
    if (items.length >= 6) break;
  }
  return items;
}

export function parseBriefBullets(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[\s•\-–—*·\d.)]+/, "").trim())
    .filter((line) => line.length > 6)
    .slice(0, 6);
}
