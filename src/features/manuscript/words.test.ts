import { describe, expect, it } from "vitest";
import { countWords } from "./words";

describe("countWords", () => {
  it("counts plain text", () => {
    expect(countWords("um dois três")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });

  it("strips HTML tags instead of counting markup as words", () => {
    expect(countWords("<p>A</p><p>duas palavras</p>")).toBe(3);
    expect(countWords("<p>Havia um ditado em Vellmora: a cidade se fecha quando o rio fala.</p>")).toBe(13);
  });

  it("decodes entities before counting", () => {
    expect(countWords("<p>&amp; &lt;x&gt;</p>")).toBe(2);
    expect(countWords("vamos&nbsp;pra&nbsp;casa")).toBe(3);
  });
});