const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const deploymentPath = path.join(__dirname, "../../web/lib/deployment.json");

  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment file not found. Please run deployment first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const [manufacturer, distributor, retailer] = await ethers.getSigners();
  const SupplyChain = await ethers.getContractFactory("SupplyChain");
  const supplyChain = SupplyChain.attach(deployment.contractAddress);

  console.log("Seeding data...");

  // Grant roles
  let tx = await supplyChain.connect(manufacturer).grantDistributorRole(distributor.address);
  await tx.wait();
  console.log(`Granted Distributor role to: ${distributor.address}`);

  tx = await supplyChain.connect(manufacturer).grantRetailerRole(retailer.address);
  await tx.wait();
  console.log(`Granted Retailer role to: ${retailer.address}`);

  // Create sample batches
  const batches = [
    { quantity: 100, ewaybillNo: "EWAY001" },
    { quantity: 50, ewaybillNo: "EWAY002" },
    { quantity: 75, ewaybillNo: "EWAY003" },
  ];

  for (const batch of batches) {
    const tx = await supplyChain
      .connect(manufacturer)
      .createBatch(batch.quantity, batch.ewaybillNo);
    await tx.wait();
    console.log(`Created batch with e-way bill: ${batch.ewaybillNo}`);
  }

  console.log("Seeding completed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});