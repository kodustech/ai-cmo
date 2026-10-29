export const COUNTRIES = [
  { code: "br", label: "Brasil" },
  { code: "us", label: "Estados Unidos" },
  { code: "uk", label: "Reino Unido" },
  { code: "ca", label: "Canadá" },
  { code: "mx", label: "México" },
  { code: "pt", label: "Portugal" },
  { code: "es", label: "Espanha" },
  { code: "de", label: "Alemanha" },
  { code: "fr", label: "França" },
  { code: "it", label: "Itália" },
  { code: "nl", label: "Países Baixos" },
  { code: "au", label: "Austrália" },
  { code: "ar", label: "Argentina" },
  { code: "cl", label: "Chile" },
  { code: "co", label: "Colômbia" },
  { code: "pe", label: "Peru" },
  { code: "in", label: "Índia" },
  { code: "sg", label: "Singapura" },
  { code: "ie", label: "Irlanda" },
  { code: "se", label: "Suécia" },
  { code: "ch", label: "Suíça" },
  { code: "be", label: "Bélgica" },
  { code: "dk", label: "Dinamarca" },
  { code: "no", label: "Noruega" },
  { code: "fi", label: "Finlândia" },
  { code: "pl", label: "Polônia" },
  { code: "jp", label: "Japão" },
  { code: "za", label: "África do Sul" },
  { code: "ae", label: "Emirados Árabes Unidos" },
  { code: "il", label: "Israel" },
  { code: "other", label: "Outro / Global" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

export function countryLabel(code: string): string {
  return COUNTRIES.find((entry) => entry.code === code)?.label || code;
}

export function semrushDatabase(code: string): string {
  return COUNTRIES.some((entry) => entry.code === code) && code !== "other" ? code : "us";
}
