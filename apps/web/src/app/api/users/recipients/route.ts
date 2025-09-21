import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPotentialRecipients } from '@/lib/dataservice';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Read the user's role from the request body
    const { userRole } = await request.json();

    if (!userRole) {
      return new NextResponse(JSON.stringify({
        error: 'User role is missing from the request.'
      }), { status: 400 });
    }

    // Validate the provided user role
    if (!['manufacturer', 'distributor', 'retailer'].includes(userRole)) {
      return new NextResponse(JSON.stringify({
        error: 'Invalid user role provided'
      }), { status: 403 });
    }

    // Get potential recipients based on the user's ID and the role from the request
    const recipients = await getPotentialRecipients(userId, userRole);
    
    return NextResponse.json(recipients);
  } catch (error) {
    console.error("API Error fetching recipients:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
}