import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function ReportsPage() {
  const [, navigate] = useLocation();

  const openLeadsFiltered = (_mode: "followups" | "priority" | "questions") => {
    // Navigate to Leads and rely on client-side filtering UI; minimal and non-breaking
    navigate("/leads");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Clear, actionable summaries. No vanity metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Follow-ups Likely Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-2">Based on recent inbound questions</div>
            <Button variant="outline" size="sm" onClick={() => openLeadsFiltered("followups")}>View leads</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Priority Outreach</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="text-muted-foreground">Leads with recent questions, high engagement, or vehicle interest.</div>
            <Button variant="outline" size="sm" onClick={() => openLeadsFiltered("priority")}>Open list</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Inbound Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="text-muted-foreground">When data is available, you’ll see specific topics here.</div>
            <Button variant="outline" size="sm" onClick={() => openLeadsFiltered("questions")}>See leads</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

