/** Wordcount that survives rich HTML: when content arrives as markup
 *  (the rich editor commits innerHTML), tag names must not count as words. */
export function countWords(content: string): number {
  const text = htmlToText(content ?? "");
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const formatWords = (words: number): string => {
  if (words === 0) return "sem palavras";
  return words === 1 ? "1 palavra" : `${words} palavras`;
};

/** Strip tags + decode entities. Block-level closing tags become spaces so
 *  adjacent paragraphs don't glue words together in textContent. */
export function htmlToText(content: string): string {
  if (!content) return "";
  if (!/^\s*<[a-z]/i.test(content)) return content.replaceAll("&nbsp;", " ");
  const spaced = content.replace(
    /<\/?(?:p|div|h[1-6]|li|blockquote|ul|ol|br|section)\b[^>]*>/gi,
    " ",
  );
  const doc = new DOMParser().parseFromString(spaced, "text/html");
  return doc.body?.textContent ?? "";
}
