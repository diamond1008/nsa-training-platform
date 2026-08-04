import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button, Modal, Select } from "./ui";

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Mở hiệu chỉnh</Button>
      <Modal open={open} title="Hiệu chỉnh" onClose={() => setOpen(false)}>
        <label htmlFor="reason">Lý do</label>
        <input id="reason" />
        <Button onClick={() => setOpen(false)}>Lưu</Button>
      </Modal>
    </>
  );
}

describe("Modal accessibility", () => {
  it("moves focus inside, traps Tab, and restores the trigger on close", () => {
    render(<ModalHarness />);
    const trigger = screen.getByRole("button", { name: "Mở hiệu chỉnh" });
    trigger.focus();
    fireEvent.click(trigger);

    const close = screen.getByRole("button", { name: "Đóng" });
    const save = screen.getByRole("button", { name: "Lưu" });
    expect(close).toHaveFocus();

    save.focus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.click(close);
    expect(trigger).toHaveFocus();
  });
});

describe("Select accessibility", () => {
  it("exposes listbox state and selected option", () => {
    const onChange = vi.fn();
    render(
      <Select label="Trạng thái" value="active" onChange={onChange}>
        <option value="">Tất cả</option>
        <option value="active">Đang hoạt động</option>
      </Select>,
    );

    const trigger = screen.getByRole("button", { name: "Trạng thái" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: "Đang hoạt động" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: { value: "", name: undefined } }),
    );
  });
});
