export function headlineOf(text: string) {
  const [title, desc] = text.split(" — ");
  const head = (title ?? "").replace(/\s+/g, " ").trim();
  const rest = (desc ?? "").replace(/\s+/g, " ").trim();
  if (rest && head.length < 24) return rest.slice(0, 180);
  return (head || rest).slice(0, 180);
}

export function splitPost(text: string) {
  const idx = text.indexOf(" — ");
  if (idx === -1) return { title: text.trim(), lead: "" };
  return { title: text.slice(0, idx).trim(), lead: text.slice(idx + 3).trim() };
}

export function extractiveBrief(
  blocks: { title: string; posts: { text: string }[] }[],
): string[] {
  const items: string[] = [];
  for (const b of blocks) {
    for (const post of b.posts.slice(0, 3)) {
      items.push(`${b.title}: ${headlineOf(post.text)}`);
      if (items.length >= 12) return items;
    }
  }
  return items;
}

export function parseBriefBullets(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[\s•\-–—*·\d.)]+/, "").trim())
    .filter((line) => line.length > 8)
    .slice(0, 12);
}
