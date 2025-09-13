import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Upload } from "@/components/upload"
import jest from "jest" // Import jest to declare the variable

// Mock data
const createMockFile = (name: string, size: number, type = "text/plain"): File => {
  const file = new File(["test content"], name, { type })
  Object.defineProperty(file, "size", { value: size })
  return file
}

const mockFiles = [
  createMockFile("test1.txt", 1024, "text/plain"),
  createMockFile("test2.jpg", 2048, "image/jpeg"),
  createMockFile("large.pdf", 15 * 1024 * 1024, "application/pdf"), // 15MB - exceeds default limit
]

describe("Upload Component", () => {
  const user = userEvent.setup()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Rendering", () => {
    it("renders upload area with correct elements", () => {
      render(<Upload />)

      expect(screen.getByText("Drag and drop files here")).toBeInTheDocument()
      expect(screen.getByText("or click to browse files")).toBeInTheDocument()
      expect(screen.getByTestId("browse-button")).toBeInTheDocument()
      expect(screen.getByTestId("file-input")).toBeInTheDocument()
    })

    it("renders with custom placeholder text when dragging", () => {
      render(<Upload />)

      const uploadArea = screen.getByText("Drag and drop files here").closest(".border-dashed")

      fireEvent.dragOver(uploadArea!)
      expect(screen.getByText("Drop files here")).toBeInTheDocument()
    })

    it("applies disabled state correctly", () => {
      render(<Upload disabled />)

      expect(screen.getByTestId("browse-button")).toBeDisabled()
      expect(screen.getByTestId("file-input")).toBeDisabled()
    })
  })
