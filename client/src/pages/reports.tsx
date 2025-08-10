import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Clear, actionable summaries. No vanity metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Follow-ups Due Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <div className="text-xs text-muted-foreground">Based on conversation commitments</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Priority Call List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>No priority calls yet.</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Campaign Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>When data is available, you'll see specific insights here.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

