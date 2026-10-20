/** Safari and Firefox only start the transfer after the click has been
 *  dispatched; revoking the object URL immediately can cancel it. 40s matches
 *  the FileSaver convention and is long enough for a large EPUB/DOCX. */
const REVOKE_DELAY_MS = 40_000;

/** Trigger a download from an href. The anchor lives in the document for the
 *  click: Firefox and Safari ignore detached anchors in some cases. */
export function downloadUrl(href: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  if (href.startsWith("blob:")) {
    window.setTimeout(() => {
      if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(href);
    }, REVOKE_DELAY_MS);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  downloadUrl(URL.createObjectURL(blob), filename);
}
