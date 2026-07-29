import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "../dialog";

function Fixture({ size }: { size?: "sm" | "md" | "lg" | "full" }) {
  return (
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>Delete document</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
}

describe("Dialog", () => {
  it("renders the trigger and keeps the dialog closed initially", () => {
    render(<Fixture />);
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on trigger click with the title as accessible name", async () => {
    render(<Fixture />);
    open();
    expect(await screen.findByRole("dialog", { name: "Delete document" })).toBeInTheDocument();
  });

  it("renders the description inside the open dialog", async () => {
    render(<Fixture />);
    open();
    expect(await screen.findByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("closes when Escape is pressed", async () => {
    render(<Fixture />);
    open();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when DialogClose is activated", async () => {
    render(<Fixture />);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("applies the default md size class", async () => {
    render(<Fixture />);
    open();
    expect(await screen.findByRole("dialog")).toHaveClass("max-w-lg");
  });

  it("applies the requested size class", async () => {
    render(<Fixture size="sm" />);
    open();
    expect(await screen.findByRole("dialog")).toHaveClass("max-w-sm");
  });

  it("styles the content with theme tokens", async () => {
    render(<Fixture />);
    open();
    expect(await screen.findByRole("dialog")).toHaveClass("bg-background", "text-foreground");
  });

  it("lets a caller className override the content max width", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Titled</DialogTitle>
          <DialogDescription>Described</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass("max-w-3xl");
    expect(dialog).not.toHaveClass("max-w-lg");
  });
});
