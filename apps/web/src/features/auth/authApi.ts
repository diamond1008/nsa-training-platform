/** Authentication endpoints — mirrors the /api/v1/auth group. */
import { api } from "../../lib/apiClient";
import type { TokenBundle, UserInfo } from "../../lib/types";

export function login(email: string, password: string): Promise<TokenBundle> {
  return api<TokenBundle>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

export function refresh(): Promise<TokenBundle> {
  return api<TokenBundle>("/auth/refresh", { method: "POST", auth: false });
}

export function logout(): Promise<{ message: string }> {
  return api<{ message: string }>("/auth/logout", { method: "POST", auth: false });
}

export function me(): Promise<UserInfo> {
  return api<UserInfo>("/auth/me");
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  return api<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}