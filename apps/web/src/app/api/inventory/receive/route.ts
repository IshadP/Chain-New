// FILE: apps/web/src/app/api/inventory/receive/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { receiveBatchOffChain } from '@/lib/dataservice'; // Assumes you have this function

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { batchId } = await request.json();
    if (!batchId) {
        return new NextResponse(JSON.stringify({ error: 'Missing batchId' }), { status: 400 });
    }

    // Call the simplified off-chain function
    const updatedBatch = await receiveBatchOffChain(batchId);
    return NextResponse.json(updatedBatch);
  } catch (error) {
    console.error("API Error receiving batch:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
}