import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ShareModal from "./ShareModal";

const noop = () => {};

describe("ShareModal – email validation", () => {
  it("shows error for invalid email", async () => {
    render(<ShareModal documentId="doc1" onClose={noop} />);
    fireEvent.change(screen.getByLabelText(/recipient email/i), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: /^share$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i);
  });

  it("does not show error for valid email", async () => {
    const onShare = jest.fn().mockResolvedValue(undefined);
    render(<ShareModal documentId="doc1" onShare={onShare} onClose={noop} />);
    fireEvent.change(screen.getByLabelText(/recipient email/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^share$/i }));
    await waitFor(() => expect(onShare).toHaveBeenCalledWith("doc1", "user@example.com"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("ShareModal – share submission", () => {
  it("adds email to shared list on success", async () => {
    const onShare = jest.fn().mockResolvedValue(undefined);
    render(<ShareModal documentId="doc1" onShare={onShare} onClose={noop} />);
    fireEvent.change(screen.getByLabelText(/recipient email/i), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^share$/i }));
    expect(await screen.findByText("new@example.com")).toBeInTheDocument();
  });

  it("shows error message on API failure", async () => {
    const onShare = jest.fn().mockRejectedValue(new Error("fail"));
    render(<ShareModal documentId="doc1" onShare={onShare} onClose={noop} />);
    fireEvent.change(screen.getByLabelText(/recipient email/i), { target: { value: "fail@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^share$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/failed to share/i);
  });

  it("calls onRevoke and removes entry", async () => {
    const onRevoke = jest.fn().mockResolvedValue(undefined);
    render(
      <ShareModal
        documentId="doc1"
        existingShares={[{ id: "s1", email: "shared@example.com" }]}
        onRevoke={onRevoke}
        onClose={noop}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /revoke access for shared@example.com/i }));
    await waitFor(() => expect(onRevoke).toHaveBeenCalledWith("doc1", "s1"));
    expect(screen.queryByText("shared@example.com")).toBeNull();
  });
});
