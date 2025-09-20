// FILE: apps/web/src/app/api/batches/get-batch-id/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, decodeEventLog, TransactionReceiptNotFoundError } from 'viem';
import { hardhat } from 'viem/chains';
import SupplyChainArtifact from '../../../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '@/lib/deployment.json';

const abi = SupplyChainArtifact.abi;
const contractAddress = deployment.address as `0x${string}`;

// --- CONFIGURATION ---
// Explicitly define the RPC URL for the local Hardhat node.
const hardhatRpcUrl = 'http://127.0.0.1:8545';

// --- VIEM PUBLIC CLIENT ---
// Create a more robust public client with the explicit RPC URL.
const publicClient = createPublicClient({
  chain: hardhat,
  transport: http(hardhatRpcUrl),
  pollingInterval: 1_000, // Poll every second for faster local development feedback
});

/**
 * This is the robust, server-side function to extract the batchId from a transaction hash.
 * It handles the entire process of fetching the receipt and decoding the event logs.
 */
export async function POST(request: NextRequest) {
  const txHash = (await request.json()).txHash as `0x${string}` | undefined;

  if (!txHash) {
    return NextResponse.json({ error: 'Transaction hash (txHash) is required in the request body.' }, { status: 400 });
  }

  console.log(`[API] Received request to find batchId for txHash: ${txHash}`);

  try {
    // --- STEP 1: Fetch the transaction receipt ---
    // This function will wait until the transaction is mined and a receipt is available.
    console.log(`[API] Waiting for transaction receipt...`);
    const transactionReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`[API] Receipt found! Status: ${transactionReceipt.status}`);

    if (transactionReceipt.status === 'reverted') {
      return NextResponse.json({ error: 'The on-chain transaction was reverted.' }, { status: 500 });
    }

    // --- STEP 2: Decode the event logs to find the 'BatchCreated' event ---
    let batchId: string | undefined;
    for (const log of transactionReceipt.logs) {
      // Ensure the log is from our contract
      if (log.address.toLowerCase() === contractAddress.toLowerCase()) {
        try {
          const decodedEvent = decodeEventLog({ abi, data: log.data, topics: log.topics });

          if (decodedEvent.eventName === 'BatchCreated') {
            // Type assertion for safety
            const args = decodedEvent.args as { batchId?: unknown };
            batchId = (args.batchId)?.toString();
            console.log(`[API] Successfully decoded BatchCreated event. Batch ID: ${batchId}`);
            break; // Found it, no need to check other logs
          }
        } catch (e) {
          // This log wasn't the one we're looking for, which is normal. We can ignore it.
          console.warn(`[API] Could not decode a log. This is usually safe to ignore.`);
        }
      }
    }

    // --- STEP 3: Return the result ---
    if (batchId) {
      return NextResponse.json({ batchId });
    } else {
      console.error(`[API] CRITICAL: Could not find 'BatchCreated' event in the logs for txHash: ${txHash}`);
      return NextResponse.json({ error: "Could not extract batch ID from transaction logs. The event might be missing." }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error(`[API] An unexpected error occurred while processing txHash ${txHash}:`, error);

    // Provide specific feedback for common errors
    if (error instanceof TransactionReceiptNotFoundError) {
      return NextResponse.json({ error: 'Transaction receipt could not be found. It may still be pending or it may have been dropped.' }, { status: 404 });
    }

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred on the server.';
    return NextResponse.json({ error: 'Failed to process transaction.', details: errorMessage }, { status: 500 });
  }
}