import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transferBatchOffChain } from '@/lib/dataservice';
import { supabase } from '@/lib/supabase';

// Make sure this is named exactly 'POST' (capital letters)
export async function POST(request: Request) {
  try {
    console.log('🚀 POST request received at /api/inventory/transfer'); // Debug log
    
    const { userId } = await auth();
    if (!userId) {
      console.log('❌ Unauthorized - no userId');
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Get user profile from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, wallet_address')
      .eq('id', userId)
      .single();
      
    console.log('👤 User profile:', profile?.wallet_address);

    if (profileError || !profile) {
      console.log('❌ Profile error:', profileError?.message);
      return new NextResponse(JSON.stringify({ 
        error: 'User profile not found. Please complete your profile setup first.',
        debug: { profileError: profileError?.message }
      }), { status: 404 });
    }

    if (!profile.wallet_address) {
      console.log('❌ No wallet address');
      return new NextResponse(JSON.stringify({ 
        error: 'Wallet address not found. Please connect your wallet first.'
      }), { status: 403 });
    }

    const { batchId, recipientWallet } = await request.json();
    console.log('📦 Transfer request:', { batchId, recipientWallet });
    
    if (!batchId || !recipientWallet) {
      console.log('❌ Missing data');
      return new NextResponse(JSON.stringify({ 
        error: 'Missing batchId or recipientWallet' 
      }), { status: 400 });
    }

    // Use the enhanced transferBatchOffChain with sender wallet validation
    const updatedBatch = await transferBatchOffChain(
      batchId, 
      recipientWallet, 
      profile.wallet_address  // Pass sender wallet for validation
    );
    
    console.log('✅ Transfer successful');
    return NextResponse.json(updatedBatch);
  } catch (error) {
    console.error("❌ API Error transferring batch:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    let statusCode = 500;
    if (errorMessage.includes('Transfer validation failed')) {
      statusCode = 400;
    } else if (errorMessage.includes('not the current holder')) {
      statusCode = 403;
    }
    
    return new NextResponse(JSON.stringify({ error: errorMessage }), { status: statusCode });
  }
}

// Handle GET requests (when someone visits the URL in browser)
export async function GET() {
  return new NextResponse(JSON.stringify({ 
    message: 'Transfer API endpoint', 
    method: 'POST',
    description: 'This endpoint accepts POST requests for batch transfers'
  }), { 
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}