import hardhat from "hardhat";
import dotenv from "dotenv";

dotenv.config();

const { ethers } = hardhat;
async function main() {
  // Retrieve deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Check LAND_REGISTRY_ADDRESS in env
  const landRegistryAddress = process.env.LAND_REGISTRY_ADDRESS;
  if (!landRegistryAddress) {
    throw new Error("❌ LAND_REGISTRY_ADDRESS is not set in environment variables");
  }
  console.log("Using LAND_REGISTRY_ADDRESS:", landRegistryAddress);

  // Get ContractFactory
  const DocumentVerification = await ethers.getContractFactory("DocumentVerification");

  // Deploy contract
  const contract = await DocumentVerification.deploy(landRegistryAddress);
  console.log("⏳ Waiting for deployment...");
  await contract.waitForDeployment();

  const deployedAddress = await contract.getAddress();
  console.log("✅ DocumentVerification deployed at:", deployedAddress);

  // Fetch roles from contract
  const VERIFIER_ROLE = await contract.VERIFIER_ROLE();
  const AI_ORACLE_ROLE = await contract.AI_ORACLE_ROLE();
  const DOCUMENT_ADMIN_ROLE = await contract.DOCUMENT_ADMIN_ROLE();

  console.log("Roles:");
  console.log("  VERIFIER_ROLE:", VERIFIER_ROLE);
  console.log("  AI_ORACLE_ROLE:", AI_ORACLE_ROLE);
  console.log("  DOCUMENT_ADMIN_ROLE:", DOCUMENT_ADMIN_ROLE);

  // Return structured object
  return {
    deployedAddress,
    roles: {
      VERIFIER_ROLE,
      AI_ORACLE_ROLE,
      DOCUMENT_ADMIN_ROLE,
    },
  };
}

// Run script with proper error handling
main()
  .then((result) => {
    console.log("Deployment Result:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });