// FILE: apps/contracts/scripts/deploy.js

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

async function main() {
  console.log("Starting SupplyChain contract deployment...");

  const [deployer] = await ethers.getSigners();
  console.log(`\nDeploying contracts with the account: ${deployer.address}`);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`Account balance: ${balance.toString()}`);

  console.log("\nDeploying SupplyChain contract...");
  const SupplyChainFactory = await ethers.getContractFactory("SupplyChain");
  const supplyChain = await SupplyChainFactory.deploy();
  await supplyChain.waitForDeployment();

  const contractAddress = await supplyChain.getAddress();
  console.log(`✅ SupplyChain contract deployed to: ${contractAddress}`);

  // --- Save Deployment Info to Frontend ---
  console.log("\nSaving deployment info for the frontend...");

  // 1. Save the contract address
  const deploymentInfo = {
    address: contractAddress,
  };
  const deploymentPath = path.join(
    __dirname,
    "../../web/lib/deployment.json"
  );
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`   - Contract address saved to: ${path.relative(process.cwd(), deploymentPath)}`);

  // 2. Save the contract ABI
  const abiDir = path.join(
    __dirname,
    "../artifacts/contracts/SupplyChain.sol"
  );
  const abiPath = path.join(
    __dirname,
    "../../web/lib/contracts/contracts/SupplyChain.sol/SupplyChain.json"
  );
  const abiFile = fs.readFileSync(path.join(abiDir, "SupplyChain.json"), "utf8");

  // --- FIX ---
  // Create the destination directory if it doesn't exist before writing the file.
  fs.mkdirSync(path.dirname(abiPath), { recursive: true });
  // --- END FIX ---

  fs.writeFileSync(abiPath, abiFile);
  console.log(`   - Contract ABI saved to: ${path.relative(process.cwd(), abiPath)}`);

  console.log("\n🚀 Deployment complete!");
}

main().catch((error) => {
  console.error("❌ Deployment failed:");
  console.error(error);
  process.exitCode = 1;
});