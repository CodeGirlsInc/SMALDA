import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Chat, type ChatMessage } from "@/components/chat"
import jest from "jest" // Import jest to fix the undeclared variable error

// Mock data
const mockMessages: ChatMessage[] = [
  {
    id: "1",
    content: "Hello, how can I help you?",
    role: "assistant",
    timestamp: new Date("2024-01-01T10:00:00Z"),
    status: "sent",
  },
  {
    id: "2",
    content: "I need help with my account",
    role: "user",
    timestamp: new Date("2024-01-01T10:01:00Z"),
    status: "sent",
  },
]

describe("Chat Component", () => {
  const user = userEvent.setup()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Rendering", () => {
    it("renders chat interface with correct elements", () => {
      render(<Chat />)

      expect(screen.getByText("Chat")).toBeInTheDocument()
      expect(screen.getByTestId("chat-input")).toBeInTheDocument()
      expect(screen.getByTestId("send-button")).toBeInTheDocument()
      expect(screen.getByTestId("chat-messages")).toBeInTheDocument()
    })

    it("shows empty state when no messages", () => {
      render(<Chat />)

      expect(screen.getByText("Start a conversation!")).toBeInTheDocument()
    })

    it("renders existing messages", () => {
      render(<Chat messages={mockMessages} />)

      expect(screen.getByText("Hello, how can I help you?")).toBeInTheDocument()
      expect(screen.getByText("I need help with my account")).toBeInTheDocument()
    })

    it("applies disabled state correctly", () => {
      render(<Chat disabled />)

      expect(screen.getByTestId("chat-input")).toBeDisabled()
      expect(screen.getByTestId("send-button")).toBeDisabled()
    })

    it("shows loading state", () => {
      render(<Chat isLoading />)

      expect(screen.getByTestId("chat-input")).toBeDisabled()
      expect(screen.getByTestId("send-button")).toBeDisabled()
    })
  })

  describe("Message Display", () => {
    it("displays messages with correct styling for different roles", () => {
      render(<Chat messages={mockMessages} />)

      const assistantMessage = screen.getByTestId("message-assistant")
      const userMessage = screen.getByTestId("message-user")

      expect(assistantMessage).toBeInTheDocument()
      expect(userMessage).toBeInTheDocument()

      // User messages should have different alignment
      expect(userMessage).toHaveClass("flex-row-reverse")
    })

    it("shows timestamps when enabled", () => {
      render(<Chat messages={mockMessages} showTimestamps />)

      expect(screen.getByText("10:00")).toBeInTheDocument()
      expect(screen.getByText("10:01")).toBeInTheDocument()
    })

    it("displays message status indicators", () => {
      const messagesWithStatus: ChatMessage[] = [
        {
          id: "1",
          content: "Sending message...",
          role: "user",
          timestamp: new Date(),
          status: "sending",
        },
