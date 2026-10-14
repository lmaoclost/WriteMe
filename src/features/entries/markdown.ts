import { marked } from "marked";

marked.setOptions({ breaks: true, mangle: false, headerIds: false } as never);

const ALLOWED = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI",
  "BLOCKQUOTE", "CODE", "PRE", "EM", "STRONG", "B", "I", "A", "BR", "IMG",
]);
const KEEP_ATTRS: Record<string, Set<string>> = {
  A: new Set(["title"]),
  IMG: new Set(["src", "alt"]),
};
const DATA_IMAGE_RE = /^data:image\//;
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function attributeString(el: Element, keep: Set<string>): string {
  let out = "";
  for (const name of keep) {
    const value = el.getAttribute(name);
    if (value !== null) out += ` ${name.toLowerCase()}="${escapeHtml(value)}"`;
  }
  return out;
}

function serializeElement(el: Element): string {
  const tag = el.tagName;
  if (!ALLOWED.has(tag)) return serializeChildren(el);
  if (tag === "IMG") {
    const src = el.getAttribute("src");
    if (!src || !DATA_IMAGE_RE.test(src)) {
      const alt = el.getAttribute("alt");
      return alt ? escapeHtml(alt) : "";
    }
    return `<img${attributeString(el, KEEP_ATTRS.IMG)}>`;
  }
  const attrs = attributeString(el, KEEP_ATTRS[tag] ?? new Set<string>());
  if (tag === "BR") return "<br>";
  const lower = tag.toLowerCase();
  return `<${lower}${attrs}>${serializeChildren(el)}</${lower}>`;
}

function serializeChildren(node: Node): string {
  return Array.from(node.childNodes)
    .map((child) => {
      if (child.nodeType === TEXT_NODE) return escapeHtml(child.textContent ?? "");
      if (child.nodeType === ELEMENT_NODE) return serializeElement(child as Element);
      return "";
    })
    .join("");
}

export function renderMarkdown(body: string): string {
  let html: string;
  try {
    html = marked.parse(body ?? "", { async: false }) as string;
  } catch {
    return escapeHtml(body ?? "");
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body ? serializeChildren(doc.body) : "";
}
