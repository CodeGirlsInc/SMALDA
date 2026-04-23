import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import DocumentFilters from "./DocumentFilters";

jest.useFakeTimers();

describe("DocumentFilters – debounce", () => {
  it("does not call onChange immediately on search input", () => {
    const onChange = jest.fn();
    render(<DocumentFilters onChange={onChange} debounceMs={300} />);
    fireEvent.change(screen.getByLabelText(/search documents/i), { target: { value: "parcel" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls onChange after debounce delay", () => {
    const onChange = jest.fn();
    render(<DocumentFilters onChange={onChange} debounceMs={300} />);
    fireEvent.change(screen.getByLabelText(/search documents/i), { target: { value: "parcel" } });
    act(() => jest.advanceTimersByTime(300));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ search: "parcel" }));
  });

  it("debounces multiple rapid inputs into one call", () => {
    const onChange = jest.fn();
    render(<DocumentFilters onChange={onChange} debounceMs={300} />);
    const input = screen.getByLabelText(/search documents/i);
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.change(input, { target: { value: "abc" } });
    act(() => jest.advanceTimersByTime(300));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ search: "abc" }));
  });
});

describe("DocumentFilters – filter state", () => {
  it("shows active filter count badge when filters are set", () => {
    render(<DocumentFilters />);
    fireEvent.change(screen.getByLabelText(/filter by status/i), { target: { value: "VERIFIED" } });
    expect(screen.getByLabelText("1 active filters")).toBeInTheDocument();
  });

  it("clears all filters on Clear all click", () => {
    const onChange = jest.fn();
    render(<DocumentFilters onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/filter by status/i), { target: { value: "FLAGGED" } });
    fireEvent.change(screen.getByLabelText(/search documents/i), { target: { value: "test" } });
    fireEvent.click(screen.getByRole("button", { name: /clear all filters/i }));
    expect(onChange).toHaveBeenLastCalledWith({ search: "", status: "ALL", dateFrom: "", dateTo: "" });
    expect(screen.queryByLabelText(/active filters/i)).toBeNull();
  });

  it("does not show badge when no filters active", () => {
    render(<DocumentFilters />);
    expect(screen.queryByLabelText(/active filters/i)).toBeNull();
  });
});
