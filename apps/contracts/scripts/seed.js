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

  // Create sample products
  const products = [
    { name: "Premium Coffee Beans", quantity: 100, batch: "BATCH001" },
    { name: "Organic Tea Leaves", quantity: 50, batch: "BATCH002" },
    { name: "Artisan Chocolate", quantity: 75, batch: "BATCH003" }
  ];

  for (const product of products) {
    const tx = await supplyChain.connect(manufacturer).createProduct(
      product.name,
      product.quantity,
      product.batch
    );
    await tx.wait();
    console.log(`Created product: ${product.name} (${product.batch})`);
  }

  console.log("Seeding completed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});