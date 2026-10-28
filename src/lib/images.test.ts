import { describe, expect, it } from "vitest";
import { validateImage } from "./images";

describe("validateImage", () => {
  it("aceita PNG de até 5 MB", () => {
    expect(validateImage({ type: "image/png", size: 5 * 1024 * 1024 })).toBeNull();
  });
  it("recusa imagem acima de 5 MB", () => {
    expect(validateImage({ type: "image/jpeg", size: 5 * 1024 * 1024 + 1 })).not.toBeNull();
  });
  it("recusa formatos que não são imagem", () => {
    expect(validateImage({ type: "application/pdf", size: 100 })).not.toBeNull();
  });
});
