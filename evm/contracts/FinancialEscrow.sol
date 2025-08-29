// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interfaces for external integrations
interface ILandRegistry {
    function transferOwnership(uint256 propertyId, address from, address to) external;
    function getOwner(uint256 propertyId) external view returns (address);
    function isValidProperty(uint256 propertyId) external view returns (bool);
}

interface IDocumentVerification {
    function verifyDocument(bytes32 documentHash) external view returns (bool);
    function addDocument(bytes32 documentHash, address verifier) external;
}

/**
 * @title FinancialEscrow
 * @dev Comprehensive property transaction management with escrow, staking, and insurance
 */
contract FinancialEscrow is AccessControl, Pausable, ReentrancyGuard {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;

    // Role definitions
    bytes32 public constant ESCROW_AGENT_ROLE = keccak256("ESCROW_AGENT_ROLE");
    bytes32 public constant FINANCIAL_ADMIN_ROLE = keccak256("FINANCIAL_ADMIN_ROLE");
    bytes32 public constant FEE_COLLECTOR_ROLE = keccak256("FEE_COLLECTOR_ROLE");

    // Counters
    Counters.Counter private _escrowIdCounter;
    Counters.Counter private _stakeIdCounter;
    Counters.Counter private _insuranceIdCounter;

    // External contracts
    ILandRegistry public landRegistry;
    IDocumentVerification public documentVerification;

    // Enums
    enum EscrowStatus { CREATED, FUNDED, RELEASED, REFUNDED, DISPUTED }
    enum StakeType { VERIFIER_STAKE, VALIDATOR_STAKE, INSURANCE_STAKE, PERFORMANCE_BOND }
    enum ConditionType { DOCUMENT_VERIFICATION, INSPECTION, PAYMENT, CUSTOM }

    // Structs
    struct Escrow {
        uint256 id;
        address buyer;
        address seller;
        uint256 propertyId;
        uint256 totalAmount;
        uint256 releasedAmount;
        EscrowStatus status;
        uint256 createdAt;
        uint256 deadline;
        bool requiresInsurance;
        uint256 insuranceId;
        mapping(uint256 => Milestone) milestones;
        uint256 milestoneCount;
        mapping(uint256 => Condition) conditions;
        uint256 conditionCount;
    }

    struct Milestone {
        uint256 id;
        string description;
        uint256 amount;
        bool completed;
        uint256 completedAt;
        bytes32[] requiredConditions;
    }

    struct Condition {
        uint256 id;
        ConditionType conditionType;
        string description;
        bool met;
        address verifier;
        uint256 metAt;
        bytes32 documentHash;
    }

    struct Stake {
        uint256 id;
        address staker;
        StakeType stakeType;
        uint256 amount;
        uint256 lockPeriod;
        uint256 stakedAt;
        uint256 unlocksAt;
        bool active;
        uint256 rewards;
        bool slashed;
    }