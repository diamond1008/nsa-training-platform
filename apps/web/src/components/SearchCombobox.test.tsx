import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchCombobox } from "./SearchCombobox";

describe("SearchCombobox", () => {
  it("supports keyboard selection and reports the selected value", () => {
    const onChange = vi.fn();
    render(
      <SearchCombobox
        label="Lớp học"
        value=""
        onChange={onChange}
        options={[
          { value: "class-1", label: "SE1801 — Kỹ thuật điện" },
          { value: "class-2", label: "DV1802 — Chăm sóc khách hàng" },
        ]}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Lớp học" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("class-1");
  });

  it("announces loading and zero-result states", () => {
    const view = render(
      <SearchCombobox label="Buổi học" value="" onChange={() => undefined} options={[]} loading />,
    );
    fireEvent.focus(screen.getByRole("combobox", { name: "Buổi học" }));
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải lựa chọn");

    view.rerender(
      <SearchCombobox label="Buổi học" value="" onChange={() => undefined} options={[]} />,
    );
    expect(screen.getByText("Không tìm thấy lựa chọn phù hợp")).toBeInTheDocument();
  });

  it("closes the listbox when focus moves outside", () => {
    render(
      <div>
        <SearchCombobox
          label="Lớp học"
          value=""
          onChange={() => undefined}
          options={[{ value: "class-1", label: "KT000001" }]}
        />
        <button type="button">Ngoài combobox</button>
      </div>,
    );

    fireEvent.focus(screen.getByRole("combobox", { name: "Lớp học" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Ngoài combobox" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
