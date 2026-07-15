-- In-House Equity Mandate · research_vault ANN index: ivfflat → HNSW
-- ----------------------------------------------------------------------------
-- The initial ivfflat(lists=100) index loses recall on a small corpus: a query
-- probes a single centroid list (ivfflat.probes=1) and misses rows in other
-- lists, so exact-but-low-similarity matches silently drop. HNSW gives high
-- recall from the first row through a large corpus with no probe tuning — the
-- correct choice for a research vault that starts small and grows. Cosine ops.
-- ----------------------------------------------------------------------------

drop index if exists public.research_vault_embedding_idx;

create index research_vault_embedding_idx
  on public.research_vault
  using hnsw (embedding vector_cosine_ops);
