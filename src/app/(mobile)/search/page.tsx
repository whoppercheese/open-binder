"use client";

import { useCallback, useEffect, useState } from "react";
import { CardModal, type CardDetail } from "@/components/card-modal";
import { CardTile } from "@/components/card-tile";
import { SearchBar } from "@/components/search-bar";
import { apiUrl, useLocale, useTranslations } from "@/lib/i18n/context";
import { isSearchableQuery } from "@/lib/search";

type SearchResult = CardDetail & {
  setName: string;
  owned: boolean;
};

export default function SearchPage() {
  const { locale } = useLocale();
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardDetail | null>(null);
  const [open, setOpen] = useState(false);

  const runSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const response = await fetch(
      apiUrl(
        `/api/cards/search?q=${encodeURIComponent(searchQuery.trim())}`,
        locale,
      ),
    );
    const payload = await response.json();
    setResults(payload.results ?? []);
    setLoading(false);
  }, [locale]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isSearchableQuery(query)) {
        void runSearch(query);
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  return (
    <div className="space-y-5 px-4 pt-6">
      <header>
        <h1 className="text-2xl font-bold">{t("search.title")}</h1>
        <p className="text-sm text-zinc-400">{t("search.subtitle")}</p>
      </header>

      <SearchBar
        value={query}
        onChange={setQuery}
        onSubmit={() => void runSearch(query)}
      />

      {loading ? (
        <p className="text-sm text-zinc-400">{t("search.loading")}</p>
      ) : null}

      {!loading && isSearchableQuery(query) && results.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("search.noResults")}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {results.map((card) => (
          <CardTile
            key={card.id}
            card={{
              id: card.id,
              number: card.number,
              name: card.name,
              setId: card.setId,
              imageUrl: card.imageUrl,
              setName: card.setName,
              owned: card.owned,
              price: card.variants.find((variant) => variant.price != null)?.price,
            }}
            onClick={() => {
              setSelectedCard(card);
              setOpen(true);
            }}
          />
        ))}
      </div>

      <CardModal
        key={selectedCard?.id ?? "closed"}
        card={selectedCard}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
