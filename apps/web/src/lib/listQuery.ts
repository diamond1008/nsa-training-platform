export type SortOrder = "asc" | "desc";

export interface ListQueryConfig<FilterKey extends string, SortKey extends string> {
  filterKeys: readonly FilterKey[];
  allowedSorts: readonly SortKey[];
  defaultSort: SortKey;
  defaultOrder: SortOrder;
}

export interface ListQueryState<FilterKey extends string, SortKey extends string> {
  q: string;
  page: number;
  sort: SortKey;
  order: SortOrder;
  filters: Record<FilterKey, string>;
}

type QueryPatch<FilterKey extends string, SortKey extends string> = Partial<
  Record<FilterKey, string | number | null | undefined>
> & {
  q?: string | null;
  page?: number | null;
  sort?: SortKey | null;
  order?: SortOrder | null;
};

export function readListQuery<FilterKey extends string, SortKey extends string>(
  params: URLSearchParams,
  config: ListQueryConfig<FilterKey, SortKey>,
): ListQueryState<FilterKey, SortKey> {
  const rawPage = Number.parseInt(params.get("page") ?? "1", 10);
  const rawSort = params.get("sort") ?? "";
  const rawOrder = params.get("order");
  const filters = Object.fromEntries(
    config.filterKeys.map((key) => [key, params.get(key)?.trim() ?? ""]),
  ) as Record<FilterKey, string>;

  return {
    q: params.get("q")?.trim() ?? "",
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    sort: config.allowedSorts.includes(rawSort as SortKey)
      ? (rawSort as SortKey)
      : config.defaultSort,
    order: rawOrder === "asc" || rawOrder === "desc" ? rawOrder : config.defaultOrder,
    filters,
  };
}

export function patchListQuery<FilterKey extends string, SortKey extends string>(
  current: URLSearchParams,
  patch: QueryPatch<FilterKey, SortKey>,
  config: ListQueryConfig<FilterKey, SortKey>,
): URLSearchParams {
  const working = new URLSearchParams(current);
  const changesListState = Object.keys(patch).some((key) => key !== "page");

  for (const [key, value] of Object.entries(patch)) {
    const normalized = typeof value === "string" ? value.trim() : value;
    if (normalized === undefined || normalized === null || normalized === "") {
      working.delete(key);
    } else {
      working.set(key, String(normalized));
    }
  }
  if (changesListState) working.delete("page");

  return serializeListQuery(readListQuery(working, config), config);
}

function serializeListQuery<FilterKey extends string, SortKey extends string>(
  state: ListQueryState<FilterKey, SortKey>,
  config: ListQueryConfig<FilterKey, SortKey>,
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  for (const key of config.filterKeys) {
    if (state.filters[key]) params.set(key, state.filters[key]);
  }
  if (state.sort !== config.defaultSort) params.set("sort", state.sort);
  if (state.order !== config.defaultOrder) params.set("order", state.order);
  if (state.page > 1) params.set("page", String(state.page));
  return params;
}
