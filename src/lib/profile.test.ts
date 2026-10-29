import { describe, expect, it } from "vitest";
import { machineValues, normalizeUsername, validUsername } from "./profile";

describe("perfil", () => {
  it("permite alterar o nome de usuário mantendo o formato existente", () => {
    expect(normalizeUsername(" Bruno_Morais ")).toBe("bruno_morais");
    expect(validUsername("bruno_morais")).toBe(true);
    expect(validUsername("bruno morais")).toBe(false);
  });
  it("preserva especificações digitadas sem exigir um produto do catálogo", () => {
    expect(machineValues({ processor: "Meu processador personalizado", memory: "48 GB DDR5, 6000 MHz" })).toEqual({ processor: "Meu processador personalizado", memory: "48 GB DDR5, 6000 MHz" });
  });
});