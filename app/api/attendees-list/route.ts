import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get("date");

    console.log("=".repeat(50));
    console.log("API CALL RECEIVED - Fetching attendees list for host user:", HOST_USER_ID);
    console.log("Date filter:", dateParam);
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

    // Step 2: Get all POLAR EXPRESS events (exclude parking) for the selected date
    // Using EXISTS instead of JOIN+COUNT for much better performance
    console.log("Step 2: Finding POLAR EXPRESS events with attendees...");
    const eventQuery = `
      SELECT
        e.id,
        e.name,
        e.start_at,
        to_char((e.start_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Chicago', 'MM/DD/YYYY, HH12:MI AM') as start_at_formatted
      FROM events e
      WHERE e.user_id = $1
        AND UPPER(e.name) LIKE '%POLAR EXPRESS%'
        AND UPPER(e.name) NOT LIKE '%PARKING%'
        AND EXISTS (SELECT 1 FROM event_attendees ea WHERE ea.event_id = e.id AND ea.deleted_at IS NULL)
        ${dateParam ? "AND ((e.start_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Chicago')::date = $2::date" : ""}
      ORDER BY e.start_at DESC
    `;

    const eventParams = dateParam ? [HOST_USER_ID, dateParam] : [HOST_USER_ID];
    const eventResult = await query<{ id: number; name: string; start_at: string; start_at_formatted: string }>(eventQuery, eventParams);
    if (eventResult.length === 0) {
      console.log("No POLAR EXPRESS events with attendees found for this host");
      return NextResponse.json({ results: [], metadata: { hostUserId: HOST_USER_ID, total: 0 } });
    }

    const eventIds = eventResult.map(e => e.id);
    console.log(`Step 2 COMPLETE - Found ${eventResult.length} POLAR EXPRESS event(s)`);
    eventResult.forEach(e => {
      console.log(`  - Event ${e.id}: "${e.name}"`);
    });

    // Step 3: Combine attendees and seats in a SINGLE query with JOIN
    // This is much faster than two separate queries
    console.log(`Step 3: Getting attendees and seats from ${eventIds.length} event(s) in one query...`);
    const startTime = Date.now();

    const combinedQuery = `
      SELECT
        ea.id as attendee_id,
        ea.first_name,
        ea.last_name,
        ea.event_id,
        ag.seat_id,
        ag.seat_obj,
        to_char((ag.checkin_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/Chicago', 'MM/DD/YYYY, HH12:MI:SS AM') as checkin_timestamp
      FROM event_attendees ea
      LEFT JOIN attendee_guests ag ON ag.event_attendee_id = ea.id
      WHERE ea.event_id = ANY($1)
        AND ea.deleted_at IS NULL
      ORDER BY ea.event_id DESC, ea.id DESC, ag.id
      LIMIT 10000
    `;

    const combinedResults = await query<{
      attendee_id: number;
      first_name: string | null;
      last_name: string | null;
      event_id: number;
      seat_id: string | null;
      seat_obj: AttendeeRow['seat_obj'];
      checkin_timestamp: string | null;
    }>(combinedQuery, [eventIds]);

    const duration = Date.now() - startTime;
    console.log(`Step 3 COMPLETE in ${duration}ms. Found ${combinedResults.length} combined records`);

    if (combinedResults.length === 0) {
      return NextResponse.json({ results: [], metadata: { hostUserId: HOST_USER_ID, total: 0 } });
    }

    // Log sample data
    if (combinedResults.length > 0) {
      console.log("Sample combined data:", JSON.stringify(combinedResults[0], null, 2));
    }

    // Transform the combined results directly - they already have seats joined
    const results: Array<{
      first_name: string | null;
      last_name: string | null;
      event_id: number;
      event_start_at_formatted: string;
      seat_id: string | null;
      seat_obj: AttendeeRow['seat_obj'];
      checkin_timestamp: string | null;
    }> = combinedResults.map(row => {
      const eventInfo = eventResult.find(e => e.id === row.event_id);
      return {
        first_name: row.first_name,
        last_name: row.last_name,
        event_id: row.event_id,
        event_start_at_formatted: eventInfo?.start_at_formatted || '-',
        seat_id: row.seat_id,
        seat_obj: row.seat_obj,
        checkin_timestamp: row.checkin_timestamp,
      };
    });

    console.log(`\nTransformed ${results.length} total rows`);
    console.log('First 3 results:');
    results.slice(0, 3).forEach((r, idx) => {
      console.log(`  Row ${idx + 1}: name="${r.first_name} ${r.last_name}", seat_id="${r.seat_id}"`);
    });

    // Transform results to extract seat info from seat_id (preferred format)
    const transformedResults = results.map((row) => {
      let seatInfo: string | null = null;

      // Use seat_id as the primary format (e.g., "CAR 4-Seat 25")
      if (row.seat_id) {
        seatInfo = row.seat_id;
      }
      // Fallback to seat_obj.components only if seat_id is not available
      else if (
        row.seat_obj?.components &&
        Array.isArray(row.seat_obj.components) &&
        row.seat_obj.components.length > 0
      ) {
        seatInfo = row.seat_obj.components
          .map((comp) => `${comp.label}: ${comp.value}`)
          .join(", ");
      }

      // Construct attendee name from first_name and last_name
      const attendeeName = row.first_name && row.last_name
        ? `${row.first_name} ${row.last_name}`
        : row.first_name || row.last_name || "Unknown";

      // Event start time is already formatted by PostgreSQL with timezone conversion
      const eventStartTime = row.event_start_at_formatted || "-";

      // Timestamp is already formatted as a string by PostgreSQL
      return {
        eventStartTime: eventStartTime,
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
