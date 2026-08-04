import { Button } from "../../components/ui";
import type { Enrollment } from "../../lib/domainTypes";

export type EnrollmentAction = "transfer" | "completed" | "withdrawn" | "reenroll";

export function EnrollmentActionButtons({
  enrollment,
  onAction,
}: {
  enrollment: Enrollment;
  onAction: (action: EnrollmentAction) => void;
}) {
  if (enrollment.status === "withdrawn") {
    return (
      <Button variant="soft" onClick={() => onAction("reenroll")}>
        Đưa trở lại lớp
      </Button>
    );
  }
  if (enrollment.status !== "enrolled") return null;
  return (
    <>
      <Button variant="soft" onClick={() => onAction("transfer")}>
        Chuyển lớp
      </Button>
      <Button variant="ghost" onClick={() => onAction("completed")}>
        Hoàn thành
      </Button>
      <Button variant="danger" onClick={() => onAction("withdrawn")}>
        Rút lớp
      </Button>
    </>
  );
}
