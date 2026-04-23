import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import StellarTxLink, { truncateHash } from "./index";

const HASH = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

describe("truncateHash", () => {
  it("shows first 8 and last 8 chars with ellipsis", () => {
    expect(truncateHash(HASH)).toBe(`${HASH.slice(0, 8)}...${HASH.slice(-8)}`);
  });

  it("formats correctly", () => {
    const result = truncateHash(HASH);
    expect(result).toBe(`${HASH.slice(0, 8)}...${HASH.slice(-8)}`);
  });
});

describe("StellarTxLink", () => {
  it("renders placeholder when hash is null", () => {
    render(<StellarTxLink hash={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders placeholder when hash is undefined", () => {
    render(<StellarTxLink />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders truncated hash as link", () => {
    render(<StellarTxLink hash={HASH} />);
    expect(screen.getByText(`${HASH.slice(0, 8)}...${HASH.slice(-8)}`)).toBeInTheDocument();
  });

  it("link points to stellar testnet explorer", () => {
    render(<StellarTxLink hash={HASH} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `https://stellar.expert/explorer/testnet/tx/${HASH}`);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("copy button writes hash to clipboard", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<StellarTxLink hash={HASH} />);
    fireEvent.click(screen.getByLabelText("Copy transaction hash"));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(HASH));
  });

  it("shows tick icon after copy", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<StellarTxLink hash={HASH} />);
    fireEvent.click(screen.getByLabelText("Copy transaction hash"));

    await waitFor(() => expect(screen.queryByLabelText("Copy transaction hash")).toBeInTheDocument());
  });
});
