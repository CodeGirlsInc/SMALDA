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

