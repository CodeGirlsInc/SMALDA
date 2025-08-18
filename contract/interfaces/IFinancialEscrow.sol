// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFinancialEscrow {
    /// @notice Escrow state machine
    enum EscrowState {
        CREATED,
        FUNDED,
        DOCUMENTS_VERIFIED,
        CONDITIONS_MET,
        RELEASED,
        REFUNDED,
        CANCELLED,
        SLASHED
    }

    /// @notice Escrow struct
    struct Escrow {
        uint256 id;
        address buyer;
        address seller;
        uint256 propertyId;
        uint256 purchasePrice;
        uint256 releaseDate;
        EscrowState state;
        string conditions;
    }

    /// @notice Milestone struct
    struct Milestone {
        uint256 amount;
        uint256 dueDate;
        string description;
        bool completed;
    }

    /// @notice Stake struct
    struct Stake {
        uint256 id;
        address staker;
        uint256 amount;
        uint256 lockUntil;
        string stakeType;
        bool claimed;
        bool slashed;
    }

    /// @notice Insurance struct
    struct Insurance {
        uint256 id;
        address insured;
        uint256 propertyId;
        uint256 premium;
        uint256 coverageAmount;
        bool active;
        bool claimed;
    }

    // ----------- Custom Errors -----------
    error NotAuthorized();
    error InvalidState();
    error InvalidAmount();
    error ConditionNotMet();
    error AlreadyClaimed();
    error InsuranceInactive();
    error EscrowNotFunded();
    error StakeLocked();
    error Paused();
    error InvalidMilestone();
    error InvalidCondition();

    // ----------- Escrow -----------
    /// @notice Create a new escrow
    function createEscrow(address seller, uint256 propertyId, uint256 purchasePrice, uint256 releaseDate, string calldata conditions) external returns (uint256);
    /// @notice Fund an escrow
    function fundEscrow(uint256 escrowId) external payable;
    /// @notice Mark a condition as met
    function markConditionMet(uint256 escrowId, string calldata condition) external;
    /// @notice Update escrow conditions
    function updateEscrowConditions(uint256 escrowId, string calldata newConditions) external;
    /// @notice Release funds to seller
    function releaseFunds(uint256 escrowId) external;
    /// @notice Refund funds to buyer
    function refundFunds(uint256 escrowId) external;
    /// @notice Slash escrow (for fraud or failed milestones)
    function slashEscrow(uint256 escrowId, string calldata reason) external;
    /// @notice Get escrow details
    function getEscrow(uint256 escrowId) external view returns (Escrow memory);
    /// @notice Get all escrows for a user
    function getUserEscrows(address user) external view returns (uint256[] memory);

    // ----------- Milestones -----------
    /// @notice Add a milestone
    function addMilestone(uint256 escrowId, uint256 amount, uint256 dueDate, string calldata description) external;
    /// @notice Update a milestone
    function updateMilestone(uint256 escrowId, uint256 milestoneIndex, uint256 amount, uint256 dueDate, string calldata description) external;
    /// @notice Mark milestone as complete
    function markMilestoneComplete(uint256 escrowId, uint256 milestoneIndex) external;
    /// @notice Get milestones for an escrow
    function getMilestones(uint256 escrowId) external view returns (Milestone[] memory);

    // ----------- Staking -----------
    /// @notice Create a stake
    function createStake(uint256 amount, uint256 lockPeriod, string calldata stakeType) external returns (uint256);
    /// @notice Claim a stake
    function claimStake(uint256 stakeId) external;
    /// @notice Slash a stake
    function slashStake(uint256 stakeId, string calldata reason) external;
    /// @notice Calculate staking reward
    function calculateStakingReward(uint256 stakeId) external view returns (uint256);
    /// @notice Get all stakes for a user
    function getUserStakes(address user) external view returns (uint256[] memory);

    // ----------- Insurance -----------
    /// @notice Purchase insurance
    function purchaseInsurance(uint256 propertyId, uint256 premium, uint256 coverageAmount) external payable returns (uint256);
    /// @notice Claim insurance payout
    function claimInsurance(uint256 insuranceId, uint256 claimAmount) external;
    /// @notice Get insurance details
    function getInsurance(uint256 insuranceId) external view returns (Insurance memory);
    /// @notice Get all insurances for a user
    function getUserInsurances(address user) external view returns (uint256[] memory);

    // ----------- Pausable -----------
    /// @notice Pause contract
    function pause() external;
    /// @notice Unpause contract
    function unpause() external;
    /// @notice Returns true if contract is paused
    function paused() external view returns (bool);

    // ----------- Events -----------
    event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller);
    event EscrowFunded(uint256 indexed escrowId, address indexed buyer, uint256 amount);
    event ConditionMet(uint256 indexed escrowId, string condition);
    event EscrowConditionsUpdated(uint256 indexed escrowId, string newConditions);
    event FundsReleased(uint256 indexed escrowId, address indexed seller, uint256 amount);
    event FundsRefunded(uint256 indexed escrowId, address indexed buyer, uint256 amount);
    event EscrowSlashed(uint256 indexed escrowId, string reason);
    event MilestoneAdded(uint256 indexed escrowId, uint256 amount, uint256 dueDate, string description);
    event MilestoneUpdated(uint256 indexed escrowId, uint256 milestoneIndex, uint256 amount, uint256 dueDate, string description);
    event MilestoneCompleted(uint256 indexed escrowId, uint256 milestoneIndex);
    event StakeCreated(uint256 indexed stakeId, address indexed staker, uint256 amount, string stakeType);
    event StakeClaimed(uint256 indexed stakeId, address indexed staker, uint256 reward);
    event StakeSlashed(uint256 indexed stakeId, string reason);
    event InsurancePurchased(uint256 indexed insuranceId, address indexed insured, uint256 propertyId);
    event InsuranceClaimed(uint256 indexed insuranceId, address indexed insured, uint256 claimAmount);
    event Paused(address account);
    event Unpaused(address account);
}
