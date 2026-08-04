import { describe, expect, it } from "vitest";

import type { CourseTestResults } from "../../lib/domainTypes";
import { normalizeCourseTestResults } from "./teacherApi";

describe("normalizeCourseTestResults", () => {
  it("converts legacy null attempt lists into empty arrays", () => {
    const payload = {
      course_id: "course-1",
      course_code: "KT01",
      course_name: "Kỹ thuật",
      student_id: "student-1",
      tests: [
        {
          test: {
            id: "test-1",
            course_id: "course-1",
            code: "KT01-GK",
            title: "Kiểm tra giữa khóa",
            kind: "class_test",
            pass_score: 5,
            is_required: true,
            sequence_no: 1,
            is_active: true,
          },
          attempts: null,
          passed: false,
          best_score: null,
        },
      ],
    } as unknown as CourseTestResults;

    expect(normalizeCourseTestResults(payload).tests[0].attempts).toEqual([]);
  });
});
