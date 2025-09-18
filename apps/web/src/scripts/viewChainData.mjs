// FILE: apps/web/src/scripts/viewOnChainData.mjs

import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains'; // Or your specific chain e.g., sepolia
import * as dotenv from 'dotenv';
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json' with { type: 'json' };
import deployment from '../../lib/deployment.json' with { type: 'json' };

// Load environment variables from .env.local file

// --- CONFIGURATION ---
const  HARDHAT_RPC_URL = "http://127.0.0.1:8545";
const contractAddress = deployment.address;
const contractAbi = SupplyChainArtifact.abi;

// A helper to map the enum status number to a readable string
const getStatusString = (status) => {
  switch (status) {
    case 0: return 'Created';
    case 1: return 'InTransit';
    case 2: return 'Received';
    default: return 'Unknown';
  }
};

// --- SCRIPT LOGIC ---

async function viewAllBatches() {
  if (!HARDHAT_RPC_URL || HARDHAT_RPC_URL === 'http://127.0.0.1:8545') {
    console.error("\n🛑 Error: Please set your RPC_URL in the apps/web/.env.local file.");
    return;
  }

  console.log(`🔗 Connecting to the blockchain...`);

  // 1. Create a client to interact with the blockchain
  const publicClient = createPublicClient({
    chain: mainnet, // Change to your project's chain if not mainnet
    transport: http(RPC_URL),
  });

  console.log(`📄 Reading data from contract at address: ${contractAddress}\n`);

  try {
    // 2. Get the total number of batches from the contract
    const batchCount = await publicClient.readContract({
      address: contractAddress,
      abi: contractAbi,
      functionName: 'getBatchCount',
    });

    const totalBatches = Number(batchCount);
    console.log(`✨ Found a total of ${totalBatches} batch(es) on-chain.\n`);

    if (totalBatches === 0) {
      console.log("No batches have been created yet.");
      return;
    }

    // 3. Loop through and fetch the details for each batch
    for (let i = 1; i <= totalBatches; i++) {
      const batchId = BigInt(i);
      const batchData = await publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'getBatch',
        args: [batchId],
      });

      // 4. Format and display the data
      console.log(`----------------------------------------`);
      console.log(`📦 BATCH DETAILS (ID: ${batchData.batchId})`);
      console.log(`----------------------------------------`);
      console.log(`   - Creator (Manufacturer): ${batchData.creator}`);
      console.log(`   - Current Holder:         ${batchData.currentHolder}`);
      console.log(`   - Quantity:               ${batchData.quantity}`);
      console.log(`   - E-Way Bill No:          "${batchData.ewaybillNo}"`);
      console.log(`   - Status:                 ${getStatusString(batchData.status)} (${batchData.status})`);
      console.log(`   - Created At:             ${new Date(Number(batchData.createdAt) * 1000).toLocaleString()}`);
      console.log(`   - Last Updated At:        ${new Date(Number(batchData.updatedAt) * 1000).toLocaleString()}`);
      console.log(`\n`);
    }

  } catch (error) {
    console.error("\n❌ An error occurred while fetching data from the blockchain:");
    console.error(error.message);
  }
}

// Run the script
viewAllBatches();