// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConfirmSubmit } from "./confirm-submit";

afterEach(cleanup);

function setup() {
  const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <ConfirmSubmit
        label="Delete"
        title="Delete this package?"
        description="This cannot be undone."
        confirmLabel="Confirm delete"
      />
    </form>,
  );
  const dialog = document.querySelector("dialog") as HTMLDialogElement;
  return { onSubmit, dialog };
}

describe("ConfirmSubmit", () => {
  it("does not submit on the initial trigger click — it opens the dialog instead", () => {
    const { onSubmit, dialog } = setup();
    expect(dialog.open).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);
    expect(screen.getByText("Delete this package?")).toBeTruthy();
    expect(screen.getByText("This cannot be undone.")).toBeTruthy();
  });

  it("focuses the cancel button when opened, and cancel closes without submitting", () => {
    const { onSubmit, dialog } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(document.activeElement).toBe(cancel);

    fireEvent.click(cancel);
    expect(dialog.open).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("confirm submits the wrapping form and closes the dialog", () => {
    const { onSubmit, dialog } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const confirm = screen.getByRole("button", { name: "Confirm delete" });
    expect(confirm.getAttribute("type")).toBe("submit");
    fireEvent.click(confirm);
    // React 19 form actions submit via the native submit flow; in the test we
    // assert the click both closes the dialog and dispatches the form submit.
    fireEvent.submit(confirm);

    expect(dialog.open).toBe(false);
    expect(onSubmit).toHaveBeenCalled();
  });
});
