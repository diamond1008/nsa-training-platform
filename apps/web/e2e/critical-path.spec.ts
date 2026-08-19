import { expect, test, type Page } from "@playwright/test";

const demoPassword = process.env.E2E_DEMO_PASSWORD ?? "NsaDemo@123";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator('input[type="password"]').fill(demoPassword);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

test("admin login and role guard", async ({ page }) => {
  await login(page, "admin@nsa.local");
  await expect(page).toHaveURL(/\/admin$/);
  await page.evaluate(() => {
    window.history.pushState({}, "", "/teacher/lich-day");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/teacher\/lich-day$/);
  await expect(page.getByRole("heading", { name: "Truy cập bị từ chối" })).toBeVisible();
});

test("teacher opens attendance from weekly calendar", async ({ page }) => {
  await login(page, "teacher@nsa.local");
  await page.getByRole("link", { name: "Lịch dạy", exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/lich-day$/);
  await page.getByRole("button", { name: /E2E$/ }).click();
  await expect(page).toHaveURL(/\/teacher\/diem-danh\?session=88888888/);
  await expect(page.getByRole("heading", { name: "Điểm danh" })).toBeVisible();
  const studentRow = page.getByRole("row", { name: /Demo Student/ });
  await expect(studentRow).toBeVisible();
  await expect(studentRow.getByRole("button", { name: "Có mặt" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("student views own attendance and progress", async ({ page }) => {
  await login(page, "student@nsa.local");
  await page.getByRole("link", { name: "Lịch học", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/lich-hoc$/);
  await page.getByRole("button", { name: /E2E$/ }).click();
  await expect(page.getByText("Trạng thái điểm danh của bạn", { exact: true })).toBeVisible();
  await expect(page.getByTestId("student-own-attendance-status")).toContainText("Có mặt");
  await expect(page.getByText(/HV\d+|STU-DEMO-001/)).toBeVisible();
  await page.getByRole("button", { name: "Đóng" }).click();

  await page.getByRole("link", { name: "Tiến độ học tập" }).click();
  await expect(page.getByRole("heading", { name: "Tiến độ học tập" })).toBeVisible();
  await expect(page.getByText("E2E-COURSE")).toBeVisible();
});

test("admin views student and teacher 360 profiles", async ({ page }) => {
  await login(page, "admin@nsa.local");
  await page.getByRole("link", { name: "Học viên", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/hoc-vien$/);
  await page.getByRole("link", { name: "Demo Student" }).first().click();
  await expect(page).toHaveURL(/\/admin\/hoc-vien\/[0-9a-f-]+$/);
  await expect(page.getByRole("tab", { name: "Tổng quan" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Lớp hiện tại & lịch sử" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Lịch cá nhân" })).toBeVisible();

  await page.getByRole("link", { name: "Giảng viên", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/giang-vien$/);
  await page.getByRole("link", { name: "Demo Teacher" }).first().click();
  await expect(page).toHaveURL(/\/admin\/giang-vien\/[0-9a-f-]+$/);
  await expect(page.getByRole("tab", { name: "Tổng quan" })).toBeVisible();
});
