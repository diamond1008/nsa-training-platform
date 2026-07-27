/** Login screen — Figma frame "Đăng nhập (Desktop)" (480px centered card). */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate } from "react-router-dom";

import { Button, Card, ErrorBanner, Input } from "../../components/ui";
import { ApiRequestError } from "../../lib/apiClient";
import { useAuth } from "./AuthContext";

const schema = z.object({
  email: z
    .string()
    .min(1, "Vui lòng nhập email")
    .email("Email không hợp lệ"),
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
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    try {
      const user = await login(values.email.trim().toLowerCase(), values.password);
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
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gbg px-4">
      <div className="w-full max-w-[480px]">
        <Card className="p-8">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold tracking-wide text-gold-dark">NSA TRAINING PLATFORM</p>
            <h1 className="mt-2 text-[32px] font-bold leading-tight text-navy-dark">Đăng nhập hệ thống</h1>
            <p className="mt-2 text-sm text-gtext">Trang quản trị đào tạo NSA Training Platform</p>
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

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Đăng nhập
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gtext">
            Cần hỗ trợ?{" "}
            <a href="mailto:it-support@nsa.local" className="font-semibold text-gold-dark hover:underline">
              Liên hệ IT Support
            </a>
          </p>
        </Card>

        <p className="mt-4 text-center text-xs text-gtext">
          Chỉ dành cho cán bộ, giảng viên và học viên của trung tâm.
        </p>
      </div>
    </div>
  );
}