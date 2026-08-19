/** Login screen — Figma frame "Đăng nhập (Desktop)" (480px centered card). */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate } from "react-router-dom";

import { Button, Card, ErrorBanner, Input } from "../../components/ui";
import { Icon } from "../../components/icons";
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
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : homePath(user), { replace: true });
    } catch (err) {
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

  return (
    <div className="grid min-h-screen bg-gbg lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -bottom-32 left-10 h-96 w-96 rounded-full bg-info/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold text-xl font-extrabold text-navy">
            N
          </div>
          <div>
            <b className="text-lg">NSA Training Platform</b>
            <p className="text-xs text-white/50">Hệ thống quản lý đào tạo</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gold">
            <Icon name="sparkles" className="h-4 w-4" />
            Đào tạo hiệu quả hơn mỗi ngày
          </span>
          <h2 className="mt-6 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Một không gian.
            <br />
            Mọi hành trình học tập.
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-7 text-white/60">
            Quản lý lớp học, lịch đào tạo, điểm danh và tiến độ kỹ năng trên một nền tảng thống
            nhất.
          </p>
        </div>
        <p className="relative text-xs text-white/35">© 2026 NSA Training Center</p>
      </section>
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[460px]">
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold font-extrabold text-navy">
              N
            </div>
            <b>NSA Training Platform</b>
          </div>
          <Card className="border-0 p-6 shadow-elevated sm:p-8">
            <div className="mb-8 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-dark">
                Chào mừng trở lại
              </p>
              <h1 className="mt-2 text-[30px] font-bold leading-tight tracking-tight text-navy-dark">
                Đăng nhập hệ thống
              </h1>
              <p className="mt-2 text-sm text-gtext">
                Sử dụng tài khoản được trung tâm cấp để tiếp tục.
              </p>
            </div>

            <div className="mb-6 rounded-xl border border-gold/30 bg-gold/5 p-4 text-left">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold-dark">
                <Icon name="sparkles" className="h-4 w-4" />
                <span>Dành cho Nhà tuyển dụng / Demo 1-Click</span>
              </div>
              <p className="mt-1 text-xs text-gtext">
                Bấm nút để tự động đăng nhập và trải nghiệm toàn bộ hệ thống theo từng vai trò:
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleQuickLogin("admin@nsa.local")}
                  className="flex flex-col items-center justify-center rounded-lg border border-navy/10 bg-white p-2 text-center text-xs font-medium text-navy transition hover:border-gold hover:bg-gold/10 hover:text-navy-dark focus:outline-none focus:ring-2 focus:ring-gold"
                >
                  <span className="text-base">👨‍💼</span>
                  <span className="mt-0.5 font-bold">Admin</span>
                  <span className="text-[10px] text-gtext">Toàn quyền</span>
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleQuickLogin("teacher@nsa.local")}
                  className="flex flex-col items-center justify-center rounded-lg border border-navy/10 bg-white p-2 text-center text-xs font-medium text-navy transition hover:border-gold hover:bg-gold/10 hover:text-navy-dark focus:outline-none focus:ring-2 focus:ring-gold"
                >
                  <span className="text-base">👨‍🏫</span>
                  <span className="mt-0.5 font-bold">Giảng viên</span>
                  <span className="text-[10px] text-gtext">Điểm danh, điểm</span>
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleQuickLogin("student@nsa.local")}
                  className="flex flex-col items-center justify-center rounded-lg border border-navy/10 bg-white p-2 text-center text-xs font-medium text-navy transition hover:border-gold hover:bg-gold/10 hover:text-navy-dark focus:outline-none focus:ring-2 focus:ring-gold"
                >
                  <span className="text-base">👨‍🎓</span>
                  <span className="mt-0.5 font-bold">Học viên</span>
                  <span className="text-[10px] text-gtext">Lịch học, kết quả</span>
                </button>
              </div>
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-4">
              {serverError && <ErrorBanner message={serverError} />}

              <Input
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="ban@nsa.local"
                error={errors.email?.message}
                {...register("email")}
              />

              <Input
                label="Mật khẩu"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                error={errors.password?.message}
                {...register("password")}
              />

              <Button type="submit" className="mt-2 w-full" loading={isSubmitting}>
                Đăng nhập <Icon name="arrow-right" className="h-4 w-4" />
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gtext">
              Cần hỗ trợ?{" "}
              <a
                href="mailto:it-support@nsa.local"
                className="font-semibold text-gold-dark hover:underline"
              >
                Liên hệ IT Support
              </a>
            </p>
          </Card>

          <p className="mt-4 text-center text-xs text-gtext">
            Chỉ dành cho cán bộ, giảng viên và học viên của trung tâm.
          </p>
        </div>
      </section>
    </div>
  );
}
