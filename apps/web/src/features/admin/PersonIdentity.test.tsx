import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { directoryRowNumber, PersonAvatar } from "./PersonIdentity";

describe("person directory identity", () => {
  it("calculates a pagination-aware row number", () => {
    expect(directoryRowNumber(1, 10, 0)).toBe(1);
    expect(directoryRowNumber(3, 10, 4)).toBe(25);
  });

  it("renders a stored avatar with explicit dimensions", () => {
    render(<PersonAvatar fullName="Nguyen An" avatarUrl="data:image/webp;base64,test" />);
    const image = screen.getByRole("img", { name: "Nguyen An" });
    expect(image).toHaveAttribute("width", "36");
    expect(image).toHaveAttribute("height", "36");
  });

  it("falls back to the final two initials", () => {
    render(<PersonAvatar fullName="Nguyen Van An" />);
    expect(screen.getByText("VA")).toBeInTheDocument();
  });
});
