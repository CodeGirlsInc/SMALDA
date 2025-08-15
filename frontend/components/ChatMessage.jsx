export default function ChatMessage({ sender, text }) {
  const isUser = sender === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`px-4 py-2 rounded-lg max-w-xs sm:max-w-md text-sm 
        ${isUser ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}`}
      >
        {text}
      </div>
    </div>
  );
}
