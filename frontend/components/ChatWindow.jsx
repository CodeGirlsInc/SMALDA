import ChatMessage from "./ChatMessage";

export default function ChatWindow({ messages }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} sender={msg.sender} text={msg.text} />
      ))}
    </div>
  );
}
