// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../interfaces/ilandregistry.sol";

contract MockLandRegistry is Test {
    // Mock implementation of ILandRegistry for testing
    ILandRegistry landRegistry;
    
    address owner = address(0x1);
    address user1 = address(0x2);
    address user2 = address(0x3);
    address verifier = address(0x4);
    
    uint256 propertyId;
    uint256 requestId;
    
    function setUp() public {
        // Deploy the actual LandRegistry contract here
        // landRegistry = ILandRegistry(new LandRegistry());
        
        // For now, we'll use a mock approach
        vm.startPrank(owner);
        // Setup mock expectations and behaviors
        vm.stopPrank();
    }
    
    function testRegisterProperty() public {
        vm.startPrank(user1);
        
        string memory coordinates = "12.345,67.890";
        uint256 area = 1000;
        string memory propertyType = "Residential";
        string memory legalDescription = "Lot 123, Block 45";
        uint256 marketValue = 100000;
        string[] memory documentHashes = new string[](1);
        documentHashes[0] = "QmHash1";
        string memory tokenURI = "https://example.com/token/1";
        
        // Test basic property registration
        propertyId = landRegistry.registerProperty(
            user1,
            coordinates,
            area,
            propertyType,
            legalDescription,
            marketValue,
            documentHashes,
            tokenURI
        );
        
        // Verify property was registered correctly
        ILandRegistry.LandProperty memory property = landRegistry.getProperty(propertyId);
        assertEq(property.tokenId, propertyId);
        assertEq(property.coordinates, coordinates);
        assertEq(property.area, area);
        assertEq(property.propertyType, propertyType);
        assertEq(property.legalDescription, legalDescription);
        assertEq(property.currentOwner, user1);
        assertEq(property.marketValue, marketValue);
        
        vm.stopPrank();
    }
    
    function testRegisterPropertyExtended() public {
        vm.startPrank(user1);
        
        string memory coordinates = "12.345,67.890";
        uint256 area = 1000;
        string memory propertyType = "Commercial";
        string memory legalDescription = "Lot 456, Block 78";
        uint256 marketValue = 200000;
        string[] memory documentHashes = new string[](1);
        documentHashes[0] = "QmHash2";
        string memory tokenURI = "https://example.com/token/2";
        string memory propertyName = "Downtown Office";
        string memory physicalAddress = "123 Main St";
        uint256 zoneId = 5;
        string[] memory amenities = new string[](2);
        amenities[0] = "Parking";
        amenities[1] = "Security";
        
        // Test extended property registration
        propertyId = landRegistry.registerPropertyExtended(
            user1,
            coordinates,
            area,
            propertyType,
            legalDescription,
            marketValue,
            documentHashes,
            tokenURI,
            propertyName,
            physicalAddress,
            zoneId,
            amenities
        );
        
        // Verify extended property was registered correctly
        ILandRegistry.LandProperty memory property = landRegistry.getProperty(propertyId);
        assertEq(property.tokenId, propertyId);
        assertEq(property.propertyName, propertyName);
        assertEq(property.physicalAddress, physicalAddress);
        assertEq(property.zoneId, zoneId);
        // Check amenities array length
        assertEq(property.amenities.length, 2);
        assertEq(property.amenities[0], "Parking");
        assertEq(property.amenities[1], "Security");
        
        vm.stopPrank();
    }
    
    function testPropertyVerification() public {
        // First register a property
        testRegisterProperty();
        
        // Set verifier permissions
        vm.prank(owner);
        landRegistry.setPropertyVerifier(verifier, true);
        
        // Verify the property
        vm.prank(verifier);
        landRegistry.verifyProperty(propertyId);
        
        // Check property is verified
        ILandRegistry.LandProperty memory property = landRegistry.getProperty(propertyId);
        assertTrue(property.isVerified);
    }
    
    function testPropertyTransfer() public {
        // First register a property
        testRegisterProperty();
        
        // Request transfer
        vm.startPrank(user1);
        uint256 price = 120000;
        bool requiresEscrow = true;
        string memory transferReason = "Sale";
        
        requestId = landRegistry.requestTransfer(
            propertyId,
            user2,
            price,
            requiresEscrow,
            transferReason
        );
        vm.stopPrank();
        
        // Execute transfer
        vm.prank(user2);
        landRegistry.executeTransfer{value: price}(requestId);
        
        // Verify property was transferred
        ILandRegistry.LandProperty memory property = landRegistry.getProperty(propertyId);
        assertEq(property.currentOwner, user2);
    }
    
    function testPropertyHistory() public {
        // First register and transfer a property
        testPropertyTransfer();
        
        // Get property history
        ILandRegistry.PropertyHistoryEntry[] memory history = landRegistry.getPropertyHistory(propertyId);
        
        // Should have at least 2 entries (register and transfer)
        assertGe(history.length, 2);
        
        // Check first entry is registration
        assertEq(history[0].actionType, "REGISTER");
        assertEq(history[0].actor, user1);
        
        // Check second entry is transfer
        assertEq(history[1].actionType, "TRANSFER");
        assertEq(history[1].actor, user2);
        assertEq(history[1].value, 120000);
        
        // Test filtering by action type
        ILandRegistry.PropertyHistoryEntry[] memory transferHistory = 
            landRegistry.getPropertyHistoryByAction(propertyId, "TRANSFER");
        
        assertEq(transferHistory.length, 1);
        assertEq(transferHistory[0].actionType, "TRANSFER");
    }
    
    function testUpdatePropertyMetadata() public {
        // First register a property
        testRegisterProperty();
        
        // Update metadata
        vm.prank(user1);
        string memory newPropertyName = "Sunset Villa";
        string memory newPhysicalAddress = "456 Beach Road";
        uint256 newZoneId = 3;
        string[] memory newAmenities = new string[](3);
        newAmenities[0] = "Pool";
        newAmenities[1] = "Garden";
        newAmenities[2] = "Garage";
        
        landRegistry.updatePropertyMetadata(
            propertyId,
            newPropertyName,
            newPhysicalAddress,
            newZoneId,
            newAmenities
        );
        
        // Verify metadata was updated
        ILandRegistry.LandProperty memory property = landRegistry.getProperty(propertyId);
        assertEq(property.propertyName, newPropertyName);
        assertEq(property.physicalAddress, newPhysicalAddress);
        assertEq(property.zoneId, newZoneId);
        assertEq(property.amenities.length, 3);
    }
    
    function testBatchOperations() public {
        vm.startPrank(user1);
        
        // Setup batch data
        address[] memory owners = new address[](2);
        owners[0] = user1;
        owners[1] = user1;
        
        string[] memory coordinates = new string[](2);
        coordinates[0] = "12.345,67.890";
        coordinates[1] = "23.456,78.901";
        
        uint256[] memory areas = new uint256[](2);
        areas[0] = 1000;
        areas[1] = 2000;
        
        string[] memory propertyTypes = new string[](2);
        propertyTypes[0] = "Residential";
        propertyTypes[1] = "Commercial";
        
        string[] memory legalDescriptions = new string[](2);
        legalDescriptions[0] = "Lot 123, Block 45";
        legalDescriptions[1] = "Lot 456, Block 78";
        
        uint256[] memory marketValues = new uint256[](2);
        marketValues[0] = 100000;
        marketValues[1] = 200000;
        
        string[][] memory documentHashes = new string[][](2);
        documentHashes[0] = new string[](1);
        documentHashes[0][0] = "QmHash1";
        documentHashes[1] = new string[](1);
        documentHashes[1][0] = "QmHash2";
        
        string[] memory tokenURIs = new string[](2);
        tokenURIs[0] = "https://example.com/token/1";
        tokenURIs[1] = "https://example.com/token/2";
        
        // Test batch registration
        uint256[] memory tokenIds = landRegistry.batchRegisterProperties(
            owners,
            coordinates,
            areas,
            propertyTypes,
            legalDescriptions,
            marketValues,
            documentHashes,
            tokenURIs
        );
        
        // Verify properties were registered
        assertEq(tokenIds.length, 2);
        
        // Test batch verification
        vm.stopPrank();
        vm.prank(owner);
        landRegistry.setPropertyVerifier(verifier, true);
        
        vm.startPrank(verifier);
        landRegistry.batchVerifyProperties(tokenIds);
        vm.stopPrank();
        
        // Verify both properties are verified
        ILandRegistry.LandProperty memory property1 = landRegistry.getProperty(tokenIds[0]);
        ILandRegistry.LandProperty memory property2 = landRegistry.getProperty(tokenIds[1]);
        assertTrue(property1.isVerified);
        assertTrue(property2.isVerified);
        
        // Test batch value update
        uint256[] memory newValues = new uint256[](2);
        newValues[0] = 110000;
        newValues[1] = 220000;
        
        vm.prank(owner);
        landRegistry.batchUpdatePropertyValues(tokenIds, newValues);
        
        // Verify values were updated
        property1 = landRegistry.getProperty(tokenIds[0]);
        property2 = landRegistry.getProperty(tokenIds[1]);
        assertEq(property1.marketValue, 110000);
        assertEq(property2.marketValue, 220000);
    }
    
    function testSearchAndFiltering() public {
        // Register multiple properties with different attributes
        testBatchOperations();
        
        // Test search by zone
        uint256[] memory zoneProperties = landRegistry.getPropertiesByZone(5);
        assertEq(zoneProperties.length, 0); // Assuming no properties in zone 5 yet
        
        // Test search by type
        uint256[] memory residentialProperties = landRegistry.getPropertiesByType("Residential");
        assertEq(residentialProperties.length, 1);
        
        // Test search by value range
        uint256[] memory midRangeProperties = landRegistry.getPropertiesByValueRange(100000, 150000);
        assertEq(midRangeProperties.length, 1);
        
        // Test search by address fragment
        uint256[] memory mainStProperties = landRegistry.searchPropertiesByAddress("Main");
        assertEq(mainStProperties.length, 0); // Assuming no properties with "Main" in address
    }
    
    function testDisputeHandling() public {
        // First register a property
        testRegisterProperty();
        
        // Raise a dispute
        vm.prank(user2);
        string memory reason = "Boundary dispute";
        landRegistry.raiseDispute(propertyId, reason);
        
        // Verify property is marked as disputed
        ILandRegistry.LandProperty memory property = landRegistry.getProperty(propertyId);
        assertTrue(property.isDisputed);
        
        // Resolve dispute
        vm.prank(owner);
        landRegistry.resolveDispute(propertyId, true); // Uphold the dispute
        
        // Verify dispute is resolved
        property = landRegistry.getProperty(propertyId);
        assertFalse(property.isDisputed);
    }
    
    function testAdminFunctions() public {
        // Test pausing transfers
        vm.prank(owner);
        landRegistry.pauseTransfers(true);
        
        bool isPaused = landRegistry.isTransferPaused();
        assertTrue(isPaused);
        
        // Test unpause
        vm.prank(owner);
        landRegistry.pauseTransfers(false);
        
        isPaused = landRegistry.isTransferPaused();
        assertFalse(isPaused);
    }
}