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

    
    // Indexing mappings
    mapping(uint256 => uint256[]) public propertyDocuments; // propertyTokenId => documentIds
    mapping(address => uint256[]) public uploaderDocuments; // uploader => documentIds
    mapping(RiskLevel => uint256[]) public riskLevelDocuments; // riskLevel => documentIds
    mapping(VerificationStatus => uint256[]) public statusDocuments; // status => documentIds
    
    uint256[] public pendingVerificationRequests;

    // Events
    event DocumentUploaded(
        uint256 indexed documentId,
        uint256 indexed propertyTokenId,
        address indexed uploader,
        string ipfsHash,
        DocumentType docType
    );
    
    event VerificationRequested(
        uint256 indexed requestId,
        uint256 indexed documentId,
        address indexed requester,
        UrgencyLevel urgency
    );
    
    event DocumentVerified(
        uint256 indexed documentId,
        address indexed verifier,
        VerificationStatus status
    );
    
    event AIRiskAssessmentSubmitted(
        uint256 indexed documentId,
        RiskLevel riskLevel,
        uint8 confidenceScore,
        address indexed oracle
    );
    
    event DocumentAccessGranted(
        uint256 indexed documentId,
        address indexed user,
        address indexed grantor
    );
    
    event DocumentAccessRevoked(
        uint256 indexed documentId,
        address indexed user,
        address indexed revoker
    );

    // Modifiers
    modifier documentExists(uint256 documentId) {
        require(documents[documentId].id != 0, "Document does not exist");
        _;
    }

    modifier hasDocumentAccess(uint256 documentId) {
        require(_hasDocumentAccess(msg.sender, documentId), "Access denied");
        _;
    }

    modifier validPropertyToken(uint256 propertyTokenId) {
        require(landRegistry.exists(propertyTokenId), "Property token does not exist");
        _;
    }

    constructor(address _landRegistry) {
        require(_landRegistry != address(0), "Invalid land registry address");
        
        landRegistry = ILandRegistry(_landRegistry);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DOCUMENT_ADMIN_ROLE, msg.sender);
        
        _documentIdCounter = 1;
        _verificationRequestIdCounter = 1;
    }

    // Document Management Functions
    function uploadDocument(
        uint256 propertyTokenId,
        string calldata ipfsHash,
        string calldata fileName,
        uint256 fileSize,
        DocumentType docType,
        bool isPublic
    ) external validPropertyToken(propertyTokenId) whenNotPaused returns (uint256) {
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(bytes(fileName).length > 0, "File name cannot be empty");
        require(fileSize > 0, "File size must be greater than 0");

        uint256 documentId = _documentIdCounter++;
        
        documents[documentId] = Document({
            id: documentId,
            propertyTokenId: propertyTokenId,
            uploader: msg.sender,
            ipfsHash: ipfsHash,
            fileName: fileName,
            fileSize: fileSize,
            docType: docType,
            isPublic: isPublic,
            uploadTimestamp: block.timestamp,
            status: VerificationStatus.PENDING,
            aiProcessed: false,
            aiFlagged: false
        });
