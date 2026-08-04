import { Children, forwardRef, isValidElement, useEffect, useId, useRef, useState } from "react";
import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import clsx from "clsx";

import { Icon } from "./icons";

type ButtonVariant = "primary" | "accent" | "ghost" | "danger" | "soft";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "border border-navy bg-navy text-white shadow-sm hover:-translate-y-0.5 hover:bg-navy-soft hover:shadow-md disabled:bg-navy/50",
  accent:
    "border border-gold bg-gold text-navy shadow-sm hover:-translate-y-0.5 hover:bg-[#F5CB62] hover:shadow-md disabled:bg-gold/50",
  ghost: "border border-gborder bg-white text-navy hover:border-slate-300 hover:bg-gbg2",
  danger: "border border-error bg-error text-white hover:bg-error/90 disabled:bg-error/50",
  soft: "border border-transparent bg-gbg2 text-navy hover:bg-gborder",
};

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex h-10 touch-manipulation items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 motion-reduce:transition-none",
        "disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none",
        buttonStyles[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size="sm" invert={variant === "primary" || variant === "danger"} />}
      {children}
    </button>
  );
}

interface FieldProps {
  label: string;
  error?: string;
}
const fieldClass =
  "h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-navy shadow-sm outline-none transition placeholder:text-gtext/60 focus:border-gold focus:shadow-[0_0_0_3px_rgba(239,192,75,0.16)] disabled:cursor-not-allowed disabled:bg-gbg2 disabled:text-gtext";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps {}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? label;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-semibold text-navy-heading">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={clsx(fieldClass, error ? "border-error" : "border-gborder", className)}
        {...rest}
      />
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
});

function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement<{ children?: ReactNode }>(node) && node.props.children) {
    return extractText(node.props.children);
  }
  return "";
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldProps {}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, id, className, children, value, onChange, disabled, ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? label;
  const listboxId = `${useId()}-listbox`;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const options: Array<{ value: string; label: string }> = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === "option") {
      const val = String(child.props.value ?? "");
      const txt = extractText(child.props.children);
      options.push({ value: val, label: txt });
    }
  });

  const stringVal = String(value ?? "");
  const selectedOption = options.find((o) => o.value === stringVal) ?? options[0];
  const selectedIndex = options.findIndex((option) => option.value === selectedOption?.value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    setIsOpen(false);
    if (onChange) {
      const event = {
        target: { value: val, name: rest.name ?? id },
        currentTarget: { value: val, name: rest.name ?? id },
      } as ChangeEvent<HTMLSelectElement>;
      onChange(event);
    }
  };

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-semibold text-navy-heading">
          {label}
        </label>
      )}
      <button
        type="button"
        id={inputId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          isOpen && options[activeIndex] ? `${listboxId}-${activeIndex}` : undefined
        }
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        onClick={() => {
          setIsOpen((current) => {
            if (!current) setActiveIndex(Math.max(selectedIndex, 0));
            return !current;
          });
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((index) =>
              index < 0 ? Math.max(selectedIndex, 0) : Math.min(index + 1, options.length - 1),
            );
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((index) =>
              index < 0 ? Math.max(selectedIndex, 0) : Math.max(index - 1, 0),
            );
          }
          if (event.key === "Escape") setIsOpen(false);
          if (event.key === "Enter" && isOpen && options[activeIndex]) {
            event.preventDefault();
            handleSelect(options[activeIndex].value);
          }
        }}
        className={clsx(
          fieldClass,
          "flex cursor-pointer select-none items-center justify-between pr-3.5 text-left font-medium transition-[border-color,box-shadow] motion-reduce:transition-none",
          isOpen ? "border-gold ring-2 ring-gold/20" : error ? "border-error" : "border-gborder",
          className,
        )}
      >
        <span className={clsx("truncate", !selectedOption?.value && "text-gtext")}>
          {selectedOption ? selectedOption.label : "-- Chọn --"}
        </span>
        <Icon
          name="chevron-down"
          className={clsx(
            "h-4 w-4 shrink-0 text-gtext transition-transform duration-200 motion-reduce:transition-none",
            isOpen && "rotate-180 text-navy",
          )}
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute top-full left-0 mt-1.5 w-full z-50 max-h-64 overflow-y-auto overscroll-contain rounded-2xl border border-gborder bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none"
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === stringVal;
            return (
              <div
                id={`${listboxId}-${idx}`}
                key={`${opt.value}-${idx}`}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => handleSelect(opt.value)}
                className={clsx(
                  "flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors motion-reduce:transition-none",
                  idx === activeIndex || isSelected
                    ? "bg-gold/15 text-navy font-bold"
                    : "hover:bg-gbg2 hover:text-navy text-navy/80",
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <Icon name="check" className="h-4 w-4 text-gold-dark shrink-0 ml-2" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden native select for form refs or Accessibility compatibility */}
      <select
        ref={ref}
        id={inputId ? `${inputId}-hidden` : undefined}
        value={value}
        onChange={onChange}
        tabIndex={-1}
        aria-hidden="true"
        hidden
        className="sr-only"
        {...rest}
      >
        {children}
      </select>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldProps {}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, id, className, ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? label;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-semibold text-navy-heading">
        {label}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={clsx(
          fieldClass,
          "min-h-24 resize-y py-3",
          error ? "border-error" : "border-gborder",
          className,
        )}
        {...rest}
      />
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
});

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-gborder/90 bg-white p-5 shadow-card md:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Spinner({
  size = "md",
  invert = false,
}: {
  size?: "sm" | "md" | "lg";
  invert?: boolean;
}) {
  const px = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-10 w-10" : "h-6 w-6";
  return (
    <span
      role="status"
      aria-label="Đang tải"
      className={clsx(
        "inline-block animate-spin rounded-full border-2 border-t-transparent",
        invert ? "border-white" : "border-navy",
        px,
      )}
    />
  );
}

export function FullPageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gbg">
      <Spinner size="lg" />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={clsx("animate-pulse rounded-lg bg-slate-200/80", className)} />
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-error/20 bg-error-bg px-4 py-3 text-sm text-error shadow-sm"
    >
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-xl border border-success/20 bg-success-bg px-4 py-3 text-sm font-medium text-success shadow-sm"
    >
      <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gbg2 text-gtext">
        <Icon name="info" />
      </div>
      <p className="text-sm font-semibold text-navy">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs leading-5 text-gtext">{hint}</p>}
    </div>
  );
}

type BadgeTone = "navy" | "gold" | "green" | "red" | "gray" | "blue";
const badgeStyles: Record<BadgeTone, string> = {
  navy: "bg-navy/10 text-navy",
  gold: "bg-gold/20 text-gold-dark",
  green: "bg-success-bg text-success",
  red: "bg-error-bg text-error",
  gray: "bg-gbg2 text-gtext",
  blue: "bg-info-bg text-info",
};
export function Badge({ tone = "gray", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
        badgeStyles[tone],
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 md:mb-7">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-gold-dark">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-navy-dark md:text-[1.75rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-gtext">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safe = Math.min(100, Math.max(0, value));
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex justify-between text-xs font-medium text-gtext">
          <span>{label}</span>
          <span>{safe.toFixed(0)}%</span>
        </div>
      )}
      <div
        className="h-2.5 overflow-hidden rounded-full bg-gbg2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safe}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold to-[#F7D477] transition-[width] duration-500"
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKeyDown);
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);
  if (!open) return null;
  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = [
      ...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={dialogRef}
        onKeyDown={trapFocus}
        className="max-h-[92dvh] w-full max-w-2xl overscroll-contain overflow-hidden rounded-t-3xl bg-white shadow-elevated sm:max-h-[90vh] sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-gborder px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gold-dark">
              NSA Training
            </p>
            <h2 id={titleId} className="truncate text-lg font-bold text-navy">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-xl text-gtext transition-colors hover:bg-gbg2 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            aria-label="Đóng"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(92dvh-74px)] overflow-y-auto p-4 sm:max-h-[calc(90vh-74px)] sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
