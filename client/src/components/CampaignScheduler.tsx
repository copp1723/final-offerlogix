import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Repeat, PlayCircle, PauseCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface CampaignSchedulerProps {
  campaignId: string;
  onScheduled?: () => void;
}

export function CampaignScheduler({ campaignId, onScheduled }: CampaignSchedulerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled' | 'recurring'>('immediate');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [recurringPattern, setRecurringPattern] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recurringDays, setRecurringDays] = useState<number[]>([1, 2, 3, 4, 5]); // Weekdays
  const [recurringTime, setRecurringTime] = useState('09:00');

  const weekdays = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
    { value: 0, label: 'Sun' }
  ];

  // Get current schedule
  const { data: schedule, isLoading } = useQuery({
    queryKey: ['/api/campaigns', campaignId, 'schedule'],
  });

  // Schedule campaign mutation
  const scheduleMutation = useMutation({
    mutationFn: async (scheduleData: any) => {
      return apiRequest(`/api/campaigns/${campaignId}/schedule`, 'POST', scheduleData);
    },
    onSuccess: () => {
      toast({
        title: "Campaign Scheduled",
        description: "Your campaign has been scheduled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'schedule'] });
      onScheduled?.();
    },
    onError: (error) => {
      toast({
        title: "Scheduling Failed",
        description: "Failed to schedule campaign. Please try again.",
        variant: "destructive",
      });
      console.error('Schedule error:', error);
    },
  });

  // Cancel schedule mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/campaigns/${campaignId}/schedule`, 'DELETE');
    },
    onSuccess: () => {
      toast({
        title: "Schedule Cancelled",
        description: "Campaign schedule has been cancelled.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'schedule'] });
    },
    onError: (error) => {
      toast({
        title: "Cancellation Failed",
        description: "Failed to cancel schedule. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Execute campaign mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/campaigns/${campaignId}/execute`, 'POST');
    },
    onSuccess: () => {
      toast({
        title: "Campaign Executed",
        description: "Campaign is now running.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'schedule'] });
    },
    onError: (error) => {
      toast({
        title: "Execution Failed",
        description: "Failed to execute campaign. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSchedule = () => {
    const scheduleData: any = {
      scheduleType,
    };

    if (scheduleType === 'scheduled') {
      if (!scheduledDate || !scheduledTime) {
        toast({
          title: "Missing Information",
          description: "Please select both date and time for scheduled campaigns.",
          variant: "destructive",
        });
        return;
      }
      scheduleData.scheduledStart = `${scheduledDate}T${scheduledTime}:00`;
    } else if (scheduleType === 'recurring') {
      scheduleData.recurringPattern = recurringPattern;
      scheduleData.recurringDays = recurringDays;
      scheduleData.recurringTime = `${recurringTime}:00`;
    }

    scheduleMutation.mutate(scheduleData);
  };

  const handleDayToggle = (day: number) => {
    setRecurringDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const getScheduleStatus = () => {
    if (!schedule) return null;

    const statusMap = {
      immediate: { icon: PlayCircle, label: "Running", color: "bg-green-500" },
      scheduled: { icon: Clock, label: "Scheduled", color: "bg-blue-500" },
      recurring: { icon: Repeat, label: "Recurring", color: "bg-purple-500" }
    };

    const status = statusMap[schedule.scheduleType as keyof typeof statusMap];
    if (!status) return null;

    const Icon = status.icon;
    return (
      <Badge className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.label}
      </Badge>
    );
  };

  if (isLoading) {
    return <div className="p-4">Loading schedule...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Campaign Scheduling
          {getScheduleStatus()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedule?.status === 'scheduled' || schedule?.status === 'active' ? (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="space-y-2">
                <div className="text-sm font-medium">Current Schedule:</div>
                <div className="text-sm text-muted-foreground">
                  {schedule.scheduleType === 'immediate' && "Campaign is running immediately"}
                  {schedule.scheduleType === 'scheduled' && schedule.scheduledStart && 
                    `Scheduled for: ${new Date(schedule.scheduledStart).toLocaleString()}`}
                  {schedule.scheduleType === 'recurring' && (
                    <>
                      <div>Pattern: {schedule.recurringPattern}</div>
                      {schedule.recurringDays && schedule.recurringDays.length > 0 && (
                        <div>Days: {schedule.recurringDays.map((d: number) => 
                          weekdays.find(w => w.value === d)?.label
                        ).join(', ')}</div>
                      )}
                      {schedule.recurringTime && <div>Time: {schedule.recurringTime}</div>}
                    </>
                  )}
                </div>
                {schedule.nextExecution && (
                  <div className="text-sm text-muted-foreground">
                    Next execution: {new Date(schedule.nextExecution).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              {schedule.scheduleType === 'immediate' && schedule.status === 'draft' && (
                <Button 
                  onClick={() => executeMutation.mutate()}
                  disabled={executeMutation.isPending}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Execute Now
                </Button>
              )}
              
              {(schedule.scheduleType === 'scheduled' || schedule.scheduleType === 'recurring') && (
                <Button 
                  variant="destructive" 
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                >
                  <PauseCircle className="h-4 w-4 mr-2" />
                  Cancel Schedule
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Schedule Type</Label>
              <Select value={scheduleType} onValueChange={(value: any) => setScheduleType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Run Immediately</SelectItem>
                  <SelectItem value="scheduled">Schedule for Later</SelectItem>
                  <SelectItem value="recurring">Recurring Schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scheduleType === 'scheduled' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            {scheduleType === 'recurring' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={recurringPattern} onValueChange={(value: any) => setRecurringPattern(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {recurringPattern === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Days of Week</Label>
                    <div className="flex gap-2 flex-wrap">
                      {weekdays.map((day) => (
                        <div key={day.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`day-${day.value}`}
                            checked={recurringDays.includes(day.value)}
                            onCheckedChange={() => handleDayToggle(day.value)}
                          />
                          <Label htmlFor={`day-${day.value}`} className="text-sm">
                            {day.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={recurringTime}
                    onChange={(e) => setRecurringTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            <Button 
              onClick={handleSchedule} 
              disabled={scheduleMutation.isPending}
              className="w-full"
            >
              {scheduleType === 'immediate' ? 'Execute Campaign' : 'Schedule Campaign'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}