import { QuillDeltaToHtmlConverter } from "quill-delta-to-html";

export const convertDeltaToHtml = (DeltaOps: any) => {
  const cfg = {};
  const converter = new QuillDeltaToHtmlConverter(DeltaOps, cfg);
  const html = converter.convert();
  return html;
};
