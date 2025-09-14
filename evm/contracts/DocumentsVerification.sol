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


        // Update indexing
        propertyDocuments[propertyTokenId].push(documentId);
        uploaderDocuments[msg.sender].push(documentId);
        statusDocuments[VerificationStatus.PENDING].push(documentId);

        // Grant access to uploader and property owner
        documentAccess[documentId][msg.sender] = true;
        address propertyOwner = landRegistry.ownerOf(propertyTokenId);
        if (propertyOwner != msg.sender) {
            documentAccess[documentId][propertyOwner] = true;
        }

        emit DocumentUploaded(documentId, propertyTokenId, msg.sender, ipfsHash, docType);
        
        return documentId;
    }

    // Verification Functions
    function requestVerification(
        uint256 documentId,
        string calldata reason,
        UrgencyLevel urgency
    ) external documentExists(documentId) hasDocumentAccess(documentId) whenNotPaused returns (uint256) {
        require(bytes(reason).length > 0, "Reason cannot be empty");
        require(documents[documentId].status == VerificationStatus.PENDING, "Document not in pending status");

        uint256 requestId = _verificationRequestIdCounter++;
        
        verificationRequests[requestId] = VerificationRequest({
            id: requestId,
            documentId: documentId,
            requester: msg.sender,
            reason: reason,
            urgency: urgency,
            requestTimestamp: block.timestamp,
            completed: false,
            verifier: address(0),
            completionTimestamp: 0,
            verifierNotes: ""
        });

        pendingVerificationRequests.push(requestId);

        emit VerificationRequested(requestId, documentId, msg.sender, urgency);
        
        return requestId;
    }

    function verifyDocument(
        uint256 requestId,
        VerificationStatus status,
        string calldata verifierNotes
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        require(verificationRequests[requestId].id != 0, "Verification request does not exist");
        require(!verificationRequests[requestId].completed, "Request already completed");
        require(status == VerificationStatus.VERIFIED || status == VerificationStatus.REJECTED, "Invalid status");

        VerificationRequest storage request = verificationRequests[requestId];
        uint256 documentId = request.documentId;
        
        // Update request
        request.completed = true;
        request.verifier = msg.sender;
        request.completionTimestamp = block.timestamp;
        request.verifierNotes = verifierNotes;

        // Update document status
        Document storage doc = documents[documentId];
        VerificationStatus oldStatus = doc.status;
        doc.status = status;

        // Update status indexing
        _removeFromStatusArray(oldStatus, documentId);
        statusDocuments[status].push(documentId);

        // Remove from pending requests
        _removePendingRequest(requestId);

        emit DocumentVerified(documentId, msg.sender, status);
    }

    // AI Risk Assessment Functions
    function submitAIRiskAssessment(
        uint256 documentId,
        RiskLevel riskLevel,
        uint8 confidenceScore,
        string[] calldata detectedRisks,
        string calldata recommendations
    ) external onlyRole(AI_ORACLE_ROLE) documentExists(documentId) whenNotPaused {
        require(confidenceScore <= 100, "Confidence score must be 0-100");
        require(!documents[documentId].aiProcessed, "Document already processed by AI");


        aiAssessments[documentId] = AIRiskAssessment({
            documentId: documentId,
            riskLevel: riskLevel,
            confidenceScore: confidenceScore,
            detectedRisks: detectedRisks,
            recommendations: recommendations,
            assessmentTimestamp: block.timestamp,
            oracle: msg.sender
        });

        // Update document
        Document storage doc = documents[documentId];
        doc.aiProcessed = true;
        
        // Auto-flag high-risk documents
        if (riskLevel == RiskLevel.HIGH || riskLevel == RiskLevel.CRITICAL) {
            doc.aiFlagged = true;
        }

        // Update risk level indexing
        riskLevelDocuments[riskLevel].push(documentId);

        emit AIRiskAssessmentSubmitted(documentId, riskLevel, confidenceScore, msg.sender);
    }

    // Access Control Functions
    function grantDocumentAccess(
        uint256 documentId,
        address user
    ) external documentExists(documentId) whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(
            hasRole(DOCUMENT_ADMIN_ROLE, msg.sender) || 
            documents[documentId].uploader == msg.sender ||
            landRegistry.ownerOf(documents[documentId].propertyTokenId) == msg.sender,
            "Not authorized to grant access"
        );

        documentAccess[documentId][user] = true;
        
        emit DocumentAccessGranted(documentId, user, msg.sender);
    }

    function revokeDocumentAccess(
        uint256 documentId,
        address user
    ) external documentExists(documentId) whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(
            hasRole(DOCUMENT_ADMIN_ROLE, msg.sender) || 
            documents[documentId].uploader == msg.sender ||
            landRegistry.ownerOf(documents[documentId].propertyTokenId) == msg.sender,
            "Not authorized to revoke access"
        );

        documentAccess[documentId][user] = false;
        
        emit DocumentAccessRevoked(documentId, user, msg.sender);
    }

    // Retrieval Functions
    function getDocument(uint256 documentId) 
        external 
        view 
        documentExists(documentId) 
        hasDocumentAccess(documentId) 
        returns (Document memory) 
    {
        return documents[documentId];
    }

    function getDocumentsByProperty(uint256 propertyTokenId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return propertyDocuments[propertyTokenId];
    }

    function getDocumentsByUploader(address uploader) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return uploaderDocuments[uploader];
    }

    function getDocumentsByRiskLevel(RiskLevel riskLevel) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return riskLevelDocuments[riskLevel];
    }

    function getDocumentsByStatus(VerificationStatus status) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return statusDocuments[status];
    }

