import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { receiveBatchOffChain } from '@/lib/dataservice';
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
        error: 'User profile not found. Please complete your profile setup first.',
        debug: { profileError: profileError?.message }
      }), { status: 404 });
    }

    if (!profile.wallet_address) {
      return new NextResponse(JSON.stringify({ 
        error: 'Wallet address not found. Please connect your wallet first.'
      }), { status: 403 });
    }

    // Validate user has a valid role for receiving
    if (!['manufacturer', 'distributor', 'retailer'].includes(profile.role)) {
      return new NextResponse(JSON.stringify({ 
        error: 'Invalid user role for receiving batches'
      }), { status: 403 });
    }

    const { batchId } = await request.json();
    if (!batchId) {
      return new NextResponse(JSON.stringify({ 
        error: 'Missing batchId' 
      }), { status: 400 });
    }

    // Use the enhanced receiveBatchOffChain with additional validation
    const updatedBatch = await receiveBatchOffChain(batchId, profile.wallet_address);
    
    return NextResponse.json(updatedBatch);
  } catch (error) {
    console.error("API Error receiving batch:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    let statusCode = 500;
    if (errorMessage.includes('not the intended recipient')) {
      statusCode = 403;
    } else if (errorMessage.includes('No batch found')) {
      statusCode = 404;
    }
    
    return new NextResponse(JSON.stringify({ error: errorMessage }), { status: statusCode });
  }
}