// test/FinancialEscrowDeployment.test.js

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FinancialEscrow Deployment Script", function () {
  let FinancialEscrow, financialEscrow;
  let deployer, addr1;

  // Mock contract addresses for testing
  const MOCK_LAND_REGISTRY_ADDRESS =
    "0x0000000000000000000000000000000000000001";
  const MOCK_DOCUMENT_VERIFICATION_ADDRESS =
    "0x0000000000000000000000000000000000000002";

  beforeEach(async function () {
    [deployer, addr1] = await ethers.getSigners();

    FinancialEscrow = await ethers.getContractFactory("FinancialEscrow");
    financialEscrow = await FinancialEscrow.deploy(
      MOCK_LAND_REGISTRY_ADDRESS,
      MOCK_DOCUMENT_VERIFICATION_ADDRESS
    );
    await financialEscrow.deployed();
  });

  it("should deploy with the correct constructor arguments", async function () {
    // Assuming your FinancialEscrow contract stores these addresses
    const landRegistryAddr = await financialEscrow.landRegistry();
    const docVerificationAddr = await financialEscrow.documentVerification();

    expect(landRegistryAddr).to.equal(MOCK_LAND_REGISTRY_ADDRESS);
    expect(docVerificationAddr).to.equal(MOCK_DOCUMENT_VERIFICATION_ADDRESS);
  });

  it("should expose role identifiers", async function () {
    const ESCROW_AGENT_ROLE = await financialEscrow.ESCROW_AGENT_ROLE();
    const FINANCIAL_ADMIN_ROLE = await financialEscrow.FINANCIAL_ADMIN_ROLE();
    const FEE_COLLECTOR_ROLE = await financialEscrow.FEE_COLLECTOR_ROLE();

    expect(ESCROW_AGENT_ROLE).to.be.a("string");
    expect(FINANCIAL_ADMIN_ROLE).to.be.a("string");
    expect(FEE_COLLECTOR_ROLE).to.be.a("string");
  });

  it("should assign the deployer as default admin role", async function () {
    const DEFAULT_ADMIN_ROLE = await financialEscrow.DEFAULT_ADMIN_ROLE();
    const hasRole = await financialEscrow.hasRole(
      DEFAULT_ADMIN_ROLE,
      deployer.address
    );

    expect(hasRole).to.be.true;
  });

  // This test simulates missing env vars at script level
  it("should throw if env vars are missing (simulated)", async function () {
    // Simulating by trying to deploy without required args
    await expect(
      FinancialEscrow.deploy(
        ethers.constants.AddressZero,
        ethers.constants.AddressZero
      )
    ).to.be.revertedWith("Invalid constructor arguments"); // adjust if your contract reverts differently
  });
});
