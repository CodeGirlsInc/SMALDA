import CaseSearchBar from "@/components/CaseSearchBar";
import CaseTable from "@/components/CaseTable";
import Pagination from "@/components/Pagination";
import { useState } from "react";

export default function CaseSearchPage() {
  const [filters, setFilters] = useState({
    query: ", region: ",
    year: ", outcome: ",
  });
  const [cases, setCases] = useState([
    {
      id: 1,
      title: "Land Dispute in Kaduna",
      region: "Kaduna",
      year: 2023,
      outcome: "Resolved",
    },
    {
      id: 2,
      title: "Boundary Case in Lagos",
      region: "Lagos",
      year: 2022,
      outcome: "Pending",
    },
  ]);

  // This can later fetch from API
  const handleSearch = () => {
    console.log("Searching with:", filters);
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      ;
      <h1 className="text-2xl font-bold mb-6">
        ;Search Past Land Dispute Cases
      </h1>
      ;
      <CaseSearchBar
        filters={filters}
        setFilters={setFilters}
        onSearch={handleSearch}
      />
      ;
      <CaseTable data={cases} />;
      <Pagination
        totalPages={5}
        currentPage={1}
        onPageChange={(page) => console.log(page)}
      />
    </main>
  );
}
