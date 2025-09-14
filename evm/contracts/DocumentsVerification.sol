// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/ILandRegistry.sol";

contract DocumentVerification is AccessControl, ReentrancyGuard, Pausable {
    // Role definitions
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant AI_ORACLE_ROLE = keccak256("AI_ORACLE_ROLE");
    bytes32 public constant DOCUMENT_ADMIN_ROLE = keccak256("DOCUMENT_ADMIN_ROLE");

    // Enums
    enum DocumentType {
        TITLE_DEED,
        SURVEY_REPORT,
        OWNERSHIP_CERTIFICATE,
        TAX_DOCUMENT,
        LEGAL_DOCUMENT,
        OTHER
    }

    enum VerificationStatus {
        PENDING,
        VERIFIED,
        REJECTED,
        EXPIRED
    }

    enum RiskLevel {
        NONE,
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }

    enum UrgencyLevel {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }

    // Structs
    struct Document {
        uint256 id;
        uint256 propertyTokenId;
        address uploader;
        string ipfsHash;
        string fileName;
        uint256 fileSize;
        DocumentType docType;
        bool isPublic;
        uint256 uploadTimestamp;
        VerificationStatus status;
        bool aiProcessed;
        bool aiFlagged;
    }

    struct VerificationRequest {
        uint256 id;
        uint256 documentId;
        address requester;
        string reason;
        UrgencyLevel urgency;
        uint256 requestTimestamp;
        bool completed;
        address verifier;
        uint256 completionTimestamp;
        string verifierNotes;
    }

    struct AIRiskAssessment {
        uint256 documentId;
        RiskLevel riskLevel;
        uint8 confidenceScore; // 0-100
        string[] detectedRisks;
        string recommendations;
        uint256 assessmentTimestamp;
        address oracle;
    }

    // State variables
    ILandRegistry public landRegistry;
    
    uint256 private _documentIdCounter;
    uint256 private _verificationRequestIdCounter;
    
    mapping(uint256 => Document) public documents;
    mapping(uint256 => VerificationRequest) public verificationRequests;
    mapping(uint256 => AIRiskAssessment) public aiAssessments;
    
    // Access control mappings
    mapping(uint256 => mapping(address => bool)) public documentAccess;