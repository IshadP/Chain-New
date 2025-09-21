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

    // Get user profile from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, wallet_address')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new NextResponse(JSON.stringify({ 
        error: 'User profile not found. Please complete your profile setup first.'
      }), { status: 404 });
    }

    // Validate user role
    if (!['manufacturer', 'distributor', 'retailer'].includes(profile.role)) {
      return new NextResponse(JSON.stringify({ 
        error: 'Invalid user role'
      }), { status: 403 });
    }

    // Get potential recipients based on user's role
    const recipients = await getPotentialRecipients(userId, profile.role);
    
    return NextResponse.json(recipients);
  } catch (error) {
    console.error("API Error fetching recipients:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
}