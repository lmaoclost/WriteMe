import { marked } from "marked";

// marked v18: mangle/headerIds were removed in marked v5+; kept per plan for option compatibility — inert here.
marked.setOptions({ breaks: true, mangle: false, headerIds: false } as never);

const ALLOWED = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI",
  "BLOCKQUOTE", "CODE", "PRE", "EM", "STRONG", "B", "I", "A", "BR", "IMG",
  "U", "S", "DIV", "SPAN",
]);
const KEEP_ATTRS: Record<string, Set<string>> = {
  A: new Set(["title", "class", "data-entry-link"]),
  IMG: new Set(["src", "alt"]),
  DIV: new Set(["align", "style"]),
  SPAN: new Set(["class", "aria-hidden"]),
};
// execCommand's justify* commands write `style="text-align: …"` on the block
// element; keep that one declaration (and align on div) so editor alignment
// survives a reload without letting arbitrary CSS through.
const STYLE_BLOCKS = ["P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "LI"];
for (const tag of STYLE_BLOCKS) KEEP_ATTRS[tag] = new Set(["align", "style"]);
const TEXT_ALIGN_VALUES = new Set(["left", "center", "right", "justify"]);
const DATA_IMAGE_RE = /^data:image\//;
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Only `text-align` with a fixed keyword survives; every other declaration
 *  (and any malformed one) is dropped. */
function sanitizeStyle(value: string): string {
  const decls: string[] = [];
  for (const part of value.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const prop = part.slice(0, i).trim().toLowerCase();
    const val = part.slice(i + 1).trim().toLowerCase();
    if (prop === "text-align" && TEXT_ALIGN_VALUES.has(val)) decls.push(`text-align: ${val}`);
  }
  return decls.join("; ");
}

function attributeString(el: Element, keep: Set<string>): string {
  let out = "";
  for (const name of keep) {
    let value = el.getAttribute(name);
    if (value === null) continue;
    if (name === "style") {
      value = sanitizeStyle(value);
      if (!value) continue;
    }
    out += ` ${name.toLowerCase()}="${escapeHtml(value)}"`;
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

/** Content written in the rich editor arrives as HTML (starts with a tag). */
export function isHtmlFragment(content: string): boolean {
  return /^\s*<[a-z]/i.test(content ?? "");
}

/** Sanitize arbitrary rendered HTML through the ALLOWED-tag pipeline.
 *  Shared by the body renderer and the wikilink renderer (both feed
 *  dangerouslySetInnerHTML). */
export function sanitizeFragment(html: string): string {
  const doc = new DOMParser().parseFromString(html ?? "", "text/html");
  return doc.body ? serializeChildren(doc.body) : "";
}

export function renderMarkdown(body: string): string {
  if (isHtmlFragment(body)) {
    const doc = new DOMParser().parseFromString(body ?? "", "text/html");
    return doc.body ? serializeChildren(doc.body) : "";
  }
  let html: string;
  try {
    html = marked.parse(body ?? "", { async: false }) as string;
  } catch {
    return escapeHtml(body ?? "");
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body ? serializeChildren(doc.body) : "";
}
