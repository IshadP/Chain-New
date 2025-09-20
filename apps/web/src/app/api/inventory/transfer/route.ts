// FILE: apps/web/src/app/api/inventory/transfer/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transferBatchOffChain } from '@/lib/dataservice';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { batchId, recipientWallet } = await request.json();
    if (!batchId || !recipientWallet) {
        return new NextResponse(JSON.stringify({ error: 'Missing batchId or recipientWallet' }), { status: 400 });
    }

    const updatedBatch = await transferBatchOffChain(batchId, recipientWallet);
    return NextResponse.json(updatedBatch);
  } catch (error) {
    console.error("API Error transferring batch:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
}