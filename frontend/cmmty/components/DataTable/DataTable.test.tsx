import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import DataTable, { Column } from "./index";

type Row = { name: string; score: number };

const columns: Column<Row>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "score", header: "Score", sortable: true },
];

const data: Row[] = [
  { name: "Alice", score: 80 },
  { name: "Bob", score: 40 },
  { name: "Carol", score: 60 },
];

describe("DataTable", () => {
  it("renders all rows", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
  });

  it("shows empty state when data is empty", () => {
    render(<DataTable columns={columns} data={[]} emptyState={<p>Nothing here</p>} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("shows default empty state when no emptyState prop", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("No data available.")).toBeInTheDocument();
  });

  it("sorts ascending on header click", () => {
    render(<DataTable columns={columns} data={data} />);
    fireEvent.click(screen.getByText("Name"));
    const cells = screen.getAllByRole("cell").filter((_, i) => i % 2 === 0);
    expect(cells[0]).toHaveTextContent("Alice");
    expect(cells[1]).toHaveTextContent("Bob");
    expect(cells[2]).toHaveTextContent("Carol");
  });

  it("sorts descending on second header click", () => {
    render(<DataTable columns={columns} data={data} />);
    fireEvent.click(screen.getByText("Name"));
    fireEvent.click(screen.getByText("Name"));
    const cells = screen.getAllByRole("cell").filter((_, i) => i % 2 === 0);
    expect(cells[0]).toHaveTextContent("Carol");
    expect(cells[1]).toHaveTextContent("Bob");
    expect(cells[2]).toHaveTextContent("Alice");
  });

  it("paginates data", () => {
    const bigData: Row[] = Array.from({ length: 12 }, (_, i) => ({ name: `User${i}`, score: i }));
    render(<DataTable columns={columns} data={bigData} pageSize={5} />);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("User0")).toBeInTheDocument();
    expect(screen.queryByText("User5")).not.toBeInTheDocument();
  });

  it("navigates to next page", () => {
    const bigData: Row[] = Array.from({ length: 12 }, (_, i) => ({ name: `User${i}`, score: i }));
    render(<DataTable columns={columns} data={bigData} pageSize={5} />);
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("User5")).toBeInTheDocument();
  });

  it("prev button disabled on first page", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
  });

  it("next button disabled on last page", () => {
    render(<DataTable columns={columns} data={data} pageSize={10} />);
    expect(screen.getByLabelText("Next page")).toBeDisabled();
  });
});
