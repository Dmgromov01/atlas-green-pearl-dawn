import type { ReactNode } from "react";

import { useMemo } from "react";

function linkify(text: string): ReactNode[] {
  const parts = text.split(/(https?:\/\/[^\s<]+)/g);
  return parts.map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={`${part}-${index}`}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="chat-link"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export function MessageContent({ text }: { text: string }) {
  const blocks = useMemo(() => text.split(/```(?:[\w+-]+)?\n?([\s\S]*?)```/g), [text]);
  return (
    <div className="chat-content">
      {blocks.map((block, index) => {
        if (index % 2 === 1) {
          return (
            <pre key={index} className="chat-code">
              <code>{block.trim()}</code>
            </pre>
          );
        }
        return block.split("\n").map((line, lineIndex) => {
          const heading = line.match(/^#{1,3}\s+(.+)$/);
          const bullet = line.match(/^\s*[-*]\s+(.+)$/);
          const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
          const content = heading?.[1] ?? bullet?.[1] ?? numbered?.[1] ?? line;
          const className = heading
            ? "chat-heading"
            : bullet || numbered
              ? "chat-list-item"
              : undefined;
          return (
            <div key={`${index}-${lineIndex}`} className={className}>
              {bullet || numbered ? <span aria-hidden>• </span> : null}
              {linkify(content)}
            </div>
          );
        });
      })}
    </div>
  );
}
