export default function Pagination({ totalPages, currentPage, onPageChange }) {
  return (
    <div className="flex justify-center mt-6">
      {[...Array(totalPages)].map((_, i) => (
        <button
          key={i}
          onClick={() => onPageChange(i + 1)}
          className={`px-3 py-1 mx-1 rounded ${
            currentPage === i + 1 ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}
