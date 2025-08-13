export default function CaseSearchBar({ filters, setFilters, onSearch }) {
  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <input
          type="text"
          name="query"
          placeholder="Search by case title..."
          value={filters.query}
          onChange={handleChange}
          className="border rounded px-3 py-2 w-full"
        />

        <select
          name="region"
          value={filters.region}
          onChange={handleChange}
          className="border rounded px-3 py-2 w-full md:w-40"
        >
          <option value="">All Regions</option>
          <option value="Kaduna">Kaduna</option>
          <option value="Lagos">Lagos</option>
        </select>

        <select
          name="year"
          value={filters.year}
          onChange={handleChange}
          className="border rounded px-3 py-2 w-full md:w-28"
        >
          <option value="">All Years</option>
          <option value="2023">2023</option>
          <option value="2022">2022</option>
        </select>

        <select
          name="outcome"
          value={filters.outcome}
          onChange={handleChange}
          className="border rounded px-3 py-2 w-full md:w-32"
        >
          <option value="">All Outcomes</option>
          <option value="Resolved">Resolved</option>
          <option value="Pending">Pending</option>
        </select>

        <button
          onClick={onSearch}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Search
        </button>
      </div>
    </div>
  );
}
