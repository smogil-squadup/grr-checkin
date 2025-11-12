"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Loader2, RefreshCw, CalendarIcon, Users } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

interface AttendeeResult {
  eventStartTime: string;
  attendeeName: string;
  seatInfo: string | null;
  validatedAt: string | null;
}

interface GroupedEvent {
  eventStartTime: string;
  attendees: AttendeeResult[];
}

export default function Home() {
  const [results, setResults] = useState<AttendeeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const fetchAttendees = async (date: Date) => {
    setIsLoading(true);
    setResults([]);

    toast.loading("Loading attendees...", { id: "fetch" });

    try {
      const formattedDate = format(date, "yyyy-MM-dd");
      const response = await fetch(`/api/attendees-list?date=${formattedDate}`);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load attendees");
      }

      setResults(data.results || []);

      toast.dismiss("fetch");
      toast.success(`Loaded ${data.results?.length || 0} attendee(s)`);
    } catch (error) {
      toast.dismiss("fetch");
      toast.error(error instanceof Error ? error.message : "Failed to load attendees");
    } finally {
      setIsLoading(false);
    }
  };

  // Don't fetch on mount - only when user clicks refresh or selects a date

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setCalendarOpen(false); // Close the calendar popover
      fetchAttendees(date);
    }
  };


  const formatDateTime = (dateString: string | null) => {
    // The timestamp is already formatted in CST on the server side
    if (!dateString) return "-";
    return dateString;
  };

  // Group results by event start time
  const groupedEvents: GroupedEvent[] = results.reduce((acc: GroupedEvent[], result) => {
    const existingEvent = acc.find(e => e.eventStartTime === result.eventStartTime);
    if (existingEvent) {
      existingEvent.attendees.push(result);
    } else {
      acc.push({
        eventStartTime: result.eventStartTime,
        attendees: [result],
      });
    }
    return acc;
  }, []);

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <Toaster position="top-right" />

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Attendees List</h1>
            <p className="text-gray-600 mt-2">
              View all attendees with their seat assignments and validation status
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <button
              onClick={() => fetchAttendees(selectedDate)}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw size={20} />
                  Refresh
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white border rounded-lg shadow-sm p-12">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="animate-spin" size={24} />
            <span>Loading attendees...</span>
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white border rounded-lg shadow-sm p-12 text-center text-gray-500">
          No attendees found
        </div>
      ) : (
        <div className="space-y-4">
          <Accordion type="single" collapsible defaultValue="event-0" className="space-y-4">
            {groupedEvents.map((event, eventIdx) => (
              <AccordionItem
                key={eventIdx}
                value={`event-${eventIdx}`}
                className="bg-white border rounded-lg shadow-sm overflow-hidden"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <CalendarIcon className="h-5 w-5 text-blue-600" />
                        {event.eventStartTime}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                      <Users className="h-4 w-4" />
                      {event.attendees.length} {event.attendees.length === 1 ? "attendee" : "attendees"}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-t border-b">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Attendee Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Seat ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Validated At
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {event.attendees.map((attendee, attendeeIdx) => (
                          <tr key={attendeeIdx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {attendee.attendeeName}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {attendee.seatInfo || "-"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {formatDateTime(attendee.validatedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="bg-white border rounded-lg shadow-sm px-6 py-3">
            <p className="text-sm text-gray-600">
              Total: {results.length} attendee{results.length !== 1 ? "s" : ""} across {groupedEvents.length} event{groupedEvents.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
