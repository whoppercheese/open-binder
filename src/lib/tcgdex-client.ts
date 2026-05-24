import TCGdex, { type SupportedLanguages } from "@tcgdex/sdk";
import type { UiLocale } from "@/lib/i18n/locale";

const clients = new Map<string, TCGdex>();

export function getTcgdexClient(
  lang: SupportedLanguages | UiLocale,
): TCGdex {
  let client = clients.get(lang);
  if (!client) {
    client = new TCGdex(lang);
    client.setCacheTTL(0);
    clients.set(lang, client);
  }
  return client;
}
