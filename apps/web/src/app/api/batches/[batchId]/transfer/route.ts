import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getContractInstance, Role } from '@/lib/blockchain';
import { ethers } from 'ethers';

// This is the function handler for POST requests
export async function POST(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    // 1. Authenticate the user and get their ID
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify the user has the 'manufacturer' role
    const client = await clerkClient();
const user = await client.users.getUser(userId);
const userRole = user.publicMetadata?.role as string;

    if (userRole !== 'manufacturer') {
      return NextResponse.json(
        { error: 'Access Denied: Only manufacturers can transfer batches.' },
        { status: 403 }
      );
    }

    // 3. Get data from the request
    const { batchId } = await params;
    const body = await request.json();
    const { newHolderAddress, newLocation } = body;

    // 4. Validate the incoming data
    if (!newHolderAddress || !newLocation) {
      return NextResponse.json(
        { error: 'Missing required fields: newHolderAddress and newLocation are required' },
        { status: 400 }
      );
    }
    if (!ethers.isAddress(newHolderAddress)) {
        return NextResponse.json(
          { error: 'Invalid Ethereum address for the new holder.' },
          { status: 400 }
        );
    }

    console.log(`Transferring batch ${batchId} by user ${userId} (Role: ${userRole})`);

    // 5. Interact with the smart contract
    const contract = await getContractInstance(userRole as Role);

    // ✅ FIX: The function name is now corrected to match your Solidity contract
    const tx = await contract.transferBatchOwnership(
      batchId, 
      newHolderAddress, 
      newLocation
    );
    
    await tx.wait();

    console.log(`Transaction successful: ${tx.hash}`);

    // 6. Return a success response
    return NextResponse.json({
      success: true,
      message: 'Batch transferred successfully',
      transactionHash: tx.hash,
    });

  } catch (error) {
    console.error('Transfer failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to transfer batch', details: errorMessage },
      { status: 500 }
    );
  }
}