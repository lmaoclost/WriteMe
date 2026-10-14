import { renderMarkdown } from "./markdown";

export function MarkdownView({ body }: { body: string }) {
  return (
    <div
      className="md-view"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
    />
  );
}
