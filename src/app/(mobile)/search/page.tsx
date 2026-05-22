"use client";

import { useCallback, useEffect, useState } from "react";
import { CardModal, type CardDetail } from "@/components/card-modal";
import { CardTile } from "@/components/card-tile";
import { SearchBar } from "@/components/search-bar";

type SearchResult = CardDetail & {
  setName: string;
  owned: boolean;
};

export default function SearchPage() {
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
      `/api/cards/search?q=${encodeURIComponent(searchQuery.trim())}`,
    );
    const payload = await response.json();
    setResults(payload.results ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
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
        <h1 className="text-2xl font-bold">Suche</h1>
        <p className="text-sm text-zinc-400">
          Name, Nummer oder Set + Nummer
        </p>
      </header>

      <SearchBar
        value={query}
        onChange={setQuery}
        onSubmit={() => void runSearch(query)}
      />

      {loading ? (
        <p className="text-sm text-zinc-400">Suche läuft…</p>
      ) : null}

      {!loading && query.trim().length >= 2 && results.length === 0 ? (
        <p className="text-sm text-zinc-500">Keine Karten gefunden.</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {results.map((card) => (
          <CardTile
            key={card.id}
            card={{
              id: card.id,
              number: card.number,
              nameDe: card.nameDe,
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
