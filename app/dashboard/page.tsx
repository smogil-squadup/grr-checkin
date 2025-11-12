"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Loader2, RefreshCw, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AttendeeResult {
  eventStartTime: string;
  attendeeName: string;
  seatInfo: string | null;
  validatedAt: string | null;
}

export default function Home() {
  const [results, setResults] = useState<AttendeeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

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
      fetchAttendees(date);
    }
  };


  const formatDateTime = (dateString: string | null) => {
    // The timestamp is already formatted in CST on the server side
    if (!dateString) return "-";
    return dateString;
  };

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
            <Popover>
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

      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Event Start Time
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Attendee Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Seat ID
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Validated At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <Loader2 className="animate-spin" size={24} />
                      <span>Loading attendees...</span>
                    </div>
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No attendees found
                  </td>
                </tr>
              ) : (
                results.map((result, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {result.eventStartTime}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {result.attendeeName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {result.seatInfo || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {formatDateTime(result.validatedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {results.length > 0 && (
          <div className="bg-gray-50 px-6 py-3 border-t">
            <p className="text-sm text-gray-600">
              Total: {results.length} attendee{results.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
