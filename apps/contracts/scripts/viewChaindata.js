const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Utility to map the Status enum (0, 1, 2) to readable strings
const STATUS_MAP = ["Created", "InTransit", "Received"];

async function main() {
  // Resolve the path to the deployment file relative to where this script is located
  const deploymentPath = path.resolve(
    __dirname, 
    "../deployments/latest.json"
  );

  if (!fs.existsSync(deploymentPath)) {
    console.error("Error: Deployment file not found at " + deploymentPath);
    console.error("Please ensure you have run the deployment script first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const contractAddress = deployment.contractAddress;

  // Get signers to check their roles (Hardhat's default accounts)
  const [manufacturer, distributor, retailer] = await ethers.getSigners();
  const SupplyChain = await ethers.getContractFactory("SupplyChain");
  const supplyChain = SupplyChain.attach(contractAddress);

  console.log("=========================================");
  console.log("🔗 Supply Chain Data Viewer");
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Network: ${deployment.network} (Chain ID: ${deployment.chainId})`);
  console.log("=========================================");
  
  // --- 1. Fetch Role Information ---
  console.log("\n👤 Role Information:");
  const addressesToCheck = [
    { name: "Deployer (Manufacturer)", address: manufacturer.address },
    { name: "Distributor", address: distributor.address },
    { name: "Retailer", address: retailer.address },
  ];
  
  for (const { name, address } of addressesToCheck) {
    const isM = await supplyChain.isManufacturer(address); // Check Manufacturer role
    const isD = await supplyChain.isDistributor(address); // Check Distributor role
    const isR = await supplyChain.isRetailer(address);     // Check Retailer role
    
    const roles = [];
    if (isM) roles.push("Manufacturer");
    if (isD) roles.push("Distributor");
    if (isR) roles.push("Retailer");
    
    console.log(`- ${name} (${address}): ${roles.join(', ') || 'No Role'}`);
  }


  // --- 2. Fetch All Batches by Event ---
  console.log("\n📦 All Batches (Fetched via 'BatchCreated' events):");
  
  try {
    // Create a filter for the BatchCreated event
    const filter = supplyChain.filters.BatchCreated();
    // Query all events from the beginning of the chain (block 0)
    const events = await supplyChain.queryFilter(filter, 0); 
    
    const batchIds = events.map(event => event.args.batchId);
    
    if (batchIds.length === 0) {
      console.log("No batches found. Ensure your 'createBatch' transactions were successful.");
    } else {
      console.log(`Found ${batchIds.length} batches.`);
      
      for (const batchId of batchIds) {
        // Call the view function to get full batch details
        const batch = await supplyChain.getBatch(batchId);
        
        console.log("-----------------------------------------");
        console.log(`Batch ID:      ${batch.batchId}`);
        console.log(`Creator:       ${batch.creator}`);
        console.log(`Current Holder: ${batch.currentHolder}`);
        console.log(`Quantity:      ${batch.quantity.toString()}`);
        console.log(`E-way Bill:    ${batch.ewaybillNo}`);
        console.log(`Cost:          ${batch.cost.toString()}`);
        console.log(`Location:      ${batch.currentLocation}`);
        // Convert the numeric status (0, 1, 2) to a readable string
        console.log(`Status:        ${STATUS_MAP[batch.status]}`); 
        console.log(`Created At:    ${new Date(Number(batch.createdAt) * 1000).toLocaleString()}`);
      }
      console.log("-----------------------------------------");
    }

  } catch (error) {
    console.error("\n❌ Error fetching batch data. This might be due to a faulty batch ID or a contract revert (e.g., a batch ID was logged but a subsequent state change made the batch invalid).");
    console.error("Detailed Error:", error.message);
  }

  console.log("\nChain data viewing completed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});