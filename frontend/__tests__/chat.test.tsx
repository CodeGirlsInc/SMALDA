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
{
          id: "2",
          content: "Failed message",
          role: "user",
          timestamp: new Date(),
          status: "error",
        },
      ]

      render(<Chat messages={messagesWithStatus} />)

      expect(screen.getByText("Failed to send")).toBeInTheDocument()
    })
  })

  describe("Input Handling", () => {
    it("updates input value when typing", async () => {
      render(<Chat />)

      const input = screen.getByTestId("chat-input")

      await user.type(input, "Hello world")

      expect(input).toHaveValue("Hello world")
    })

    it("respects maxLength limit", async () => {
      render(<Chat maxLength={10} />)

      const input = screen.getByTestId("chat-input")

      await user.type(input, "This is a very long message that exceeds the limit")

      expect(input).toHaveValue("This is a ")
      expect(screen.getByText("10/10")).toBeInTheDocument()
    })

    it("shows character count", async () => {
      render(<Chat maxLength={100} />)

      const input = screen.getByTestId("chat-input")

      await user.type(input, "Hello")

      expect(screen.getByText("5/100")).toBeInTheDocument()
    })

    it("clears input after sending message", async () => {
      const onSendMessage = jest.fn().mockResolvedValue(undefined)
      render(<Chat onSendMessage={onSendMessage} />)

      const input = screen.getByTestId("chat-input")
      const sendButton = screen.getByTestId("send-button")

      await user.type(input, "Test message")
      await user.click(sendButton)

      expect(input).toHaveValue("")
    })
  })

  describe("Button Interactions", () => {
    it("sends message when send button is clicked", async () => {
      const onSendMessage = jest.fn().mockResolvedValue(undefined)
      render(<Chat onSendMessage={onSendMessage} />)

      const input = screen.getByTestId("chat-input")
      const sendButton = screen.getByTestId("send-button")

      await user.type(input, "Test message")
      await user.click(sendButton)

      expect(onSendMessage).toHaveBeenCalledWith("Test message")
    })

    it("sends message when Enter key is pressed", async () => {
      const onSendMessage = jest.fn().mockResolvedValue(undefined)
      render(<Chat onSendMessage={onSendMessage} />)

      const input = screen.getByTestId("chat-input")

      await user.type(input, "Test message")
      await user.keyboard("{Enter}")

      expect(onSendMessage).toHaveBeenCalledWith("Test message")
    })

    it("does not send message when Shift+Enter is pressed", async () => {
      const onSendMessage = jest.fn().mockResolvedValue(undefined)
      render(<Chat onSendMessage={onSendMessage} />)

      const input = screen.getByTestId("chat-input")

      await user.type(input, "Test message")
      await user.keyboard("{Shift>}{Enter}{/Shift}")

      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it("disables send button when input is empty", () => {
      render(<Chat />)
