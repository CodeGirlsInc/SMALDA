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

    struct Insurance {
        uint256 id;
        uint256 escrowId;
        uint256 propertyId;
        uint256 coverageAmount;
        uint256 premium;
        address beneficiary;
        bool active;
        uint256 purchasedAt;
        uint256 expiresAt;
    }

    struct FeeStructure {
        uint256 platformFeePercent; // Basis points (100 = 1%)
        uint256 escrowFeePercent;
        uint256 insurancePremiumPercent;
        uint256 disputeResolutionFee;
        uint256 minimumFee;
    }

    // State variables
    mapping(uint256 => Escrow) public escrows;
    mapping(uint256 => Stake) public stakes;
    mapping(uint256 => Insurance) public insurancePolicies;
    
    FeeStructure public feeStructure;
    uint256 public treasuryBalance;
    uint256 public insurancePool;
    
    // Staking rewards and slashing
    mapping(StakeType => uint256) public stakeRewardRates; // Basis points per year
    mapping(StakeType => uint256) public minimumStakeAmounts;
    mapping(address => uint256[]) public userStakes;

    // Events
    event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 propertyId, uint256 amount);
    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
    event EscrowReleased(uint256 indexed escrowId, uint256 amount, address recipient);
    event EscrowRefunded(uint256 indexed escrowId, uint256 amount, address recipient);
    event MilestoneCompleted(uint256 indexed escrowId, uint256 indexed milestoneId, uint256 amount);
    event ConditionMet(uint256 indexed escrowId, uint256 indexed conditionId, address verifier);
    
    event StakeCreated(uint256 indexed stakeId, address indexed staker, StakeType stakeType, uint256 amount);
    event StakeReleased(uint256 indexed stakeId, address indexed staker, uint256 amount, uint256 rewards);
    event StakeSlashed(uint256 indexed stakeId, address indexed staker, uint256 slashedAmount, string reason);
    
    event InsurancePurchased(uint256 indexed insuranceId, uint256 indexed escrowId, uint256 coverageAmount, uint256 premium);
    event InsuranceClaimed(uint256 indexed insuranceId, address indexed beneficiary, uint256 payoutAmount);
    
    event FeeCollected(uint256 amount, string feeType);
    event TreasuryWithdrawal(address indexed recipient, uint256 amount);

    constructor(
        address _landRegistry,
        address _documentVerification,
        FeeStructure memory _feeStructure
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ESCROW_AGENT_ROLE, msg.sender);
        _grantRole(FINANCIAL_ADMIN_ROLE, msg.sender);
        _grantRole(FEE_COLLECTOR_ROLE, msg.sender);

        landRegistry = ILandRegistry(_landRegistry);
        documentVerification = IDocumentVerification(_documentVerification);
        feeStructure = _feeStructure;

        // Initialize default stake parameters
        stakeRewardRates[StakeType.VERIFIER_STAKE] = 500; // 5% APY
        stakeRewardRates[StakeType.VALIDATOR_STAKE] = 800; // 8% APY
        stakeRewardRates[StakeType.INSURANCE_STAKE] = 300; // 3% APY
        stakeRewardRates[StakeType.PERFORMANCE_BOND] = 200; // 2% APY

        minimumStakeAmounts[StakeType.VERIFIER_STAKE] = 1 ether;
        minimumStakeAmounts[StakeType.VALIDATOR_STAKE] = 5 ether;
        minimumStakeAmounts[StakeType.INSURANCE_STAKE] = 10 ether;
        minimumStakeAmounts[StakeType.PERFORMANCE_BOND] = 2 ether;
    }

    // Escrow Functions
    function createEscrow(
        address _seller,
        uint256 _propertyId,
        uint256 _totalAmount,
        uint256 _deadline,
        bool _requiresInsurance,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestoneAmounts
    ) external whenNotPaused returns (uint256) {
        require(_seller != address(0), "Invalid seller address");
        require(landRegistry.isValidProperty(_propertyId), "Invalid property");
        require(landRegistry.getOwner(_propertyId) == _seller, "Seller not property owner");
        require(_totalAmount > 0, "Amount must be greater than 0");
        require(_deadline > block.timestamp, "Invalid deadline");
        require(_milestoneDescriptions.length == _milestoneAmounts.length, "Milestone arrays length mismatch");

        uint256 escrowId = _escrowIdCounter.current();
        _escrowIdCounter.increment();

        Escrow storage newEscrow = escrows[escrowId];
        newEscrow.id = escrowId;
        newEscrow.buyer = msg.sender;
        newEscrow.seller = _seller;
        newEscrow.propertyId = _propertyId;
        newEscrow.totalAmount = _totalAmount;
        newEscrow.status = EscrowStatus.CREATED;
        newEscrow.createdAt = block.timestamp;
        newEscrow.deadline = _deadline;
        newEscrow.requiresInsurance = _requiresInsurance;

        // Create milestones
        uint256 totalMilestoneAmount = 0;
        for (uint256 i = 0; i < _milestoneDescriptions.length; i++) {
            newEscrow.milestones[i] = Milestone({
                id: i,
                description: _milestoneDescriptions[i],
                amount: _milestoneAmounts[i],
                completed: false,
                completedAt: 0,
                requiredConditions: new bytes32[](0)
            });
            totalMilestoneAmount += _milestoneAmounts[i];
        }
        newEscrow.milestoneCount = _milestoneDescriptions.length;

        require(totalMilestoneAmount == _totalAmount, "Milestone amounts don't match total");

        emit EscrowCreated(escrowId, msg.sender, _seller, _propertyId, _totalAmount);
        return escrowId;
    }

    function fundEscrow(uint256 _escrowId) external payable whenNotPaused nonReentrant {
        Escrow storage escrow = escrows[_escrowId];
        require(escrow.buyer == msg.sender, "Only buyer can fund escrow");
        require(escrow.status == EscrowStatus.CREATED, "Escrow not in created status");
        require(msg.value == escrow.totalAmount, "Incorrect funding amount");

        escrow.status = EscrowStatus.FUNDED;

        // Collect platform fee
        uint256 platformFee = (msg.value * feeStructure.platformFeePercent) / 10000;
        if (platformFee < feeStructure.minimumFee) {
            platformFee = feeStructure.minimumFee;
        }
        treasuryBalance += platformFee;

        emit EscrowFunded(_escrowId, msg.value);
        emit FeeCollected(platformFee, "platform");
    }

    function completeMilestone(uint256 _escrowId, uint256 _milestoneId) 
        external 
        onlyRole(ESCROW_AGENT_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        Escrow storage escrow = escrows[_escrowId];
        require(escrow.status == EscrowStatus.FUNDED, "Escrow not funded");
        require(_milestoneId < escrow.milestoneCount, "Invalid milestone ID");
        
        Milestone storage milestone = escrow.milestones[_milestoneId];
        require(!milestone.completed, "Milestone already completed");

        // Check if all required conditions are met
        for (uint256 i = 0; i < milestone.requiredConditions.length; i++) {
            bytes32 conditionHash = milestone.requiredConditions[i];
            bool conditionMet = false;
            
            for (uint256 j = 0; j < escrow.conditionCount; j++) {
                if (keccak256(abi.encodePacked(escrow.conditions[j].description)) == conditionHash && 
                    escrow.conditions[j].met) {
                    conditionMet = true;
                    break;
                }
            }
            require(conditionMet, "Required condition not met");
        }

        milestone.completed = true;
        milestone.completedAt = block.timestamp;
        escrow.releasedAmount += milestone.amount;

        // Transfer funds to seller
        uint256 escrowFee = (milestone.amount * feeStructure.escrowFeePercent) / 10000;
        uint256 transferAmount = milestone.amount - escrowFee;
        
        treasuryBalance += escrowFee;
        payable(escrow.seller).transfer(transferAmount);

        emit MilestoneCompleted(_escrowId, _milestoneId, transferAmount);
        emit FeeCollected(escrowFee, "escrow");

        // Check if all milestones completed
        bool allCompleted = true;
        for (uint256 i = 0; i < escrow.milestoneCount; i++) {
            if (!escrow.milestones[i].completed) {
                allCompleted = false;
                break;
            }
        }