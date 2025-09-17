// scripts/deployFinancialEscrow.js

const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment of FinancialEscrow...");

  // Retrieve deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log(`👤 Deployer address: ${deployer.address}`);
  console.log(
    `💰 Deployer balance: ${(await deployer.getBalance()).toString()} wei`
  );

  // Fetch required env variables
  const landRegistryAddress = process.env.LAND_REGISTRY_ADDRESS;
  const documentVerificationAddress = process.env.DOCUMENT_VERIFICATION_ADDRESS;

  if (!landRegistryAddress || !documentVerificationAddress) {
    console.error(
      "❌ Error: LAND_REGISTRY_ADDRESS and DOCUMENT_VERIFICATION_ADDRESS must be set in environment variables."
    );
    process.exit(1);
  }

  console.log("✅ Environment variables loaded successfully.");
  console.log(`🏠 LAND_REGISTRY_ADDRESS: ${landRegistryAddress}`);
  console.log(
    `📄 DOCUMENT_VERIFICATION_ADDRESS: ${documentVerificationAddress}`
  );

  try {
    // Deploy FinancialEscrow
    console.log("⏳ Deploying FinancialEscrow contract...");
    const FinancialEscrow = await hre.ethers.getContractFactory(
      "FinancialEscrow"
    );
    const financialEscrow = await FinancialEscrow.deploy(
      landRegistryAddress,
      documentVerificationAddress
    );

    await financialEscrow.deployed();
    console.log(
      `🎉 FinancialEscrow deployed successfully at: ${financialEscrow.address}`
    );

    // Retrieve roles
    console.log("🔑 Fetching role identifiers...");
    const ESCROW_AGENT_ROLE = await financialEscrow.ESCROW_AGENT_ROLE();
    const FINANCIAL_ADMIN_ROLE = await financialEscrow.FINANCIAL_ADMIN_ROLE();
    const FEE_COLLECTOR_ROLE = await financialEscrow.FEE_COLLECTOR_ROLE();

    console.log(`ESCROW_AGENT_ROLE: ${ESCROW_AGENT_ROLE}`);
    console.log(`FINANCIAL_ADMIN_ROLE: ${FINANCIAL_ADMIN_ROLE}`);
    console.log(`FEE_COLLECTOR_ROLE: ${FEE_COLLECTOR_ROLE}`);

    console.log("✅ Deployment script completed successfully.");
    return financialEscrow.address;
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Run the script
main()
  .then((address) => {
    console.log(`📦 Returned deployed contract address: ${address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script execution error:", error);
    process.exit(1);
  });
