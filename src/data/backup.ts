import { downloadBlob } from "./download";

/** Shared backup download: Library button and quota toast action both use it. */
export function downloadJson(json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, `writeme-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

