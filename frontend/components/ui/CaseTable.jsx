export default function CaseTable({ data }) {
  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Case Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Region
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Year
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Outcome
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item) => (
            <tr key={item.id}>
              <td className="px-6 py-4 whitespace-nowrap">{item.title}</td>
              <td className="px-6 py-4 whitespace-nowrap">{item.region}</td>
              <td className="px-6 py-4 whitespace-nowrap">{item.year}</td>
              <td className="px-6 py-4 whitespace-nowrap">{item.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
