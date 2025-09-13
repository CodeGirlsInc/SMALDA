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

  describe("File Selection", () => {
    it("handles file selection via input", async () => {
      const onFilesChange = jest.fn()
      render(<Upload onFilesChange={onFilesChange} />)

      const fileInput = screen.getByTestId("file-input")

      await user.upload(fileInput, mockFiles[0])

      await waitFor(() => {
        expect(onFilesChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              file: mockFiles[0],
              status: "pending",
              progress: 0,
            }),
          ]),
        )
      })
    })

    it("handles multiple file selection", async () => {
      const onFilesChange = jest.fn()
      render(<Upload onFilesChange={onFilesChange} multiple />)

      const fileInput = screen.getByTestId("file-input")

      await user.upload(fileInput, [mockFiles[0], mockFiles[1]])

      await waitFor(() => {
        expect(onFilesChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ file: mockFiles[0] }),
            expect.objectContaining({ file: mockFiles[1] }),
          ]),
        )
      })
    })

    it("respects maxFiles limit", async () => {
      const onFilesChange = jest.fn()
      render(<Upload onFilesChange={onFilesChange} maxFiles={1} />)

      const fileInput = screen.getByTestId("file-input")

      await user.upload(fileInput, [mockFiles[0], mockFiles[1]])


      await waitFor(() => {
        expect(onFilesChange).toHaveBeenCalledWith(
          expect.arrayContaining([expect.objectContaining({ file: mockFiles[0] })]),
        )
        expect(onFilesChange).toHaveBeenCalledWith(
          expect.not.arrayContaining([expect.objectContaining({ file: mockFiles[1] })]),
        )
      })
    })

    it("validates file size and shows error", async () => {
      const onFilesChange = jest.fn()
      render(<Upload onFilesChange={onFilesChange} maxSize={1024} />)

      const fileInput = screen.getByTestId("file-input")

      await user.upload(fileInput, mockFiles[1]) // 2048 bytes, exceeds 1024 limit

      await waitFor(() => {
        expect(onFilesChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              file: mockFiles[1],
              status: "error",
              error: expect.stringContaining("File size exceeds"),
            }),
          ]),
        )
      })
    })
  })

  describe("Drag and Drop", () => {
    it("handles drag over events", () => {
      render(<Upload />)

      const uploadArea = screen.getByText("Drag and drop files here").closest(".border-dashed")

      fireEvent.dragOver(uploadArea!, {
        dataTransfer: { files: mockFiles },
      })

      expect(uploadArea).toHaveClass("border-primary")
    })

    it("handles drag leave events", () => {
      render(<Upload />)

      const uploadArea = screen.getByText("Drag and drop files here").closest(".border-dashed")

      fireEvent.dragOver(uploadArea!)
      fireEvent.dragLeave(uploadArea!)

      expect(uploadArea).not.toHaveClass("border-primary")
    })

    it("handles file drop", async () => {
      const onFilesChange = jest.fn()
      render(<Upload onFilesChange={onFilesChange} />)

      const uploadArea = screen.getByText("Drag and drop files here").closest(".border-dashed")

      fireEvent.drop(uploadArea!, {
        dataTransfer: { files: [mockFiles[0]] },
      })

      await waitFor(() => {
        expect(onFilesChange).toHaveBeenCalledWith(
          expect.arrayContaining([expect.objectContaining({ file: mockFiles[0] })]),
        )
      })
    })

    it("ignores drag events when disabled", () => {
      render(<Upload disabled />)

      const uploadArea = screen.getByText("Drag and drop files here").closest(".border-dashed")

      fireEvent.dragOver(uploadArea!)

      expect(uploadArea).not.toHaveClass("border-primary")
    })
  })

  describe("File Management", () => {
    it("displays selected files with correct information", async () => {
      render(<Upload />)

      const fileInput = screen.getByTestId("file-input")
      await user.upload(fileInput, mockFiles[0])

      await waitFor(() => {
        expect(screen.getByText("Selected Files")).toBeInTheDocument()
        expect(screen.getByText("test1.txt")).toBeInTheDocument()
        expect(screen.getByText("1.0 KB")).toBeInTheDocument()
        expect(screen.getByText("pending")).toBeInTheDocument()
      })
    })

    
    it("removes files when remove button is clicked", async () => {
      const onFilesChange = jest.fn()
      render(<Upload onFilesChange={onFilesChange} />)

      const fileInput = screen.getByTestId("file-input")
      await user.upload(fileInput, mockFiles[0])

      await waitFor(() => {
        expect(screen.getByText("test1.txt")).toBeInTheDocument()
      })

      const removeButton = screen.getByTestId(/remove-file-/)
      await user.click(removeButton)

      expect(onFilesChange).toHaveBeenLastCalledWith([])
      expect(screen.queryByText("test1.txt")).not.toBeInTheDocument()
    })

    it("shows upload button when files are pending and onUpload is provided", async () => {
      const onUpload = jest.fn()
      render(<Upload onUpload={onUpload} />)

      const fileInput = screen.getByTestId("file-input")
      await user.upload(fileInput, mockFiles[0])

      await waitFor(() => {
        expect(screen.getByTestId("upload-button")).toBeInTheDocument()
        expect(screen.getByText("Upload 1 file")).toBeInTheDocument()
      })
    })
  })

  describe("Button Interactions", () => {
    it("opens file dialog when browse button is clicked", async () => {
      render(<Upload />)

      const browseButton = screen.getByTestId("browse-button")
      const fileInput = screen.getByTestId("file-input")

      const clickSpy = jest.spyOn(fileInput, "click")

      await user.click(browseButton)

      expect(clickSpy).toHaveBeenCalled()
    })

    it("calls onUpload when upload button is clicked", async () => {
      const onUpload = jest.fn().mockResolvedValue(undefined)
      render(<Upload onUpload={onUpload} />)

