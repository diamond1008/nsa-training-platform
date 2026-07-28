import { describe, expect, it } from "vitest";

import { statusLabel, toQuery } from "./format";

describe("format helpers", () => {
  it("maps known statuses and preserves unknown values", () => {
    expect(statusLabel("active")).toBe("Hoạt động");
    expect(statusLabel("custom_status")).toBe("custom_status");
  });

  it("builds an encoded query and omits empty values", () => {
    expect(toQuery({ page: 2, search: "động cơ", status: "", class_id: undefined })).toBe(
      "?page=2&search=%C4%91%E1%BB%99ng+c%C6%A1",
    );
  });
});
