// FILE: apps/web/src/app/api/history/add/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // <-- CORRECTED: Import the client directly
import { getAuth } from '@clerk/nextjs/server';

/**
 * API endpoint to add a new record to the `batch_history` table.
 * This should be called by the frontend after every successful on-chain transaction.
 */
export async function POST(req: NextRequest) {
  // Ensure the user is authenticated with Clerk before proceeding.
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { batchId, eventType, actorAddress, details } = await req.json();

    // Validate the required fields from the request body.
    if (!batchId || !eventType || !actorAddress) {
      return NextResponse.json({ error: 'Missing required history fields' }, { status: 400 });
    }

    // No need to call getSupabase(), we already have the client instance.
    const { error } = await supabase.from('batch_history').insert([
      {
        batch_id: batchId,
        event_type: eventType,
        actor_address: actorAddress,
        details: details,
      },
    ]);

    if (error) {
      console.error('Supabase history insert error:', error);
      return NextResponse.json({ error: 'Failed to record batch history in database' }, { status: 500 });
    }

    return NextResponse.json({ message: 'History recorded successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error in /api/history/add:', error);
    return NextResponse.json({ error: 'An unexpected server error occurred' }, { status: 500 });
  }
}