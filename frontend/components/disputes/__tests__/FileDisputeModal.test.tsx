import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileDisputeModal } from "../FileDisputeModal";

const mockRequest = jest.fn();
const mockToast = jest.fn();

jest.mock("@/lib/api-client", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

function renderModal() {
  const onClose = jest.fn();
  const onDisputeFiled = jest.fn();
  render(
    <FileDisputeModal
      documents={[{ id: "doc-1", title: "Land title" }]}
      onDisputeFiled={onDisputeFiled}
      onClose={onClose}
    />,
  );
  return { onClose, onDisputeFiled };
}

describe("FileDisputeModal", () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockToast.mockReset();
  });

  it("uses dialog semantics and keeps focus inside the modal", async () => {
    renderModal();
    const dialog = await screen.findByRole("dialog", {
      name: "File a New Dispute",
    });
    const closeButton = screen.getByRole("button", { name: "Cancel" });
    closeButton.focus();

    await userEvent.tab();

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("closes on Escape", async () => {
    const { onClose } = renderModal();
    await screen.findByRole("dialog", { name: "File a New Dispute" });

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("unwraps a dispute data envelope before notifying the page", async () => {
    const dispute = {
      id: "dispute-1",
      documentId: "doc-1",
      description: "A sufficiently detailed dispute description.",
      reason: { id: "reason-1", name: "Ownership" },
      filedBy: "user-1",
      status: "open" as const,
      createdAt: "2026-07-28T00:00:00.000Z",
    };
    mockRequest.mockResolvedValue({ data: dispute });
    const { onDisputeFiled, onClose } = renderModal();
    await screen.findByRole("dialog", { name: "File a New Dispute" });

    fireEvent.change(screen.getByLabelText("Select Document"), {
      target: { value: "doc-1" },
    });
    fireEvent.change(screen.getByLabelText("Reason for Dispute"), {
      target: { value: dispute.description },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Dispute" }));

    await waitFor(() => expect(onDisputeFiled).toHaveBeenCalledWith(dispute));
    expect(mockRequest).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/disputes",
      expect.objectContaining({ method: "POST" }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
