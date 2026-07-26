import React from "react";

type TableProps = React.HTMLAttributes<HTMLTableElement>;

export function Table({ className, children, ...props }: TableProps) {
  return (
    <table className={`w-full text-sm ${className ?? ""}`} {...props}>
      {children}
    </table>
  );
}

export function TableHeader({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-gray-50 ${className ?? ""}`} {...props}>
      {children}
    </thead>
  );
}

export function TableRow({ className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`border-b ${className ?? ""}`} {...props}>
      {children}
    </tr>
  );
}

export function TableHead({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`px-4 py-3 text-left font-medium text-gray-500 ${className ?? ""}`} {...props}>
      {children}
    </th>
  );
}

export function TableBody({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className ?? ""} {...props}>
      {children}
    </tbody>
  );
}

export function TableCell({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 ${className ?? ""}`} {...props}>
      {children}
    </td>
  );
}
