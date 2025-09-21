const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

// Helper to convert string to bytes16
function toBytes16(text) {
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length > 16) {
    throw new Error('Input string is too long for bytes16');
  }
  const padded = Buffer.concat([bytes], 16);
  return '0x' + padded.toString('hex');
}

async function main() {
  console.log("🌱 Starting blockchain seeding...");

  // Get signers
  const [manufacturer, distributor, retailer, otherAccount] = await hre.ethers.getSigners();
  console.log("Accounts loaded:");
  console.log("  - Manufacturer (Deployer):", manufacturer.address);
  console.log("  - Distributor:", distributor.address);
  console.log("  - Retailer:", retailer.address);
  console.log("  - Other Account:", otherAccount.address);
  console.log("----------------------------------------------------");


  // Deploy the contract
  console.log("Deploying SupplyChain contract with Manufacturer as deployer...");
  const SupplyChain = await hre.ethers.getContractFactory("SupplyChain");
  const supplyChain = await SupplyChain.deploy();
  await supplyChain.waitForDeployment();
  const contractAddress = await supplyChain.getAddress();
  console.log(`✅ SupplyChain contract deployed to: ${contractAddress}`);
  console.log("----------------------------------------------------");

  // Grant on-chain roles
  console.log("Granting on-chain roles...");
  const tx1 = await supplyChain.connect(manufacturer).grantDistributorRole(distributor.address);
  await tx1.wait();
  console.log(`  - Granted Distributor role to: ${distributor.address}`);

  const tx2 = await supplyChain.connect(manufacturer).grantRetailerRole(retailer.address);
  await tx2.wait();
  console.log(`  - Granted Retailer role to: ${retailer.address}`);
  console.log("----------------------------------------------------");


  // Create some initial batches
  console.log("Creating initial batches...");
  const batchId1 = toBytes16("PROD-ABC-123");
  const tx3 = await supplyChain.connect(manufacturer).createBatch(batchId1, "EW-12345", "Mumbai Warehouse");
  await tx3.wait();
  console.log(`  - Created Batch 1 with ID: ${batchId1}`);

  const batchId2 = toBytes16("PROD-XYZ-789");
  const tx4 = await supplyChain.connect(manufacturer).createBatch(batchId2, "EW-67890", "Mumbai Warehouse");
  await tx4.wait();
  console.log(`  - Created Batch 2 with ID: ${batchId2}`);
  console.log("----------------------------------------------------");

  // Verify on-chain data
  console.log("Verifying on-chain data...");
  const isManuf = await supplyChain.isManufacturer(manufacturer.address);
  const isDist = await supplyChain.isDistributor(distributor.address);
  const isRet = await supplyChain.isRetailer(retailer.address);
  const batch1 = await supplyChain.getBatch(batchId1);

  console.log(`  - Is ${manufacturer.address} a manufacturer? ${isManuf}`);
  console.log(`  - Is ${distributor.address} a distributor? ${isDist}`);
  console.log(`  - Is ${retailer.address} a retailer? ${isRet}`);
  console.log(`  - Batch 1 current holder: ${batch1.currentHolder}`);
  console.log("----------------------------------------------------");


  // Save deployment info for the frontend (same as deploy script)
  console.log("Saving deployment info for the frontend...");
  const deploymentInfo = {
    address: contractAddress
  };
  const deploymentPath = path.join(__dirname, '..', '..', 'web', 'lib', 'deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  const abiDir = path.join(__dirname, '..', 'artifacts', 'contracts', 'SupplyChain.sol');
  const abiSrc = path.join(abiDir, 'SupplyChain.json');
  const abiDest = path.join(__dirname, '..', '..', 'web', 'lib', 'contracts', 'contracts', 'SupplyChain.sol', 'SupplyChain.json');
  
  if (!fs.existsSync(path.dirname(abiDest))) {
      fs.mkdirSync(path.dirname(abiDest), { recursive: true });
  }
  fs.copyFileSync(abiSrc, abiDest);
  console.log("  - Deployment info and ABI saved successfully.");
  console.log("----------------------------------------------------");


  console.log("🌱 Seeding complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });