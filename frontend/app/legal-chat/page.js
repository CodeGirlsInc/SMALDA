"use client";
import { useState } from "react";
import ChatWindow from "@/components/ChatWindow";
import ChatInput from "@/components/ChatInput";

export default function LegalChatPage() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text: "Hello, I am SMALDA. How can I assist you with your land dispute case today?",
    },
  ]);

  const handleSend = (text) => {
    if (!text.trim()) return;

    // Add user's message
    const newMessage = { id: Date.now(), sender: "user", text };
    setMessages((prev) => [...prev, newMessage]);

    // Mock bot reply (simulating backend response)
    setTimeout(() => {
      const botReply = {
        id: Date.now() + 1,
        sender: "bot",
        text: "This is a placeholder AI response to your query.",
      };
      setMessages((prev) => [...prev, botReply]);
    }, 800);
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 h-[calc(100vh-4rem)] flex flex-col">
      <h1 className="text-2xl font-bold mb-4">SMALDA Legal Assistant</h1>
      <div className="flex-1 bg-gray-50 border rounded-lg flex flex-col">
        <ChatWindow messages={messages} />
        <ChatInput onSend={handleSend} />
      </div>
    </main>
  );
}
