import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";

import { Icon } from "./icons";

export interface SearchComboboxOption {
  value: string;
  label: string;
  description?: string;
}

export function SearchCombobox({
  label,
  value,
  onChange,
  onSearch,
  options,
  loading = false,
  placeholder = "Nhập để tìm…",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  options: SearchComboboxOption[];
  loading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const inputId = useId();
  const listId = `${inputId}-listbox`;
  const selected = options.find((option) => option.value === value);
  const selectedLabel = selected?.label;
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (selectedLabel) setQuery(selectedLabel);
    if (!value) setQuery("");
  }, [selectedLabel, value]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const choose = (option: SearchComboboxOption) => {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative min-w-0 space-y-2">
      <label htmlFor={inputId} className="block text-sm font-semibold text-navy-heading">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && options[activeIndex] ? `${listId}-${activeIndex}` : undefined
          }
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            setOpen(true);
            setActiveIndex(-1);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
            onSearch?.(event.target.value);
            if (value) onChange("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, options.length - 1));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
              return;
            }
            if (event.key === "Enter" && open && options[activeIndex]) {
              event.preventDefault();
              choose(options[activeIndex]);
            }
          }}
          className="h-11 w-full rounded-xl border border-gborder bg-white px-3.5 pr-10 text-sm text-navy shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-gtext/60 focus:border-gold focus:shadow-[0_0_0_3px_rgba(239,192,75,0.16)] disabled:cursor-not-allowed disabled:bg-gbg2"
        />
        <Icon
          name="search"
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gtext"
        />
      </div>
      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-2xl border border-gborder bg-white p-1.5 shadow-xl"
        >
          {loading ? (
            <p role="status" className="px-3 py-3 text-sm text-gtext">
              Đang tải lựa chọn
            </p>
          ) : options.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gtext">Không tìm thấy lựa chọn phù hợp</p>
          ) : (
            options.map((option, index) => (
              <div
                id={`${listId}-${index}`}
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                onMouseEnter={() => setActiveIndex(index)}
                className={clsx(
                  "flex w-full items-start justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors",
                  index === activeIndex ? "bg-gold/15 text-navy" : "text-navy/80 hover:bg-gbg2",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-xs text-gtext">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {option.value === value ? (
                  <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark" />
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
