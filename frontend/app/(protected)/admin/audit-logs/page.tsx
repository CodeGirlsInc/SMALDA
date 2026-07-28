import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

// Define the type for the audit log data
interface AuditLog {
  id: string;
  ip_address: string;
  timestamp: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  status_code: number;
  user_agent: string;
}

async function getAuditLogs(): Promise<AuditLog[]> {
  // This is a server component, so we can fetch data directly.
  // In a real app, you'd fetch from your API endpoint.
  // For this example, we'll use mock data.
  try {
    // const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/audit`);
    // if (!res.ok) {
    //   throw new Error('Failed to fetch audit logs');
    // }
    // const data = await res.json();
    // return data;

    // Mock data for demonstration
    const mockData: AuditLog[] = [
      { id: '1', ip_address: '192.168.1.1', timestamp: new Date().toISOString(), method: 'GET', path: '/api/users', status_code: 200, user_agent: 'Mozilla/5.0' },
      { id: '2', ip_address: '10.0.0.1', timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(), method: 'POST', path: '/api/auth/login', status_code: 200, user_agent: 'Chrome/91.0' },
      { id: '3', ip_address: '172.16.0.1', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), method: 'GET', path: '/api/files/123', status_code: 404, user_agent: 'curl/7.64.1' },
      { id: '4', ip_address: '192.168.1.2', timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(), method: 'DELETE', path: '/api/files/456', status_code: 204, user_agent: 'Mozilla/5.0' },
    ];
    return mockData;
  } catch (error) {
    console.error(error);
    return [];
  }
}

export default async function AdminAuditLogsPage() {
  const auditLogs = await getAuditLogs();

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-4">HTTP Access Logs</h1>
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>
            A record of all HTTP requests made to the server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP Address</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>User Agent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.ip_address}</TableCell>
                  <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{log.method}</TableCell>
                  <TableCell>{log.path}</TableCell>
                  <TableCell>{log.status_code}</TableCell>
                  <TableCell>{log.user_agent}</TableCell>
                </TableRow>
              ))}
              {auditLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No audit logs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}