const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LandRegistry", () => {
  let LandRegistry;
  let landRegistry;
  let owner;
  let registrar;
  let verifier;
  let user1;
  let user2;

  beforeEach(async () => {
    [owner, registrar, verifier, user1, user2] = await ethers.getSigners();

    LandRegistry = await ethers.getContractFactory("LandRegistry");
    landRegistry = await LandRegistry.deploy();
    await landRegistry.deployed();

    // Grant roles
    const REGISTRAR_ROLE = await landRegistry.REGISTRAR_ROLE();
    const VERIFIER_ROLE = await landRegistry.VERIFIER_ROLE();

    await landRegistry.grantRole(REGISTRAR_ROLE, registrar.address);
    await landRegistry.grantRole(VERIFIER_ROLE, verifier.address);
  });

  describe("Property Registration", () => {
    it("Should register a new property", async () => {
      const coordinates = "40.7128,-74.0060";
      const area = 1000;
      const propertyType = 0; // RESIDENTIAL
      const legalDescription = "123 Main St, New York, NY";
      const documentHashes = ["QmHash1", "QmHash2"];
      const initialValue = ethers.utils.parseEther("500");
      const tokenURI = "https://metadata.uri/1";

      await expect(
        landRegistry
          .connect(registrar)
          .registerProperty(
            user1.address,
            coordinates,
            area,
            propertyType,
            legalDescription,
            documentHashes,
            initialValue,
            tokenURI
          )
      )
        .to.emit(landRegistry, "PropertyRegistered")
        .withArgs(1, user1.address, coordinates, area, propertyType);

      const property = await landRegistry.getProperty(1);
      expect(property.owner).to.equal(user1.address);
      expect(property.coordinates).to.equal(coordinates);
      expect(property.area).to.equal(area);
      expect(property.isVerified).to.be.false;
    });

    it("Should not allow duplicate coordinates", async () => {
      const coordinates = "40.7128,-74.0060";

      await landRegistry
        .connect(registrar)
        .registerProperty(
          user1.address,
          coordinates,
          1000,
          0,
          "Property 1",
          [],
          ethers.utils.parseEther("500"),
          "uri1"
        );

      await expect(
        landRegistry
          .connect(registrar)
          .registerProperty(
            user2.address,
            coordinates,
            2000,
            0,
            "Property 2",
            [],
            ethers.utils.parseEther("600"),
            "uri2"
          )
      ).to.be.revertedWith("Property already registered at these coordinates");
    });
  });

  describe("Property Verification", () => {
    beforeEach(async () => {
      await landRegistry
        .connect(registrar)
        .registerProperty(
          user1.address,
          "40.7128,-74.0060",
          1000,
          0,
          "Test Property",
          [],
          ethers.utils.parseEther("500"),
          "uri1"
        );
    });

    it("Should verify a property", async () => {
      await expect(landRegistry.connect(verifier).verifyProperty(1))
        .to.emit(landRegistry, "PropertyVerified")
        .withArgs(1, verifier.address);

      const property = await landRegistry.getProperty(1);
      expect(property.isVerified).to.be.true;
    });

    it("Should not allow non-verifiers to verify", async () => {
      await expect(landRegistry.connect(user1).verifyProperty(1)).to.be
        .reverted;
    });
  });

  describe("Property Transfers", () => {
    beforeEach(async () => {
      await landRegistry
        .connect(registrar)
        .registerProperty(
          user1.address,
          "40.7128,-74.0060",
          1000,
          0,
          "Test Property",
          [],
          ethers.utils.parseEther("500"),
          "uri1"
        );
    });

    it("Should create a transfer request", async () => {
      const price = ethers.utils.parseEther("600");

      await expect(
        landRegistry
          .connect(user1)
          .requestTransfer(1, user2.address, price, 30, "Property sale")
      )
        .to.emit(landRegistry, "TransferRequested")
        .withArgs(1, 1, user1.address, user2.address, price);

      const request = await landRegistry.getTransferRequest(1);
      expect(request.tokenId).to.equal(1);
      expect(request.from).to.equal(user1.address);
      expect(request.to).to.equal(user2.address);
      expect(request.price).to.equal(price);
    });

    it("Should execute a transfer with payment", async () => {
      const price = ethers.utils.parseEther("600");

      await landRegistry
        .connect(user1)
        .requestTransfer(1, user2.address, price, 30, "Property sale");

      const initialBalance = await user1.getBalance();

      await expect(
        landRegistry.connect(user2).executeTransfer(1, { value: price })
      )
        .to.emit(landRegistry, "TransferExecuted")
        .withArgs(1, 1, user1.address, user2.address, price);

      // Check ownership transfer
      expect(await landRegistry.ownerOf(1)).to.equal(user2.address);

      // Check property record update
      const property = await landRegistry.getProperty(1);
      expect(property.owner).to.equal(user2.address);

      // Check payment transfer
      const finalBalance = await user1.getBalance();
      expect(finalBalance.sub(initialBalance)).to.equal(price);
    });
  });

  describe("Disputes", () => {
    beforeEach(async () => {
      await landRegistry
        .connect(registrar)
        .registerProperty(
          user1.address,
          "40.7128,-74.0060",
          1000,
          0,
          "Test Property",
          [],
          ethers.utils.parseEther("500"),
          "uri1"
        );
    });

    it("Should raise a dispute", async () => {
      const reason = "Boundary dispute";

      await expect(landRegistry.connect(user2).raiseDispute(1, reason))
        .to.emit(landRegistry, "DisputeRaised")
        .withArgs(1, user2.address, reason);

      const property = await landRegistry.getProperty(1);
      expect(property.disputeStatus).to.equal(1); // PENDING
      expect(property.disputeReason).to.equal(reason);
    });

    it("Should resolve a dispute", async () => {
      await landRegistry.connect(user2).raiseDispute(1, "Test dispute");

      await expect(landRegistry.connect(verifier).resolveDispute(1, true))
        .to.emit(landRegistry, "DisputeResolved")
        .withArgs(1, verifier.address, true);

      const property = await landRegistry.getProperty(1);
      expect(property.disputeStatus).to.equal(2); // RESOLVED_UPHELD
    });
  });

  describe("Property Value Updates", () => {
    beforeEach(async () => {
      await landRegistry
        .connect(registrar)
        .registerProperty(
          user1.address,
          "40.7128,-74.0060",
          1000,
          0,
          "Test Property",
          [],
          ethers.utils.parseEther("500"),
          "uri1"
        );
    });

    it("Should update property value", async () => {
      const newValue = ethers.utils.parseEther("750");
      const oldValue = ethers.utils.parseEther("500");

      await expect(
        landRegistry.connect(verifier).updatePropertyValue(1, newValue)
      )
        .to.emit(landRegistry, "PropertyValueUpdated")
        .withArgs(1, oldValue, newValue);

      const property = await landRegistry.getProperty(1);
      expect(property.currentValue).to.equal(newValue);
    });
  });

  describe("Document Management", () => {
    beforeEach(async () => {
      await landRegistry
        .connect(registrar)
        .registerProperty(
          user1.address,
          "40.7128,-74.0060",
          1000,
          0,
          "Test Property",
          [],
          ethers.utils.parseEther("500"),
          "uri1"
        );
    });

    it("Should add document hash", async () => {
      const documentHash = "QmNewDocument";

      await expect(landRegistry.connect(user1).addDocumentHash(1, documentHash))
        .to.emit(landRegistry, "DocumentAdded")
        .withArgs(1, documentHash);

      const property = await landRegistry.getProperty(1);
      expect(property.documentHashes).to.include(documentHash);
    });
  });
});
