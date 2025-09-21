// FILE: apps/web/src/app/api/inventory/receive/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { receiveBatchOffChain } from '@/lib/dataservice';

export async function POST(request: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const receiverWallet = sessionClaims?.publicMetadata?.wallet_address as string;
    if(!receiverWallet) {
        return new NextResponse(JSON.stringify({ error: 'Wallet address not found for user' }), { status: 400 });
    }

    const { batchId } = await request.json();
    if (!batchId) {
        return new NextResponse(JSON.stringify({ error: 'Missing batchId' }), { status: 400 });
    }

    const updatedBatch = await receiveBatchOffChain(batchId, receiverWallet);
    return NextResponse.json(updatedBatch);
  } catch (error) {
    console.error("API Error receiving batch:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
}