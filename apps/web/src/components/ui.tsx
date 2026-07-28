import { forwardRef, useEffect } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
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
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200",
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

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldProps {}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, id, className, children, ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? label;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-semibold text-navy-heading">
        {label}
      </label>
      <select
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        className={clsx(fieldClass, error ? "border-error" : "border-gborder", className)}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p role="alert" className="text-xs text-error">
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
        className={clsx(
          fieldClass,
          "min-h-24 resize-y py-3",
          error ? "border-error" : "border-gborder",
          className,
        )}
        {...rest}
      />
      {error && (
        <p role="alert" className="text-xs text-error">
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
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-hidden rounded-t-3xl bg-white shadow-elevated sm:max-h-[90vh] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-gborder px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gold-dark">
              NSA Training
            </p>
            <h2 id="modal-title" className="truncate text-lg font-bold text-navy">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gtext transition hover:bg-gbg2 hover:text-navy"
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
