// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFinancialEscrow {
    enum EscrowState {
        CREATED,
        FUNDED,
        DOCUMENTS_VERIFIED,
        CONDITIONS_MET,
        RELEASED,
        REFUNDED,
        CANCELLED
    }

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

    struct Milestone {
        uint256 amount;
        uint256 dueDate;
        string description;
        bool completed;
    }

    struct Stake {
        uint256 id;
        address staker;
        uint256 amount;
        uint256 lockUntil;
        string stakeType;
        bool claimed;
    }

    struct Insurance {
        uint256 id;
        address insured;
        uint256 propertyId;
        uint256 premium;
        uint256 coverageAmount;
        bool active;
    }

    // Escrow
    function createEscrow(address seller, uint256 propertyId, uint256 purchasePrice, uint256 releaseDate, string calldata conditions) external returns (uint256);
    function fundEscrow(uint256 escrowId) external payable;
    function markConditionMet(uint256 escrowId, string calldata condition) external;
    function releaseFunds(uint256 escrowId) external;
    function refundFunds(uint256 escrowId) external;
    function getEscrow(uint256 escrowId) external view returns (Escrow memory);
    function getUserEscrows(address user) external view returns (uint256[] memory);

    // Milestones
    function addMilestone(uint256 escrowId, uint256 amount, uint256 dueDate, string calldata description) external;
    function markMilestoneComplete(uint256 escrowId, uint256 milestoneIndex) external;
    function getMilestones(uint256 escrowId) external view returns (Milestone[] memory);

    // Staking
    function createStake(uint256 amount, uint256 lockPeriod, string calldata stakeType) external returns (uint256);
    function claimStake(uint256 stakeId) external;
    function calculateStakingReward(uint256 stakeId) external view returns (uint256);
    function getUserStakes(address user) external view returns (uint256[] memory);

    // Insurance
    function purchaseInsurance(uint256 propertyId, uint256 premium, uint256 coverageAmount) external payable returns (uint256);
    function getInsurance(uint256 insuranceId) external view returns (Insurance memory);
    function getUserInsurances(address user) external view returns (uint256[] memory);

    // Events
    event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller);
    event EscrowFunded(uint256 indexed escrowId, address indexed buyer, uint256 amount);
    event ConditionMet(uint256 indexed escrowId, string condition);
    event FundsReleased(uint256 indexed escrowId, address indexed seller, uint256 amount);
    event FundsRefunded(uint256 indexed escrowId, address indexed buyer, uint256 amount);
    event MilestoneAdded(uint256 indexed escrowId, uint256 amount, uint256 dueDate, string description);
    event MilestoneCompleted(uint256 indexed escrowId, uint256 milestoneIndex);
    event StakeCreated(uint256 indexed stakeId, address indexed staker, uint256 amount, string stakeType);
    event StakeClaimed(uint256 indexed stakeId, address indexed staker, uint256 reward);
    event InsurancePurchased(uint256 indexed insuranceId, address indexed insured, uint256 propertyId);
}
