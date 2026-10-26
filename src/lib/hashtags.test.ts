import { describe, expect, it } from "vitest";
import { normalizeHashtag, parseHashtags } from "./hashtags";

describe("hashtags", () => {
  it("normalizes case, accents and symbols so duplicates collapse", () => {
    expect(normalizeHashtag("#Placa-Mãe")).toBe("placamae");
    expect(normalizeHashtag("PRECISÃO")).toBe("precisao");
  });
  it("dedupes and drops too-short tags", () => {
    expect(parseHashtags("#GPU gpu, #a #Precisão")).toEqual(["gpu", "precisao"]);
  });
});
