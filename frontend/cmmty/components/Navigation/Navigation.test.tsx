import { render, screen, fireEvent } from "@testing-library/react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";

jest.mock("next/navigation", () => ({ usePathname: jest.fn() }));
jest.mock("next/link", () => ({ __esModule: true, default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));

const mockPathname = usePathname as jest.Mock;

describe("Sidebar – active link detection", () => {
  it("marks the current route as active", () => {
    mockPathname.mockReturnValue("/documents");
    render(<Sidebar />);
    const link = screen.getByRole("link", { name: /documents/i });
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("does not mark other routes as active", () => {
    mockPathname.mockReturnValue("/documents");
    render(<Sidebar />);
    const dashLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashLink).not.toHaveAttribute("aria-current", "page");
  });

  it("hides Admin link when isAdmin is false", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<Sidebar isAdmin={false} />);
    expect(screen.queryByRole("link", { name: /admin/i })).toBeNull();
  });

  it("shows Admin link when isAdmin is true", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<Sidebar isAdmin={true} />);
    expect(screen.getByRole("link", { name: /admin/i })).toBeInTheDocument();
  });

  it("collapses sidebar on toggle", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<Sidebar />);
    const btn = screen.getByRole("button", { name: /collapse/i });
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: /expand/i })).toBeInTheDocument();
  });
});

describe("Header – active link detection", () => {
  it("marks the current route as active in mobile menu", () => {
    mockPathname.mockReturnValue("/upload");
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    const link = screen.getByRole("link", { name: /upload/i });
    expect(link).toHaveAttribute("aria-current", "page");
  });
});
