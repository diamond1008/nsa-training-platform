/** Component tests for the login screen: validation and server-error display. */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./LoginPage";

// Mock the auth context used by LoginPage.
const loginMock = vi.fn();
vi.mock("./AuthContext", () => ({
  useAuth: () => ({
    login: loginMock,
    homePath: () => "/admin",
    user: null,
    status: "anonymous",
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it("renders the Figma login form elements", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Đăng nhập hệ thống" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Mật khẩu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeInTheDocument();
  });

  it("shows validation errors on empty submit and never calls login", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByText("Vui lòng nhập email")).toBeInTheDocument();
    expect(screen.getByText("Vui lòng nhập mật khẩu")).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email format", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "whatever1");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByText("Email không hợp lệ")).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("shows the generic server error on 401", async () => {
    const { ApiRequestError } = await import("../../lib/apiClient");
    loginMock.mockRejectedValue(new ApiRequestError(401, "INVALID_CREDENTIALS", "Invalid email or password"));

    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "admin@nsa.local");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("Email hoặc mật khẩu không đúng. Vui lòng thử lại."),
    ).toBeInTheDocument();
  });
});