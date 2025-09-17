// FILE: apps/web/src/app/api/users/all/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

/**
 * API endpoint for the manufacturer (admin) to fetch all distributor and retailer profiles.
 * This data will be used to display in the admin panel for granting on-chain roles.
 */
export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = getAuth(req);

  // Protect the route: only authenticated manufacturers can access it.
  if (!userId || sessionClaims?.metadata?.role !== 'manufacturer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // We only need to fetch profiles, not inventory or history.
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, role, wallet_address, display_name');

    if (error) {
      console.error('Supabase error fetching profiles:', error);
      return NextResponse.json({ error: 'Failed to fetch user profiles' }, { status: 500 });
    }

    return NextResponse.json(profiles, { status: 200 });
  } catch (error) {
    console.error('Error in /api/users/all:', error);
    return NextResponse.json({ error: 'An unexpected server error occurred' }, { status: 500 });
  }
}