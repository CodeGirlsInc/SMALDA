import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CircleUser } from "lucide-react";

// Define the type for the activity data
interface Activity {
  id: string;
  user_email: string;
  action: string;
  created_at: string;
}

async function getActivity(): Promise<Activity[]> {
  // This is a server component, so we can fetch data directly.
  // In a real app, you'd fetch from your API endpoint.
  // The URL should be absolute, e.g., process.env.API_URL.
  // For this example, we'll use mock data.
  try {
    // const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/activity`);
    // if (!res.ok) {
    //   throw new Error('Failed to fetch activity data');
    // }
    // const data = await res.json();
    // return data;

    // Mock data for demonstration
    const mockData: Activity[] = [
      { id: '1', user_email: 'admin@example.com', action: 'User login', created_at: new Date().toISOString() },
      { id: '2', user_email: 'test@example.com', action: 'File upload: "document.pdf"', created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
      { id: '3', user_email: 'admin@example.com', action: 'File delete: "image.jpg"', created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString() },
      { id: '4', user_email: 'guest@example.com', action: 'Viewed page: "Dashboard"', created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
    ];
    return mockData;
  } catch (error) {
    console.error(error);
    return [];
  }
}

export default async function AdminActivityPage() {
  const activities = await getActivity();

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-4">User Activity Timeline</h1>
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
          <CardDescription>
            An overview of recent user actions on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative pl-6">
            {/* The timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
            
            {activities.map((activity, index) => (
              <div key={activity.id} className="mb-8 pl-8 relative">
                {/* The timeline dot */}
                <div className="absolute left-[-4px] top-1 w-4 h-4 bg-blue-500 rounded-full border-4 border-white"></div>
                
                <div className="flex items-center mb-1">
                  <CircleUser className="w-5 h-5 mr-2" />
                  <p className="font-semibold">{activity.user_email}</p>
                </div>
                <p className="text-sm text-gray-600">{activity.action}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(activity.created_at).toLocaleString()}
                </p>
              </div>
            ))}
            {activities.length === 0 && (
              <p>No recent activity.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}