import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";

import { Icon } from "./icons";
import { Button, Input } from "./ui";

export interface ActiveFilter {
  key: string;
  label: string;
}

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

export function FilterBar({
  search,
  onSearch,
  resultCount,
  activeFilters = [],
  onRemoveFilter,
  onClearAll,
  children,
  advancedFilters,
  advancedFilterCount = 0,
  searchPlaceholder = "Nhập mã, tên hoặc email…",
}: {
  search: string;
  onSearch: (value: string) => void;
  resultCount?: number;
  activeFilters?: ActiveFilter[];
  onRemoveFilter?: (key: string) => void;
  onClearAll?: () => void;
  children?: ReactNode;
  advancedFilters?: ReactNode;
  advancedFilterCount?: number;
  searchPlaceholder?: string;
}) {
  const advancedId = useId();
  const [advancedOpen, setAdvancedOpen] = useState(advancedFilterCount > 0);
  useEffect(() => {
    if (advancedFilterCount > 0) setAdvancedOpen(true);
  }, [advancedFilterCount]);
  const hasFilters = Boolean(search.trim()) || activeFilters.length > 0;
  return (
    <section className="mb-5 rounded-2xl border border-gborder bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1 lg:max-w-md">
          <Input
            label="Tìm kiếm"
            name="directory-search"
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
          />
        </div>
        {children}
        {advancedFilters ? (
          <Button
            type="button"
            variant={advancedOpen ? "soft" : "ghost"}
            className="h-11 shrink-0"
            aria-expanded={advancedOpen}
            aria-controls={advancedId}
            onClick={() => setAdvancedOpen((current) => !current)}
          >
            <Icon name="filter" className="h-4 w-4" />
            Bộ lọc nâng cao{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}
            <Icon
              name="chevron-down"
              className={`h-4 w-4 transition-transform motion-reduce:transition-none ${advancedOpen ? "rotate-180" : ""}`}
            />
          </Button>
        ) : null}
      </div>
      {advancedFilters && advancedOpen ? (
        <div
          id={advancedId}
          className="mt-3 flex flex-wrap items-end gap-3 border-t border-gborder/70 pt-3"
        >
          {advancedFilters}
        </div>
      ) : null}
      <div className="mt-3 flex min-h-8 flex-wrap items-center gap-2 border-t border-gborder/70 pt-3">
        {typeof resultCount === "number" ? (
          <span className="mr-1 text-xs font-semibold text-gtext">
            {new Intl.NumberFormat("vi-VN").format(resultCount)} kết quả
          </span>
        ) : null}
        {activeFilters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            aria-label={`Bỏ lọc ${filter.label}`}
            onClick={() => onRemoveFilter?.(filter.key)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gold/35 bg-gold/10 px-3 text-xs font-semibold text-navy transition-colors hover:bg-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            {filter.label}
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        ))}
        {hasFilters && onClearAll ? (
          <Button
            type="button"
            variant="ghost"
            className="ml-auto h-8 px-3 text-xs"
            aria-label="Xóa tất cả bộ lọc"
            onClick={onClearAll}
          >
            Xóa tất cả
          </Button>
        ) : null}
      </div>
    </section>
  );
}
