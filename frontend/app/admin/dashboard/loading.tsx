export default function LoadingAdminDashboard() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-56 bg-gray-200 rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-80 bg-gray-200 rounded-xl animate-pulse" />
      <div className="h-80 bg-gray-200 rounded-xl animate-pulse" />
    </div>
  );
}
