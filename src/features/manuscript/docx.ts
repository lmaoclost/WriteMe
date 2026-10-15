/** .docx import/export for chapters — consistency with the legacy Manuscript. */

/** Block-level conversion of sanitized chapter HTML into flat text blocks. */
export interface DocxBlock { kind: "p" | "h1" | "h2" | "h3" | "quote" | "li"; text: string }

export function htmlToBlocks(html: string): DocxBlock[] {
  const doc = new DOMParser().parseFromString(html ?? "", "text/html");
  const out: DocxBlock[] = [];
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === "script" || tag === "style") continue;
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (tag === "ul" || tag === "ol") {
        for (const li of Array.from(el.children)) {
          out.push({ kind: "li", text: (li.textContent ?? "").trim() });
        }
        continue;
      }
      if (["p", "h1", "h2", "h3", "blockquote"].includes(tag) && text) {
        out.push({ kind: (tag === "blockquote" ? "quote" : tag) as "p" | "h1" | "h2" | "h3" | "quote", text });
        continue;
      }
      if (text) { out.push({ kind: "p", text }); continue; }
      walk(el);
    }
  };
  walk(doc.body);
  return out;
}

/** Import: mammoth converts .docx to chapter HTML (markdown-agnostic). */
export async function importDocxToHtml(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const buffer = await fileToArrayBuffer(file);
  const result = await (mammoth.default ?? mammoth).convertToHtml({ arrayBuffer: buffer });
  if (!result?.value) throw new Error("sem conteúdo");
  return result.value;
}

async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  // jsdom lacks Blob.arrayBuffer; FileReader exists everywhere.
  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("falha ao ler o arquivo"));
    reader.readAsArrayBuffer(file);
  });
}