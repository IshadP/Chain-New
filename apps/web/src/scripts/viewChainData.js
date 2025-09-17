/**
 * A command-line script to query and display all data from the SupplyChain smart contract.
 * This is a plain JavaScript version.
 *
 * How to run:
 * 1. Make sure your .env.local file is correctly set up.
 * 2. Run the command from your project's root:
 * node scripts/viewChainData.js
 */

// Import necessary libraries
const { ethers } = require('ethers');
const path = require('path');
const dotenv = require('dotenv');
const SupplyChainABI = require('../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json');

// --- Configuration ---

// Load environment variables from the .env.local file
dotenv.config({ path: path.resolve(__dirname, '../..', '.env.local') });

const {
  NEXT_PUBLIC_CONTRACT_ADDRESS: contractAddress,
  NEXT_PUBLIC_RPC_URL: rpcUrl,
} = process.env;

// --- Main Script Logic ---

async function main() {
  console.log('🔗 Connecting to the blockchain...');

  // 1. Validate environment variables
  if (!contractAddress || !rpcUrl) {
    console.error(
      '❌ Error: Missing NEXT_PUBLIC_CONTRACT_ADDRESS or NEXT_PUBLIC_RPC_URL in your .env.local file.'
    );
    process.exit(1);
  }

  try {
    // 2. Set up provider and contract instance
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(
      contractAddress,
      SupplyChainABI.abi,
      provider
    );

    console.log(`✅ Connected to contract at: ${await contract.getAddress()}`);
    console.log('---');

    // 3. Fetch and display general contract information
    console.log('📋 Fetching contract-level data...');
    const [manufacturer, distributor, retailer, batchCount] = await Promise.all([
      contract.manufacturer(),
      contract.distributor(),
      contract.retailer(),
      contract.getBatchCount(),
    ]);

    console.log('--- Contract Info ---');
    console.log(`  🏢 Manufacturer: ${manufacturer}`);
    console.log(`  🚚 Distributor:  ${distributor}`);
    console.log(`  🏪 Retailer:     ${retailer}`);
    console.log(`  📦 Total Batches:  ${batchCount.toString()}`);
    console.log('---------------------\n');

    if (Number(batchCount) === 0) {
      console.log('ℹ️ No batches found on the contract.');
      return;
    }

    // 4. Fetch all batch IDs
    console.log('🔍 Fetching all batch IDs...');
    const allBatchIds = await contract.getAllBatchIds();
    console.log(`Found ${allBatchIds.length} batch ID(s).\n`);

    // 5. Fetch and display details for each batch
    for (let i = 0; i < allBatchIds.length; i++) {
      const batchId = allBatchIds[i];
      console.log(`--- 📦 Batch Details (${i + 1} of ${allBatchIds.length}) ---`);
      
      const batch = await contract.getBatch(batchId);

      console.log(`  Batch ID:          ${batch.batchId}`);
      console.log(`  Internal Name:     ${batch.internalBatchName}`);
      console.log(`  User ID (Creator): ${batch.userId}`);
      console.log(`  Quantity:          ${Number(batch.quantity)}`);
      console.log(`  Status:            ${batch.status}`);
      console.log(`  Current Location:  ${batch.currentLocation}`);
      console.log(`  Current Holder:    ${batch.currentHolder}`);
      
      // Convert timestamp to a readable date
      const manufacturingDate = new Date(Number(batch.manufacturingDate) * 1000);
      console.log(`  Manufactured On:   ${manufacturingDate.toLocaleString()}`);
      console.log('-------------------------------------\n');
    }

    console.log('✅ Query complete.');

  } catch (error) {
    console.error('\nAn unexpected error occurred:');
    console.error(error);
    process.exit(1);
  }
}

main();