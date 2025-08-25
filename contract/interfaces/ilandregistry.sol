// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ILandRegistry {
    // Events for important state changes
    event PropertyRegistered(uint256 indexed tokenId, address indexed owner, string coordinates);
    event PropertyVerified(uint256 indexed tokenId, address indexed verifier);
    event PropertyTransferRequested(uint256 indexed requestId, uint256 indexed tokenId, address indexed from, address to);
    event PropertyTransferred(uint256 indexed tokenId, address indexed from, address indexed to, uint256 price);
    event DisputeRaised(uint256 indexed tokenId, address indexed disputeRaiser, string reason);
    event DisputeResolved(uint256 indexed tokenId, bool upheld);
    event PropertyValueUpdated(uint256 indexed tokenId, uint256 oldValue, uint256 newValue);
    event PropertyMetadataUpdated(uint256 indexed tokenId, string metadataType);
    
    // Enhanced property struct with additional metadata
    struct LandProperty {
        uint256 tokenId;
        string coordinates;
        uint256 area;
        string propertyType;
        string legalDescription;
        address currentOwner;
        uint256 registrationDate;
        uint256 lastTransferDate;
        bool isVerified;
        bool isDisputed;
        uint256 marketValue;
        string[] documentHashes;
        // Enhanced fields
        string propertyName;
        string physicalAddress;
        uint256 zoneId;
        string[] amenities;
        uint256 lastInspectionDate;
        uint8 propertyCondition; // 1-5 rating
        bool hasEncumbrances;
    }
    
    struct TransferRequest {
        uint256 tokenId;
        address from;
        address to;
        uint256 price;
        uint256 requestDate;
        bool isActive;
        bool requiresEscrow;
        string transferReason;
        uint256 expiryDate;
        bool isApprovedByAuthority;
    }
    
    // Property history tracking
    struct PropertyHistoryEntry {
        uint256 timestamp;
        string actionType; // "REGISTER", "TRANSFER", "DISPUTE", "VERIFICATION", "VALUE_UPDATE", etc.
        address actor;
        string details;
        uint256 value; // For price/value related actions
    }
    
    function registerProperty(
        address owner,
        string memory coordinates,
        uint256 area,
        string memory propertyType,
        string memory legalDescription,
        uint256 marketValue,
        string[] memory documentHashes,
        string memory tokenURI
    ) external returns (uint256);
    
    // Enhanced with additional property metadata
    function registerPropertyExtended(
        address owner,
        string memory coordinates,
        uint256 area,
        string memory propertyType,
        string memory legalDescription,
        uint256 marketValue,
        string[] memory documentHashes,
        string memory tokenURI,
        string memory propertyName,
        string memory physicalAddress,
        uint256 zoneId,
        string[] memory amenities
    ) external returns (uint256);
    
    function verifyProperty(uint256 tokenId) external;
    function requestTransfer(uint256 tokenId, address to, uint256 price, bool requiresEscrow, string memory transferReason) external;
    function executeTransfer(uint256 requestId) external payable;
    function raiseDispute(uint256 tokenId, string memory reason) external;
    function resolveDispute(uint256 tokenId, bool upheld) external;
    function updatePropertyValue(uint256 tokenId, uint256 newValue) external;
    
    // Property history tracking functions
    function getPropertyHistory(uint256 tokenId) external view returns (PropertyHistoryEntry[] memory);
    function getPropertyHistoryByAction(uint256 tokenId, string memory actionType) external view returns (PropertyHistoryEntry[] memory);
    
    // Enhanced property metadata functions
    function updatePropertyMetadata(
        uint256 tokenId, 
        string memory propertyName,
        string memory physicalAddress,
        uint256 zoneId,
        string[] memory amenities
    ) external;
    
    function updatePropertyCondition(uint256 tokenId, uint8 condition, uint256 inspectionDate) external;
    function setPropertyEncumbrances(uint256 tokenId, bool hasEncumbrances) external;
    
    // Batch operations
    function batchRegisterProperties(
        address[] memory owners,
        string[] memory coordinates,
        uint256[] memory areas,
        string[] memory propertyTypes,
        string[] memory legalDescriptions,
        uint256[] memory marketValues,
        string[][] memory documentHashes,
        string[] memory tokenURIs
    ) external returns (uint256[] memory);
    
    function batchVerifyProperties(uint256[] memory tokenIds) external;
    function batchUpdatePropertyValues(uint256[] memory tokenIds, uint256[] memory newValues) external;
    
    // Search and filtering functions
    function getPropertiesByZone(uint256 zoneId) external view returns (uint256[] memory);
    function getPropertiesByType(string memory propertyType) external view returns (uint256[] memory);
    function getPropertiesByValueRange(uint256 minValue, uint256 maxValue) external view returns (uint256[] memory);
    function getPropertiesByCondition(uint8 minCondition) external view returns (uint256[] memory);
    function searchPropertiesByAddress(string memory addressFragment) external view returns (uint256[] memory);
    
    // Existing query functions
    function getProperty(uint256 tokenId) external view returns (LandProperty memory);
    function getPropertiesByOwner(address owner) external view returns (uint256[] memory);
    
    // Administrative functions
    function setPropertyVerifier(address verifier, bool isAuthorized) external;
    function pauseTransfers(bool paused) external;
    function isTransferPaused() external view returns (bool);
}
