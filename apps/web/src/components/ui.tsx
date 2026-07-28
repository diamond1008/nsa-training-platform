/** Shared UI primitives styled with the NSA Figma design tokens. */
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import clsx from "clsx";

// ---------- Button ----------

type ButtonVariant = "primary" | "accent" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-navy text-white hover:bg-navy-dark disabled:bg-navy/50",
  accent: "bg-gold text-navy font-semibold hover:bg-gold-dark hover:text-white disabled:bg-gold/50",
  ghost: "bg-transparent text-navy hover:bg-gbg2 border border-gborder",
  danger: "bg-error text-white hover:bg-error/90 disabled:bg-error/50",
};

export function Button({ variant = "primary", loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm transition-colors",
        "disabled:cursor-not-allowed",
        buttonStyles[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size="sm" invert />}
      {children}
    </button>
  );
}

// ---------- Input ----------

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? label;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-navy">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={clsx(
          "h-11 w-full rounded-lg border bg-white px-3 text-sm text-navy placeholder:text-gtext/60",
          "focus:border-gold",
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

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, id, className, children, ...rest }, ref,
) {
  const inputId = id ?? rest.name ?? label;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-navy">{label}</label>
      <select
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        className={clsx("h-11 w-full rounded-lg border bg-white px-3 text-sm text-navy focus:border-gold", error ? "border-error" : "border-gborder", className)}
        {...rest}
      >
        {children}
      </select>
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, id, className, ...rest }, ref,
) {
  const inputId = id ?? rest.name ?? label;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-navy">{label}</label>
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        className={clsx("min-h-24 w-full rounded-lg border bg-white px-3 py-2 text-sm text-navy focus:border-gold", error ? "border-error" : "border-gborder", className)}
        {...rest}
      />
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
    </div>
  );
});

// ---------- Card ----------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx("rounded-2xl border border-gborder bg-white p-6 shadow-card", className)}>
      {children}
    </div>
  );
}

// ---------- Spinner ----------

export function Spinner({ size = "md", invert = false }: { size?: "sm" | "md" | "lg"; invert?: boolean }) {
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

// ---------- ErrorBanner ----------

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-error/30 bg-error-bg px-3 py-2 text-sm text-error">
      {message}
    </div>
  );
}

// ---------- EmptyState ----------

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-gborder bg-white px-6 py-12 text-center">
      <p className="text-sm font-medium text-navy">{title}</p>
      {hint && <p className="text-xs text-gtext">{hint}</p>}
    </div>
  );
}

// ---------- Badge ----------

type BadgeTone = "navy" | "gold" | "green" | "red" | "gray";

const badgeStyles: Record<BadgeTone, string> = {
  navy: "bg-navy/10 text-navy",
  gold: "bg-gold/20 text-gold-dark",
  green: "bg-green-100 text-green-800",
  red: "bg-error-bg text-error",
  gray: "bg-gbg2 text-gtext",
};

export function Badge({ tone = "gray", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", badgeStyles[tone])}>
      {children}
    </span>
  );
}

// ---------- PageHeader ----------

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-navy-dark">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gtext">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safe = Math.min(100, Math.max(0, value));
  return (
    <div>
      {label && <div className="mb-1 flex justify-between text-xs text-gtext"><span>{label}</span><span>{safe.toFixed(0)}%</span></div>}
      <div className="h-2 overflow-hidden rounded-full bg-gbg2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safe}>
        <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gborder px-6 py-4">
          <h2 id="modal-title" className="text-lg font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-xl text-gtext hover:bg-gbg2" aria-label="Đóng">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
