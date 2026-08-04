import { describe, expect, it } from "vitest";

import { patchListQuery, readListQuery } from "./listQuery";

const config = {
  filterKeys: ["status", "course_id"] as const,
  allowedSorts: ["student_code", "full_name", "created_at"] as const,
  defaultSort: "created_at",
  defaultOrder: "desc" as const,
};

describe("list query state", () => {
  it("normalizes malformed pagination and sort values without losing valid filters", () => {
    const state = readListQuery(
      new URLSearchParams(
        "q=nguyen&page=-4&sort=password_hash&order=sideways&status=active&course_id=course-1",
      ),
      config,
    );

    expect(state).toEqual({
      q: "nguyen",
      page: 1,
      sort: "created_at",
      order: "desc",
      filters: { status: "active", course_id: "course-1" },
    });
  });

  it("resets the page for filter changes and omits default values from the URL", () => {
    const next = patchListQuery(
      new URLSearchParams("page=4&sort=created_at&order=desc&status=active"),
      { q: "  an  ", status: "" },
      config,
    );

    expect(next.toString()).toBe("q=an");
  });

  it("keeps pagination when only the page changes", () => {
    const next = patchListQuery(new URLSearchParams("q=an&status=active"), { page: 3 }, config);

    expect(next.toString()).toBe("q=an&status=active&page=3");
  });
});
