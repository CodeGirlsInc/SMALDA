// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title IDocumentVerification
/// @notice Interface for document verification and AI risk assessment storage & retrieval
interface IDocumentVerification {
    /// @notice Document status
    enum DocumentStatus {
        Unknown,
        Uploaded,
        Verified,
        Rejected
    }

    /// @notice Struct containing document metadata stored on-chain
    struct Document {
        bytes32 ipfsHash;         // IPFS content identifier stored as bytes32 (ipfs hash pinned/transformed)
        address uploader;         // who uploaded the metadata
        DocumentStatus status;    // current status
        uint256 uploadedAt;       // block timestamp uploaded
        uint256 verifiedAt;       // block timestamp verified (0 if not)
        address verifier;         // who verified (0 if not)
        string shortDesc;         // a short description (optional)
    }

    /// @notice Struct containing AI risk assessment information
    struct AIRiskAssessment {
        uint8 riskScore;          // risk score 0-100
        bytes32 reportIpfsHash;   // IPFS hash for detailed report
        address assessor;         // who submitted the assessment (AI actor / offchain oracle)
        uint256 submittedAt;      // timestamp for submission
        string notes;             // optional short notes or flags
    }

    /// @notice Upload document metadata and link to IPFS
    /// @param documentId unique document id decided by caller (could be keccak256 of ipfs + uploader)
    /// @param ipfsHash IPFS content hash as bytes32
    /// @param shortDesc short description of document
    function uploadDocument(bytes32 documentId, bytes32 ipfsHash, string calldata shortDesc) external;

    /// @notice Verify a document; only accounts with verifier role should call
    /// @param documentId id of the document to verify
    /// @param approve true to mark Verified, false to mark Rejected
    function verifyDocument(bytes32 documentId, bool approve) external;

    /// @notice Submit an AI-assisted risk assessment for a document
    /// @param documentId id of the document to assess
    /// @param riskScore risk score (0-100)
    /// @param reportIpfsHash IPFS hash for the full report
    /// @param notes short notes string
    function submitAIRiskAssessment(
        bytes32 documentId,
        uint8 riskScore,
        bytes32 reportIpfsHash,
        string calldata notes
    ) external;

    /// @notice Retrieve on-chain document metadata
    /// @param documentId id of the document
    /// @return doc Document struct tuple
    function getDocument(bytes32 documentId) external view returns (Document memory doc);

    /// @notice Retrieve the latest AI risk assessment for a document
    /// @param documentId id of the document
    /// @return assessment AIRiskAssessment struct tuple
    function getAIRiskAssessment(bytes32 documentId) external view returns (AIRiskAssessment memory assessment);

    /// @notice Event emitted when a document is uploaded
    event DocumentUploaded(bytes32 indexed documentId, bytes32 indexed ipfsHash, address indexed uploader);

    /// @notice Event emitted when a document is verified or rejected
    event DocumentVerified(bytes32 indexed documentId, address indexed verifier, bool approved);

    /// @notice Event emitted when an AI risk assessment is submitted
    event AIRiskAssessmentSubmitted(bytes32 indexed documentId, uint8 riskScore, bytes32 indexed reportIpfsHash, address indexed assessor);
}

//
// Implementation
//

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title DocumentVerification
/// @notice Implements IDocumentVerification to manage land document uploads, verification, and AI risk assessments.
/// @dev Uses AccessControl to manage roles: DEFAULT_ADMIN_ROLE, VERIFIER_ROLE, AI_ROLE
contract DocumentVerification is IDocumentVerification, AccessControl, ReentrancyGuard {
    /// @notice role allowed to verify documents (approve/reject)
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    /// @notice role allowed to submit AI risk assessments
    bytes32 public constant AI_ROLE = keccak256("AI_ROLE");

    /// @notice internal mapping for documents by id
    mapping(bytes32 => Document) private _documents;

    /// @notice internal mapping for latest AI assessment per document id
    mapping(bytes32 => AIRiskAssessment) private _aiAssessments;

    /// @notice Tracks whether a documentId exists (to distinguish default struct empty values)
    mapping(bytes32 => bool) private _documentExists;

    /// @notice Emitted when a document is uploaded (declared in interface, but repeating for solidity)
    event DocumentUploaded(bytes32 indexed documentId, bytes32 indexed ipfsHash, address indexed uploader);

    /// @notice Emitted when a document is verified or rejected (declared in interface)
    event DocumentVerified(bytes32 indexed documentId, address indexed verifier, bool approved);

    /// @notice Emitted when an AI risk assessment is submitted (declared in interface)
    event AIRiskAssessmentSubmitted(bytes32 indexed documentId, uint8 riskScore, bytes32 indexed reportIpfsHash, address indexed assessor);

    /// @notice Initializes contract, setting deployer as DEFAULT_ADMIN_ROLE
    constructor(address initialVerifier, address initialAI) {
        // Grant deployer admin
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // Optionally grant initial roles to provided addresses (if non-zero)
        if (initialVerifier != address(0)) {
            _setupRole(VERIFIER_ROLE, initialVerifier);
        }
        if (initialAI != address(0)) {
            _setupRole(AI_ROLE, initialAI);
        }
    }

    // -------------------------
    // Modifiers & helpers
    // -------------------------

    /// @notice Ensure a document exists
    modifier documentMustExist(bytes32 documentId) {
        require(_documentExists[documentId], "DocumentVerification: document does not exist");
        _;
    }

    /// @notice Pack string to bytes32 is not done here — user must pass bytes32 ipfs hash representation.
    ///         We keep IPFS hash as bytes32 to reduce storage cost; if using full base58 multihash,
    ///         store a truncated representation or the CIDv1/bytes form offchain and store a pointer.
    /// @dev We choose bytes32 for gas efficiency. If you want to store full CID strings, change to string.

    // -------------------------
    // Main functions
    // -------------------------

    /// @inheritdoc IDocumentVerification
    /// @dev Emits DocumentUploaded event.
    function uploadDocument(bytes32 documentId, bytes32 ipfsHash, string calldata shortDesc) external override nonReentrant {
        require(documentId != bytes32(0), "DocumentVerification: invalid documentId");
        require(ipfsHash != bytes32(0), "DocumentVerification: invalid ipfsHash");
        require(!_documentExists[documentId], "DocumentVerification: documentId already used");

        Document memory doc = Document({
            ipfsHash: ipfsHash,
            uploader: msg.sender,
            status: DocumentStatus.Uploaded,
            uploadedAt: block.timestamp,
            verifiedAt: 0,
            verifier: address(0),
            shortDesc: shortDesc
        });

        _documents[documentId] = doc;
        _documentExists[documentId] = true;

        emit DocumentUploaded(documentId, ipfsHash, msg.sender);
    }

    /// @inheritdoc IDocumentVerification
    /// @dev Only accounts with VERIFIER_ROLE can call. Emits DocumentVerified.
    function verifyDocument(bytes32 documentId, bool approve) external override nonReentrant documentMustExist(documentId) {
        require(hasRole(VERIFIER_ROLE, msg.sender), "DocumentVerification: caller is not a verifier");

        Document storage doc = _documents[documentId];

        // Only allow verify when uploaded or not yet verified
        require(doc.status == DocumentStatus.Uploaded || doc.status == DocumentStatus.Rejected, "DocumentVerification: document cannot be (re)verified in current state");

        if (approve) {
            doc.status = DocumentStatus.Verified;
        } else {
            doc.status = DocumentStatus.Rejected;
        }

        doc.verifiedAt = block.timestamp;
        doc.verifier = msg.sender;

        // Optimize by reading small local var for event
        emit DocumentVerified(documentId, msg.sender, approve);
    }

    /// @inheritdoc IDocumentVerification
    /// @dev Only accounts with AI_ROLE can call. Emits AIRiskAssessmentSubmitted.
    function submitAIRiskAssessment(
        bytes32 documentId,
        uint8 riskScore,
        bytes32 reportIpfsHash,
        string calldata notes
    ) external override nonReentrant documentMustExist(documentId) {
        require(hasRole(AI_ROLE, msg.sender), "DocumentVerification: caller is not authorized to submit AI assessments");
        require(riskScore <= 100, "DocumentVerification: riskScore out of bounds");
        require(reportIpfsHash != bytes32(0), "DocumentVerification: invalid report IPFS hash");

        AIRiskAssessment memory assessment = AIRiskAssessment({
            riskScore: riskScore,
            reportIpfsHash: reportIpfsHash,
            assessor: msg.sender,
            submittedAt: block.timestamp,
            notes: notes
        });

        _aiAssessments[documentId] = assessment;

        emit AIRiskAssessmentSubmitted(documentId, riskScore, reportIpfsHash, msg.sender);
    }

    /// @inheritdoc IDocumentVerification
    function getDocument(bytes32 documentId) external view override documentMustExist(documentId) returns (Document memory doc) {
        doc = _documents[documentId];
    }

    /// @inheritdoc IDocumentVerification
    function getAIRiskAssessment(bytes32 documentId) external view override documentMustExist(documentId) returns (AIRiskAssessment memory assessment) {
        assessment = _aiAssessments[documentId];
    }

    // -------------------------
    // Admin helpers
    // -------------------------

    /// @notice Grant verifier role to an account
    /// @param account address to grant role
    function grantVerifier(address account) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "DocumentVerification: must be admin to grant verifier");
        grantRole(VERIFIER_ROLE, account);
    }

    /// @notice Revoke verifier role from an account
    /// @param account address to revoke role
    function revokeVerifier(address account) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "DocumentVerification: must be admin to revoke verifier");
        revokeRole(VERIFIER_ROLE, account);
    }

    /// @notice Grant AI role to an account
    /// @param account address to grant role
    function grantAI(address account) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "DocumentVerification: must be admin to grant AI role");
        grantRole(AI_ROLE, account);
    }

    /// @notice Revoke AI role from an account
    /// @param account address to revoke role
    function revokeAI(address account) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "DocumentVerification: must be admin to revoke AI role");
        revokeRole(AI_ROLE, account);
    }

    // -------------------------
    // Utility / view functions
    // -------------------------

    /// @notice Check if a document exists
    /// @param documentId id to check
    /// @return exists bool
    function documentExists(bytes32 documentId) external view returns (bool exists) {
        exists = _documentExists[documentId];
    }

    /// @notice Get a minimal public view of a document (useful for lighter clients)
    /// @param documentId id to query
    /// @return ipfsHash bytes32 IPFS hash
    /// @return uploader address uploader
    /// @return status DocumentStatus status
    function getDocumentSummary(bytes32 documentId)
        external
        view
        documentMustExist(documentId)
        returns (bytes32 ipfsHash, address uploader, DocumentStatus status)
    {
        Document storage d = _documents[documentId];
        ipfsHash = d.ipfsHash;
        uploader = d.uploader;
        status = d.status;
    }

    // -------------------------
    // Security & gas notes (NatSpec above functions)
    // -------------------------
    // - We store IPFS hashes as bytes32 for gas efficiency. If your workflow requires string CIDs,
    //   you should change the field type to string, but be aware of increased gas costs.
    // - Access control uses OpenZeppelin AccessControl. Admins should follow secure key management.
    // - ReentrancyGuard is used on state-changing external functions.
    // - Consider adding an offchain indexing/oracle mechanism to verify IPFS pinning or AI signing.
}
