import React from "react";
import { render, screen } from "@testing-library/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";

describe("Table", () => {
  it("uses theme-aware colors for every table region", () => {
    render(
      <Table data-testid="table">
        <TableHeader data-testid="table-header">
          <TableRow data-testid="table-row">
            <TableHead data-testid="table-head">Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ada Lovelace</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toHaveClass("text-foreground");
    expect(screen.getByTestId("table-header")).toHaveClass("bg-muted");
    expect(screen.getByTestId("table-row")).toHaveClass("border-border");
    expect(screen.getByRole("columnheader")).toHaveClass(
      "text-muted-foreground",
    );
    expect(screen.getByRole("table")).not.toHaveClass("text-gray-900");
    expect(screen.getByTestId("table-header")).not.toHaveClass("bg-gray-50");
  });

  it("allows callers to override token classes", () => {
    render(
      <Table className="w-1/2" data-testid="table">
        <TableBody />
      </Table>,
    );

    expect(screen.getByTestId("table")).toHaveClass("w-1/2", "text-foreground");
  });
});
