"use client";

import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  status?: "sending" | "sent" | "error";
}

interface ChatProps {
  messages?: ChatMessage[];
  onSendMessage?: (message: string) => Promise<void>;
  onMessageChange?: (messages: ChatMessage[]) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  maxLength?: number;
  showTimestamps?: boolean;
}

export function Chat({
  messages: initialMessages = [],
  onSendMessage,
  onMessageChange,
  placeholder = "Type your message...",
  disabled = false,
  isLoading = false,
  className,
  maxLength = 1000,
  showTimestamps = false,
}: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addMessage = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => {
        const updated = [...prev, message];
        onMessageChange?.(updated);
        return updated;
      });
    },
    [onMessageChange]
  );

  const updateMessage = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      setMessages((prev) => {
        const updated = prev.map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        );
        onMessageChange?.(updated);
        return updated;
      });
    },
    [onMessageChange]
  );

  const handleSendMessage = useCallback(async () => {
    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage || disabled || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random()}`,
      content: trimmedMessage,
      role: "user",
      timestamp: new Date(),
      status: "sending",
    };

    // Clear input and add user message
    setInputValue("");
    addMessage(userMessage);

    try {
      // Update user message status to sent
      updateMessage(userMessage.id, { status: "sent" });

      if (onSendMessage) {
        setIsTyping(true);
        await onSendMessage(trimmedMessage);
        setIsTyping(false);
      } else {
        // Simulate bot response if no handler provided
        setIsTyping(true);
        setTimeout(() => {
          const botMessage: ChatMessage = {
            id: `bot-${Date.now()}-${Math.random()}`,
            content: `I received your message: "${trimmedMessage}"`,
            role: "assistant",
            timestamp: new Date(),
            status: "sent",
          };
          addMessage(botMessage);
          setIsTyping(false);
        }, 1000);
      }
    } catch (error) {
      updateMessage(userMessage.id, {
        status: "error",
      });
      setIsTyping(false);
    }
  }, [
    inputValue,
    disabled,
    isLoading,
    onSendMessage,
    addMessage,
    updateMessage,
  ]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (value.length <= maxLength) {
        setInputValue(value);
      }
    },
    [maxLength]
  );

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canSend = inputValue.trim().length > 0 && !disabled && !isLoading;

  return (
    <Card className={cn("flex flex-col h-96", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <Bot className="h-5 w-5" />
          <h3 className="font-semibold">Chat</h3>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4 p-4 pt-0">
        <ScrollArea
          ref={scrollAreaRef}
          className="flex-1 pr-4"
          data-testid="chat-messages"
        >
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Start a conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start space-x-2",
                    message.role === "user" &&
                      "flex-row-reverse space-x-reverse"
                  )}
                  data-testid={`message-${message.role}`}
                >
                  <div
                    className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    )}
                  >
                    {message.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>

                  <div
                    className={cn(
                      "flex-1 max-w-[80%]",
                      message.role === "user" && "text-right"
                    )}
                  >
                    <div
                      className={cn(
                        "inline-block px-3 py-2 rounded-lg text-sm",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      )}
                    >
                      {message.content}
                    </div>

                    <div className="flex items-center space-x-2 mt-1">
                      {showTimestamps && (
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(message.timestamp)}
                        </span>
                      )}
                      {message.status === "sending" && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                      {message.status === "error" && (
                        <span className="text-xs text-destructive">
                          Failed to send
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            {(isTyping || isLoading) && (
              <div
                className="flex items-start space-x-2"
                data-testid="typing-indicator"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-secondary text-secondary-foreground px-3 py-2 rounded-lg">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                    <div
                      className="w-2 h-2 bg-current rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-2 h-2 bg-current rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex space-x-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            className="flex-1"
            data-testid="chat-input"
            maxLength={maxLength}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!canSend}
            size="sm"
            data-testid="send-button"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {maxLength && (
          <div className="text-xs text-muted-foreground text-right">
            {inputValue.length}/{maxLength}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
