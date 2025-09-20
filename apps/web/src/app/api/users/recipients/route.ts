// FILE: apps/web/src/app/api/users/recipients/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuth } from '@clerk/nextjs/server';

/**
 * API endpoint to fetch a list of potential recipients for a batch transfer.
 * It returns all users with the role of 'distributor' or 'retailer'.
 */
export async function GET(req: NextRequest) {
  // Ensure the user making the request is authenticated.
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    
    // Query the profiles table for users who are either a distributor or a retailer.
    const { data: recipients, error } = await supabase
      .from('profiles')
      .select('display_name, wallet_address')
      .in('role', ['distributor', 'retailer']);

    if (error) {
      console.error('Supabase error fetching recipients:', error);
      return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 });
    }

    return NextResponse.json(recipients, { status: 200 });
  } catch (error) {
    console.error('Error in /api/users/recipients:', error);
    return NextResponse.json({ error: 'An unexpected server error occurred' }, { status: 500 });
  }
}