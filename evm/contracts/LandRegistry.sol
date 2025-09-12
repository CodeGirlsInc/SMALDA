// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract LandRegistry is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard {
    // Roles
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant AI_ORACLE_ROLE = keccak256("AI_ORACLE_ROLE");

    // Enums
    enum PropertyType { RESIDENTIAL, COMMERCIAL, AGRICULTURAL, INDUSTRIAL }
    enum TransferStatus { PENDING, COMPLETED, CANCELLED, EXPIRED }
    enum DisputeStatus { NONE, PENDING, RESOLVED_UPHELD, RESOLVED_DISMISSED }

    // Data Structures
    struct LandProperty {
        uint256 tokenId;
        address owner;
        string coordinates; // GPS coordinates
        uint256 area; // in square meters
        PropertyType propertyType;
        string legalDescription;
        string[] documentHashes; // IPFS hashes of legal documents
        uint256 registrationDate;
        uint256 lastTransferDate;
        uint256 currentValue; // in wei
        bool isVerified;
        DisputeStatus disputeStatus;
        string disputeReason;
    }

    struct TransferRequest {
        uint256 requestId;
        uint256 tokenId;
        address from;
        address to;
        uint256 price;
        uint256 requestDate;
        uint256 expiryDate;
        TransferStatus status;
        bool escrowHeld;
        string transferReason;
    }


    // State Variables
    uint256 private _tokenIdCounter;
    uint256 private _requestIdCounter;

    // Mappings
    mapping(uint256 => LandProperty) public properties;
    mapping(uint256 => TransferRequest) public transferRequests;
    mapping(address => uint256[]) public ownerProperties;
    mapping(string => uint256) public coordinatesToTokenId;
    mapping(uint256 => uint256) public transferRequestCounter;
    mapping(uint256 => uint256) private _escrowBalances;

    // Events
    event PropertyRegistered(
        uint256 indexed tokenId,
        address indexed owner,
        string coordinates,
        uint256 area,
        PropertyType propertyType
    );
    
    event PropertyVerified(uint256 indexed tokenId, address indexed verifier);
    
    event TransferRequested(
        uint256 indexed requestId,
        uint256 indexed tokenId,
        address indexed from,
        address to,
        uint256 price
    );
    
    event TransferExecuted(
        uint256 indexed requestId,
        uint256 indexed tokenId,
        address indexed from,
        address to,
        uint256 price
    );
    
    event DisputeRaised(
        uint256 indexed tokenId,
        address indexed disputant,
        string reason
    );
    
    event DisputeResolved(
        uint256 indexed tokenId,
        address indexed resolver,
        bool upheld
    );
    

    event PropertyValueUpdated(
        uint256 indexed tokenId,
        uint256 oldValue,
        uint256 newValue
    );
    
    event DocumentAdded(uint256 indexed tokenId, string documentHash);

    constructor() ERC721("LandRegistry", "LAND") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    // Core Functions
    function registerProperty(
        address owner,
        string memory coordinates,
        uint256 area,
        PropertyType propertyType,
        string memory legalDescription,
        string[] memory documentHashes,
        uint256 initialValue,
        string memory tokenURI
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256) {
        require(owner != address(0), "Invalid owner address");
        require(bytes(coordinates).length > 0, "Coordinates required");
        require(area > 0, "Area must be greater than 0");
        require(coordinatesToTokenId[coordinates] == 0, "Property already registered at these coordinates");

        uint256 tokenId = ++_tokenIdCounter;
        
        // Mint NFT
        _safeMint(owner, tokenId);
        _setTokenURI(tokenId, tokenURI);

        // Create property record
        LandProperty storage property = properties[tokenId];
        property.tokenId = tokenId;
        property.owner = owner;
        property.coordinates = coordinates;
        property.area = area;
        property.propertyType = propertyType;
        property.legalDescription = legalDescription;
        property.documentHashes = documentHashes;
        property.registrationDate = block.timestamp;
        property.lastTransferDate = block.timestamp;
        property.currentValue = initialValue;
        property.isVerified = false;
        property.disputeStatus = DisputeStatus.NONE;


        // Update mappings
        ownerProperties[owner].push(tokenId);
        coordinatesToTokenId[coordinates] = tokenId;

        emit PropertyRegistered(tokenId, owner, coordinates, area, propertyType);
        return tokenId;
    }

    function verifyProperty(uint256 tokenId) external onlyRole(VERIFIER_ROLE) {
        require(_exists(tokenId), "Property does not exist");
        require(!properties[tokenId].isVerified, "Property already verified");

        properties[tokenId].isVerified = true;
        emit PropertyVerified(tokenId, msg.sender);
    }

    function requestTransfer(
        uint256 tokenId,
        address to,
        uint256 price,
        uint256 expiryDays,
        string memory transferReason
    ) external returns (uint256) {
        require(_exists(tokenId), "Property does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not property owner");
        require(to != address(0), "Invalid recipient address");
        require(to != msg.sender, "Cannot transfer to self");
        require(properties[tokenId].disputeStatus == DisputeStatus.NONE, "Property under dispute");

        uint256 requestId = ++_requestIdCounter;
        uint256 expiryDate = block.timestamp + (expiryDays * 1 days);

        TransferRequest storage request = transferRequests[requestId];
        request.requestId = requestId;
        request.tokenId = tokenId;
        request.from = msg.sender;
        request.to = to;
        request.price = price;
        request.requestDate = block.timestamp;
        request.expiryDate = expiryDate;
        request.status = TransferStatus.PENDING;
        request.escrowHeld = false;
        request.transferReason = transferReason;

        transferRequestCounter[tokenId]++;

        emit TransferRequested(requestId, tokenId, msg.sender, to, price);
        return requestId;
    }

