/** Login screen — Light Glassmorphism with cinematic Zoom-in & Spinner Transition. */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";

import { ApiRequestError } from "../../lib/apiClient";
import { useAuth } from "./AuthContext";

const schema = z.object({
  email: z.string().min(1, "Vui lòng nhập email").email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login, homePath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const performLogin = async (email: string, pass: string) => {
    setServerError("");
    try {
      const user = await login(email.trim().toLowerCase(), pass);
      if (user.must_change_password) {
        navigate("/doi-mat-khau", { replace: true });
        return;
      }
      // Trigger PowerPoint-style smooth Zoom-out transition
      setIsTransitioning(true);
      setTimeout(() => {
        const from = (location.state as { from?: string } | null)?.from;
        navigate(from && from !== "/login" ? from : homePath(user), { replace: true });
      }, 500);
    } catch (err) {
      setIsTransitioning(false);
      if (err instanceof ApiRequestError && err.status === 401) {
        setServerError("Email hoặc mật khẩu không đúng. Vui lòng thử lại.");
      } else if (err instanceof ApiRequestError && err.status === 429) {
        setServerError("Bạn đã thử quá nhiều lần. Vui lòng đợi một phút rồi thử lại.");
      } else {
        setServerError("Không kết nối được máy chủ. Vui lòng kiểm tra lại mạng hoặc thử lại sau.");
      }
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    await performLogin(values.email, values.password);
  });

  const handleQuickLogin = async (email: string) => {
    setValue("email", email);
    setValue("password", "NsaDemo@123");
    await performLogin(email, "NsaDemo@123");
  };

  const isBusy = isSubmitting || isTransitioning;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#EEF4FF] via-[#F8FAFC] to-[#FEF9EE] px-4 py-12 select-none">
      {/* Soft ambient lighting halos for light glass refraction */}
      <div
        className={clsx(
          "pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-[#60A5FA]/25 blur-[140px] transition-all duration-700 ease-out",
          isTransitioning && "scale-75 opacity-40",
        )}
      />
      <div
        className={clsx(
          "pointer-events-none absolute top-1/2 -right-40 h-[480px] w-[480px] rounded-full bg-[#FBBF24]/20 blur-[150px] transition-all duration-700 ease-out",
          isTransitioning && "scale-75 opacity-40",
        )}
      />
      <div
        className={clsx(
          "pointer-events-none absolute -bottom-32 left-1/3 h-[420px] w-[420px] rounded-full bg-[#818CF8]/20 blur-[130px] transition-all duration-700 ease-out",
          isTransitioning && "scale-75 opacity-40",
        )}
      />

      {/* Subtle Dot Matrix Texture */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#0A254012_1px,transparent_1px)] [background-size:24px_24px] opacity-60" />

      {/* Frosted Crystal Glass Card with PowerPoint-style Smooth Zoom-out Transition */}
      <div
        className={clsx(
          "relative w-full max-w-[440px] rounded-3xl border border-white/80 bg-white/70 p-8 shadow-[0_20px_60px_rgba(10,37,64,0.08)] backdrop-blur-2xl sm:p-10 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
          isTransitioning
            ? "scale-[0.72] opacity-0 blur-[2px] pointer-events-none"
            : "scale-100 opacity-100 blur-0",
        )}
      >
        {/* Brand Monogram */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className={clsx(
              "mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/90 bg-gradient-to-br from-white/95 to-white/60 shadow-sm backdrop-blur-md transition-transform duration-500",
              isBusy && "scale-110",
            )}
          >
            <span className="font-heading text-xl font-extrabold tracking-wider text-[#0A2540]">
              N
            </span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0A2540]/60">
            NSA TRAINING PLATFORM
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0A2540] sm:text-3xl">
            Đăng nhập hệ thống
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Cổng đào tạo & khảo thí kỹ năng thực hành
          </p>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-rose-300 bg-rose-50/80 p-3.5 text-xs font-medium text-rose-700 backdrop-blur-md"
          >
            {serverError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="ten.nguoidung@nsa.local"
              {...register("email")}
              className={clsx(
                "w-full rounded-2xl border bg-white/70 px-4 py-3.5 text-sm text-[#0A2540] placeholder:text-slate-400 backdrop-blur-md transition duration-200 hover:border-slate-300 hover:bg-white/90 focus:border-[#0A2540] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#0A2540]/10",
                errors.email ? "border-rose-400 ring-2 ring-rose-400/20" : "border-slate-200/80",
              )}
            />
            {errors.email?.message && (
              <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
              className={clsx(
                "w-full rounded-2xl border bg-white/70 px-4 py-3.5 text-sm text-[#0A2540] placeholder:text-slate-400 backdrop-blur-md transition duration-200 hover:border-slate-300 hover:bg-white/90 focus:border-[#0A2540] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#0A2540]/10",
                errors.password ? "border-rose-400 ring-2 ring-rose-400/20" : "border-slate-200/80",
              )}
            />
            {errors.password?.message && (
              <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isBusy}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-[#0A2540] py-3.5 text-center text-sm font-bold text-white shadow-[0_6px_20px_rgba(10,37,64,0.18)] transition-all duration-300 hover:bg-[#0F3254] hover:shadow-[0_10px_28px_rgba(10,37,64,0.28)] hover:scale-[1.03] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 disabled:opacity-75"
          >
            {isBusy ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>{isTransitioning ? "Đang vào hệ thống..." : "Đang xác thực..."}</span>
              </>
            ) : (
              "Đăng nhập"
            )}
          </button>
        </form>

        {/* Demo Fast Switch (Glass Pills) */}
        <div className="mt-6 border-t border-slate-200/60 pt-5 text-center">
          <p className="mb-2.5 text-[11px] font-medium text-slate-500">
            Đăng nhập nhanh cho môi trường Demo:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleQuickLogin("admin@nsa.local")}
              className="cursor-pointer rounded-xl border border-slate-200/80 bg-white/60 py-2 text-xs font-semibold text-[#0A2540] backdrop-blur-md transition-all duration-200 hover:border-[#0A2540]/40 hover:bg-white hover:shadow-md hover:scale-105 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
            >
              Admin
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleQuickLogin("teacher@nsa.local")}
              className="cursor-pointer rounded-xl border border-slate-200/80 bg-white/60 py-2 text-xs font-semibold text-[#0A2540] backdrop-blur-md transition-all duration-200 hover:border-[#0A2540]/40 hover:bg-white hover:shadow-md hover:scale-105 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
            >
              Giảng viên
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleQuickLogin("student@nsa.local")}
              className="cursor-pointer rounded-xl border border-slate-200/80 bg-white/60 py-2 text-xs font-semibold text-[#0A2540] backdrop-blur-md transition-all duration-200 hover:border-[#0A2540]/40 hover:bg-white hover:shadow-md hover:scale-105 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
            >
              Học viên
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-slate-400">
          © 2026 NSA Training Center · Bảo mật & Quyền riêng tư
        </p>
      </div>
    </div>
  );
}
