import type { TFunction } from "i18next";
import type { Scene } from "../../domain/types";

/** A named scene keeps its name (surviving reorders); an unnamed one falls
 *  back to its print position. One formatter so the sidebar and the editor
 *  headers can never disagree. */
export function sceneDisplay(t: TFunction, scene: Scene, index: number): string {
  return scene.title?.trim() || t("manuscript.sceneAria", { n: index + 1 });
}
