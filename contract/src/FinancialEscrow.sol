// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IFinancialEscrow.sol";

contract FinancialEscrow is IFinancialEscrow {
    // Custom errors
    error NotAuthorized();
    error InvalidState();
    error InvalidAmount();
    error ConditionNotMet();
    error AlreadyClaimed();
    error InsuranceInactive();
    error EscrowNotFunded();
    error StakeLocked();

    // Access control
    address public owner;
    mapping(address => bool) public admins;

    // Escrow storage
    uint256 private nextEscrowId = 1;
    mapping(uint256 => Escrow) private escrows;
    mapping(uint256 => Milestone[]) private milestones;
    mapping(address => uint256[]) private userEscrows;
    mapping(uint256 => mapping(string => bool)) private escrowConditionsMet;
    mapping(uint256 => bool) private escrowFunded;

    // Staking storage
    uint256 private nextStakeId = 1;
    mapping(uint256 => Stake) private stakes;
    mapping(address => uint256[]) private userStakes;

    // Insurance storage
    uint256 private nextInsuranceId = 1;
    mapping(uint256 => Insurance) private insurances;
    mapping(address => uint256[]) private userInsurances;

    // Constants
    uint256 public constant STAKING_REWARD_RATE = 5; // 5% annual
    uint256 public constant SECONDS_IN_YEAR = 365 days;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }
    modifier onlyAdmin() {
        if (!admins[msg.sender]) revert NotAuthorized();
        _;
    }
    modifier onlyBuyer(uint256 escrowId) {
        if (msg.sender != escrows[escrowId].buyer) revert NotAuthorized();
        _;
    }
    modifier onlySeller(uint256 escrowId) {
        if (msg.sender != escrows[escrowId].seller) revert NotAuthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
        admins[msg.sender] = true;
    }

    // Admin management
    function setAdmin(address admin, bool isAdmin) external onlyOwner {
        admins[admin] = isAdmin;
    }

    // Escrow
    function createEscrow(address seller, uint256 propertyId, uint256 purchasePrice, uint256 releaseDate, string calldata conditions) external override returns (uint256) {
        require(seller != address(0), "Invalid seller");
        require(purchasePrice > 0, "Price must be positive");
        require(releaseDate > block.timestamp, "Release date in past");
        uint256 escrowId = nextEscrowId++;
        escrows[escrowId] = Escrow({
            id: escrowId,
            buyer: msg.sender,
            seller: seller,
            propertyId: propertyId,
            purchasePrice: purchasePrice,
            releaseDate: releaseDate,
            state: EscrowState.CREATED,
            conditions: conditions
        });
        userEscrows[msg.sender].push(escrowId);
        userEscrows[seller].push(escrowId);
        emit EscrowCreated(escrowId, msg.sender, seller);
        return escrowId;
    }

    function fundEscrow(uint256 escrowId) external payable override onlyBuyer(escrowId) {
        Escrow storage e = escrows[escrowId];
        require(e.state == EscrowState.CREATED, "Escrow not in CREATED");
        require(msg.value == e.purchasePrice, "Incorrect amount");
        e.state = EscrowState.FUNDED;
        escrowFunded[escrowId] = true;
        emit EscrowFunded(escrowId, msg.sender, msg.value);
    }

    function markConditionMet(uint256 escrowId, string calldata condition) external override onlyBuyer(escrowId) {
        Escrow storage e = escrows[escrowId];
        require(e.state == EscrowState.FUNDED || e.state == EscrowState.DOCUMENTS_VERIFIED, "Invalid state");
        escrowConditionsMet[escrowId][condition] = true;
        e.state = EscrowState.CONDITIONS_MET;
        emit ConditionMet(escrowId, condition);
    }

    function releaseFunds(uint256 escrowId) external override onlySeller(escrowId) {
        Escrow storage e = escrows[escrowId];
        require(e.state == EscrowState.CONDITIONS_MET, "Conditions not met");
        require(block.timestamp >= e.releaseDate, "Release date not reached");
        require(escrowFunded[escrowId], "Not funded");
        e.state = EscrowState.RELEASED;
        escrowFunded[escrowId] = false;
        (bool sent, ) = e.seller.call{value: e.purchasePrice}("");
        require(sent, "Transfer failed");
        emit FundsReleased(escrowId, e.seller, e.purchasePrice);
    }

    function refundFunds(uint256 escrowId) external override onlyBuyer(escrowId) {
        Escrow storage e = escrows[escrowId];
        require(e.state == EscrowState.FUNDED, "Not funded");
        e.state = EscrowState.REFUNDED;
        escrowFunded[escrowId] = false;
        (bool sent, ) = e.buyer.call{value: e.purchasePrice}("");
        require(sent, "Refund failed");
        emit FundsRefunded(escrowId, e.buyer, e.purchasePrice);
    }

    function getEscrow(uint256 escrowId) external view override returns (Escrow memory) {
        return escrows[escrowId];
    }

    function getUserEscrows(address user) external view override returns (uint256[] memory) {
        return userEscrows[user];
    }

    // Milestones
    function addMilestone(uint256 escrowId, uint256 amount, uint256 dueDate, string calldata description) external override onlyBuyer(escrowId) {
        require(amount > 0, "Amount must be positive");
        milestones[escrowId].push(Milestone({amount: amount, dueDate: dueDate, description: description, completed: false}));
        emit MilestoneAdded(escrowId, amount, dueDate, description);
    }

    function markMilestoneComplete(uint256 escrowId, uint256 milestoneIndex) external override onlyBuyer(escrowId) {
        require(milestoneIndex < milestones[escrowId].length, "Invalid index");
        milestones[escrowId][milestoneIndex].completed = true;
        emit MilestoneCompleted(escrowId, milestoneIndex);
    }

    function getMilestones(uint256 escrowId) external view override returns (Milestone[] memory) {
        return milestones[escrowId];
    }

    // Staking
    function createStake(uint256 amount, uint256 lockPeriod, string calldata stakeType) external override returns (uint256) {
        require(amount > 0, "Amount must be positive");
        require(lockPeriod > 0, "Lock period required");
        uint256 stakeId = nextStakeId++;
        stakes[stakeId] = Stake({id: stakeId, staker: msg.sender, amount: amount, lockUntil: block.timestamp + lockPeriod, stakeType: stakeType, claimed: false});
        userStakes[msg.sender].push(stakeId);
        emit StakeCreated(stakeId, msg.sender, amount, stakeType);
        return stakeId;
    }

    function claimStake(uint256 stakeId) external override {
        Stake storage s = stakes[stakeId];
        if (msg.sender != s.staker) revert NotAuthorized();
        if (block.timestamp < s.lockUntil) revert StakeLocked();
        if (s.claimed) revert AlreadyClaimed();
        uint256 reward = calculateStakingReward(stakeId);
        s.claimed = true;
        (bool sent, ) = s.staker.call{value: s.amount + reward}("");
        require(sent, "Claim failed");
        emit StakeClaimed(stakeId, s.staker, reward);
    }

    function calculateStakingReward(uint256 stakeId) public view override returns (uint256) {
        Stake storage s = stakes[stakeId];
        if (block.timestamp < s.lockUntil) return 0;
        uint256 duration = s.lockUntil - (s.lockUntil - SECONDS_IN_YEAR);
        return (s.amount * STAKING_REWARD_RATE * duration) / (100 * SECONDS_IN_YEAR);
    }

    function getUserStakes(address user) external view override returns (uint256[] memory) {
        return userStakes[user];
    }

    // Insurance
    function purchaseInsurance(uint256 propertyId, uint256 premium, uint256 coverageAmount) external payable override returns (uint256) {
        require(msg.value == premium, "Incorrect premium");
        require(coverageAmount > 0, "Coverage required");
        uint256 insuranceId = nextInsuranceId++;
        insurances[insuranceId] = Insurance({id: insuranceId, insured: msg.sender, propertyId: propertyId, premium: premium, coverageAmount: coverageAmount, active: true});
        userInsurances[msg.sender].push(insuranceId);
        emit InsurancePurchased(insuranceId, msg.sender, propertyId);
        return insuranceId;
    }

    function getInsurance(uint256 insuranceId) external view override returns (Insurance memory) {
        return insurances[insuranceId];
    }

    function getUserInsurances(address user) external view override returns (uint256[] memory) {
        return userInsurances[user];
    }

    // Fallback to receive ether
    receive() external payable {}
}
