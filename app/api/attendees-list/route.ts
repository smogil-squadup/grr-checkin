import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const HOST_USER_ID = 9835080;

interface AttendeeRow {
  attendee_name: string | null;
  seat_id: string | null;
  seat_obj: {
    components?: Array<{
      key: string;
      label: string;
      value: string;
    }>;
  } | null;
  checkin_timestamp: string | null;
}

export async function GET() {
  try {
    console.log("=".repeat(50));
    console.log("API CALL RECEIVED - Fetching attendees list for host user:", HOST_USER_ID);
    console.log("=".repeat(50));

    // ULTRA SIMPLE TEST: Just get a count of events for this host
    console.log("Step 1: Testing basic event count...");
    const testStart = Date.now();

    const testQuery = `
      SELECT COUNT(*) as event_count
      FROM events e
      WHERE e.user_id = $1
      LIMIT 1
    `;

    try {
      const testResult = await query<{ event_count: number }>(testQuery, [HOST_USER_ID]);
      console.log(`Step 1 COMPLETE in ${Date.now() - testStart}ms - Event count:`, testResult[0]?.event_count);
    } catch (err) {
      console.error("Step 1 FAILED:", err);
      throw err;
    }

    // Step 2: Get all POLAR EXPRESS events (exclude parking)
    console.log("Step 2: Finding POLAR EXPRESS events with attendees...");
    const eventQuery = `
      SELECT DISTINCT e.id, e.name, e.start_at, COUNT(ea.id) as attendee_count
      FROM events e
      INNER JOIN event_attendees ea ON ea.event_id = e.id
      WHERE e.user_id = $1
        AND ea.deleted_at IS NULL
        AND UPPER(e.name) LIKE '%POLAR EXPRESS%'
        AND UPPER(e.name) NOT LIKE '%PARKING%'
      GROUP BY e.id, e.name, e.start_at
      HAVING COUNT(ea.id) > 0
      ORDER BY e.start_at DESC
    `;

    const eventResult = await query<{ id: number; name: string; start_at: string; attendee_count: number }>(eventQuery, [HOST_USER_ID]);
    if (eventResult.length === 0) {
      console.log("No POLAR EXPRESS events with attendees found for this host");
      return NextResponse.json({ results: [], metadata: { hostUserId: HOST_USER_ID, total: 0 } });
    }

    const eventIds = eventResult.map(e => e.id);
    const totalAttendees = eventResult.reduce((sum, e) => sum + e.attendee_count, 0);
    console.log(`Step 2 COMPLETE - Found ${eventResult.length} POLAR EXPRESS event(s) with ${totalAttendees} total attendees`);
    eventResult.forEach(e => {
      console.log(`  - Event ${e.id}: "${e.name}" (${e.attendee_count} attendees)`);
    });

    // Step 3: Get attendees from ALL matching events
    const queryText = `
      SELECT
        ea.id,
        ea.first_name,
        ea.last_name,
        ea.event_id
      FROM event_attendees ea
      WHERE ea.event_id = ANY($1)
        AND ea.deleted_at IS NULL
      ORDER BY ea.event_id DESC, ea.id DESC
      LIMIT 10000
    `;

    console.log(`Step 3: Getting attendees from ${eventIds.length} event(s)...`);
    const startTime = Date.now();
    const attendeeResults = await query<{
      id: number;
      first_name: string | null;
      last_name: string | null;
      event_id: number;
    }>(queryText, [eventIds]);
    const duration = Date.now() - startTime;
    console.log(`Step 3 COMPLETE in ${duration}ms. Found ${attendeeResults.length} attendee records`);

    // Step 4: Now get seat info for just these attendees
    if (attendeeResults.length === 0) {
      return NextResponse.json({ results: [], metadata: { hostUserId: HOST_USER_ID, total: 0 } });
    }

    const attendeeIds = attendeeResults.map(a => a.id);
    console.log(`Step 4: Getting seat info for ${attendeeIds.length} attendees...`);

    const seatQuery = `
      SELECT
        ag.event_attendee_id,
        ag.seat_id,
        ag.seat_obj,
        ag.checkin_timestamp
      FROM attendee_guests ag
      WHERE ag.event_attendee_id = ANY($1)
      LIMIT 100
    `;

    const seatStart = Date.now();
    const seatResults = await query<{
      event_attendee_id: number;
      seat_id: string | null;
      seat_obj: AttendeeRow['seat_obj'];
      checkin_timestamp: string | null;
    }>(seatQuery, [attendeeIds]);
    console.log(`Step 4 COMPLETE in ${Date.now() - seatStart}ms. Found ${seatResults.length} seat records`);

    // Log first seat to see structure
    if (seatResults.length > 0) {
      console.log("Sample seat data:", JSON.stringify(seatResults[0], null, 2));
    }

    // Log all attendees to see what we're working with
    console.log(`\nAttendee breakdown:`);
    for (const attendee of attendeeResults) {
      const seats = seatResults.filter(s => s.event_attendee_id === attendee.id);
      console.log(`  - Attendee ${attendee.id} (${attendee.first_name} ${attendee.last_name}): ${seats.length} seat(s)`);
      seats.forEach((seat, idx) => {
        console.log(`    Seat ${idx + 1}: seat_id="${seat.seat_id}", has seat_obj: ${!!seat.seat_obj}`);
      });
    }

    // Combine the results - CREATE ONE ROW PER SEAT (not per attendee)
    const results: Array<{
      first_name: string | null;
      last_name: string | null;
      seat_id: string | null;
      seat_obj: AttendeeRow['seat_obj'];
      checkin_timestamp: string | null;
    }> = [];

    for (const attendee of attendeeResults) {
      const seats = seatResults.filter(s => s.event_attendee_id === attendee.id);

      if (seats.length === 0) {
        // Attendee has no seats, show them with null seat info
        results.push({
          first_name: attendee.first_name,
          last_name: attendee.last_name,
          seat_id: null,
          seat_obj: null,
          checkin_timestamp: null,
        });
      } else {
        // Create one row per seat
        for (const seat of seats) {
          results.push({
            first_name: attendee.first_name,
            last_name: attendee.last_name,
            seat_id: seat.seat_id,
            seat_obj: seat.seat_obj,
            checkin_timestamp: seat.checkin_timestamp,
          });
        }
      }
    }

    console.log(`\nCombined ${results.length} total rows (attendees × seats)`);
    console.log('First 3 combined results:');
    results.slice(0, 3).forEach((r, idx) => {
      console.log(`  Row ${idx + 1}: name="${r.first_name} ${r.last_name}", seat_id="${r.seat_id}"`);
    });

    // Transform results to extract seat info from seat_obj if available
    const transformedResults = results.map((row) => {
      let seatInfo: string | null = null;

      // Try to extract from seat_obj.components first
      if (
        row.seat_obj?.components &&
        Array.isArray(row.seat_obj.components) &&
        row.seat_obj.components.length > 0
      ) {
        seatInfo = row.seat_obj.components
          .map((comp) => `${comp.label}: ${comp.value}`)
          .join(", ");
      }
      // Fallback to seat_id if seat_obj is empty or null
      else if (row.seat_id) {
        seatInfo = row.seat_id;
      }

      // Construct attendee name from first_name and last_name
      const attendeeName = row.first_name && row.last_name
        ? `${row.first_name} ${row.last_name}`
        : row.first_name || row.last_name || "Unknown";

      return {
        attendeeName: attendeeName,
        seatInfo: seatInfo,
        validatedAt: row.checkin_timestamp,
      };
    });

    return NextResponse.json({
      results: transformedResults,
      metadata: {
        hostUserId: HOST_USER_ID,
        total: transformedResults.length,
      },
    });
  } catch (error) {
    console.error("Attendees list error details:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    // Check if it's a connection error
    if (error instanceof Error && error.message.includes("connect")) {
      return NextResponse.json(
        {
          error:
            "Database connection failed. Please check your credentials and try again.",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch attendees list",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : "Unknown error"
            : undefined,
      },
      { status: 500 }
    );
  }
}
