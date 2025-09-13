import type { ChatMessage, UploadFile } from "@/components/chat";
import { jest } from "@jest/globals";

// Mock chat messages for testing
export const mockChatMessages: ChatMessage[] = [
  {
    id: "msg-1",
    content: "Hello! How can I help you today?",
    role: "assistant",
    timestamp: new Date("2024-01-01T10:00:00Z"),
    status: "sent",
  },
  {
    id: "msg-2",
    content: "I need help with uploading files",
    role: "user",
    timestamp: new Date("2024-01-01T10:01:00Z"),
    status: "sent",
  },
  {
    id: "msg-3",
    content:
      "I can help you with that! You can drag and drop files or click the browse button.",
    role: "assistant",
    timestamp: new Date("2024-01-01T10:02:00Z"),
    status: "sent",
  },
];

// Mock upload files for testing
export const createMockFile = (
  name: string,
  size: number,
  type = "text/plain"
): File => {
  const file = new File(["mock content"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

export const mockUploadFiles: UploadFile[] = [
  {
    id: "upload-1",
    file: createMockFile("document.pdf", 1024 * 1024, "application/pdf"),
    status: "pending",
    progress: 0,
  },
  {
    id: "upload-2",
    file: createMockFile("image.jpg", 512 * 1024, "image/jpeg"),
    status: "success",
    progress: 100,
    preview:
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  },
  {
    id: "upload-3",
    file: createMockFile("large-file.zip", 15 * 1024 * 1024, "application/zip"),
    status: "error",
    progress: 0,
    error: "File size exceeds 10MB limit",
  },
];

// Mock API responses
export const mockApiResponses = {
  uploadSuccess: {
    success: true,
    message: "Files uploaded successfully",
    files: mockUploadFiles.filter((f) => f.status === "success"),
  },
  uploadError: {
    success: false,
    message: "Upload failed",
    error: "Server error occurred",
  },
  chatResponse: {
    id: "response-1",
    content: "Thank you for your message! I understand you need assistance.",
    role: "assistant" as const,
    timestamp: new Date(),
    status: "sent" as const,
  },
};

// Test utilities
export const createMockEvent = (type: string, data: any = {}) => {
  return {
    type,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    ...data,
  };
};

export const createMockDataTransfer = (files: File[]) => {
  return {
    files: {
      length: files.length,
      ...files,
      item: (index: number) => files[index],
    },
    types: ["Files"],
  };
};

// Mock handlers for testing
export const mockHandlers = {
  onFilesChange: jest.fn(),
  onUpload: jest.fn().mockResolvedValue(undefined),
  onSendMessage: jest.fn().mockResolvedValue(undefined),
  onMessageChange: jest.fn(),
};
