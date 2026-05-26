INSERT INTO "collection_cards" ("collection_id", "card_id")
SELECT c."id", cards."id"
FROM "collections" c
INNER JOIN "cards" ON cards."set_id" = c."set_id"
WHERE c."type" = 'set' AND c."set_id" IS NOT NULL
ON CONFLICT DO NOTHING;
