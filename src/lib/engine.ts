/** Only Chromium prints CSS page-margin boxes (running heads, folios).
 *  `userAgentData` exists only in Chromium; Firefox and WebKit omit it — and
 *  iOS Chrome/Firefox are WebKit under the hood, so they must not count. */
export function isChromiumEngine(): boolean {
  return typeof navigator !== "undefined" && "userAgentData" in navigator;
}
