// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IFinancialEscrow.sol";

contract FinancialEscrow is IFinancialEscrow {
    // Access control
    address public owner;
    mapping(address => bool) public admins;
    bool private _paused;

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
    modifier whenNotPaused() {
        if (_paused) revert Paused();
        _;
    }
    modifier whenPaused() {
        if (!_paused) revert InvalidState();
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

    // Pausable
    function pause() external override onlyOwner {
        _paused = true;
        emit Paused(msg.sender);
    }
    function unpause() external override onlyOwner {
        _paused = false;
        emit Unpaused(msg.sender);
    }
    function paused() external view override returns (bool) {
        return _paused;
    }

    // Escrow
    function createEscrow(address seller, uint256 propertyId, uint256 purchasePrice, uint256 releaseDate, string calldata conditions) external override whenNotPaused returns (uint256) {
        if (seller == address(0)) revert InvalidAmount();
        if (purchasePrice == 0) revert InvalidAmount();
        if (releaseDate <= block.timestamp) revert InvalidAmount();
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

    function fundEscrow(uint256 escrowId) external payable override onlyBuyer(escrowId) whenNotPaused {
        Escrow storage e = escrows[escrowId];
        if (e.state != EscrowState.CREATED) revert InvalidState();
        if (msg.value != e.purchasePrice) revert InvalidAmount();
        e.state = EscrowState.FUNDED;
        escrowFunded[escrowId] = true;
        emit EscrowFunded(escrowId, msg.sender, msg.value);
    }

    function markConditionMet(uint256 escrowId, string calldata condition) external override onlyBuyer(escrowId) whenNotPaused {
        Escrow storage e = escrows[escrowId];
        if (e.state != EscrowState.FUNDED && e.state != EscrowState.DOCUMENTS_VERIFIED) revert InvalidState();
        escrowConditionsMet[escrowId][condition] = true;
        e.state = EscrowState.CONDITIONS_MET;
        emit ConditionMet(escrowId, condition);
    }

    function updateEscrowConditions(uint256 escrowId, string calldata newConditions) external override onlyBuyer(escrowId) whenNotPaused {
        Escrow storage e = escrows[escrowId];
        e.conditions = newConditions;
        emit EscrowConditionsUpdated(escrowId, newConditions);
    }

    function releaseFunds(uint256 escrowId) external override onlySeller(escrowId) whenNotPaused {
        Escrow storage e = escrows[escrowId];
        if (e.state != EscrowState.CONDITIONS_MET) revert ConditionNotMet();
        if (block.timestamp < e.releaseDate) revert InvalidState();
        if (!escrowFunded[escrowId]) revert EscrowNotFunded();
        e.state = EscrowState.RELEASED;
        escrowFunded[escrowId] = false;
        (bool sent, ) = e.seller.call{value: e.purchasePrice}("");
        if (!sent) revert InvalidState();
        emit FundsReleased(escrowId, e.seller, e.purchasePrice);
    }

    function refundFunds(uint256 escrowId) external override onlyBuyer(escrowId) whenNotPaused {
        Escrow storage e = escrows[escrowId];
        if (e.state != EscrowState.FUNDED) revert InvalidState();
        e.state = EscrowState.REFUNDED;
        escrowFunded[escrowId] = false;
        (bool sent, ) = e.buyer.call{value: e.purchasePrice}("");
        if (!sent) revert InvalidState();
        emit FundsRefunded(escrowId, e.buyer, e.purchasePrice);
    }

    function slashEscrow(uint256 escrowId, string calldata reason) external override onlyAdmin whenNotPaused {
        Escrow storage e = escrows[escrowId];
        if (e.state != EscrowState.FUNDED && e.state != EscrowState.CONDITIONS_MET) revert InvalidState();
        e.state = EscrowState.SLASHED;
        escrowFunded[escrowId] = false;
        emit EscrowSlashed(escrowId, reason);
    }

    function getEscrow(uint256 escrowId) external view override returns (Escrow memory) {
        return escrows[escrowId];
    }

    function getUserEscrows(address user) external view override returns (uint256[] memory) {
        return userEscrows[user];
    }

    // Milestones
    function addMilestone(uint256 escrowId, uint256 amount, uint256 dueDate, string calldata description) external override onlyBuyer(escrowId) whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        milestones[escrowId].push(Milestone({amount: amount, dueDate: dueDate, description: description, completed: false}));
        emit MilestoneAdded(escrowId, amount, dueDate, description);
    }

    function updateMilestone(uint256 escrowId, uint256 milestoneIndex, uint256 amount, uint256 dueDate, string calldata description) external override onlyBuyer(escrowId) whenNotPaused {
        if (milestoneIndex >= milestones[escrowId].length) revert InvalidMilestone();
        milestones[escrowId][milestoneIndex] = Milestone({amount: amount, dueDate: dueDate, description: description, completed: false});
        emit MilestoneUpdated(escrowId, milestoneIndex, amount, dueDate, description);
    }

    function markMilestoneComplete(uint256 escrowId, uint256 milestoneIndex) external override onlyBuyer(escrowId) whenNotPaused {
        if (milestoneIndex >= milestones[escrowId].length) revert InvalidMilestone();
        milestones[escrowId][milestoneIndex].completed = true;
        emit MilestoneCompleted(escrowId, milestoneIndex);
    }

    function getMilestones(uint256 escrowId) external view override returns (Milestone[] memory) {
        return milestones[escrowId];
    }

    // Staking
    function createStake(uint256 amount, uint256 lockPeriod, string calldata stakeType) external override whenNotPaused returns (uint256) {
        if (amount == 0) revert InvalidAmount();
        if (lockPeriod == 0) revert InvalidAmount();
        uint256 stakeId = nextStakeId++;
        stakes[stakeId] = Stake({id: stakeId, staker: msg.sender, amount: amount, lockUntil: block.timestamp + lockPeriod, stakeType: stakeType, claimed: false, slashed: false});
        userStakes[msg.sender].push(stakeId);
        emit StakeCreated(stakeId, msg.sender, amount, stakeType);
        return stakeId;
    }

    function claimStake(uint256 stakeId) external override whenNotPaused {
        Stake storage s = stakes[stakeId];
        if (msg.sender != s.staker) revert NotAuthorized();
        if (block.timestamp < s.lockUntil) revert StakeLocked();
        if (s.claimed) revert AlreadyClaimed();
        if (s.slashed) revert InvalidState();
        uint256 reward = calculateStakingReward(stakeId);
        s.claimed = true;
        (bool sent, ) = s.staker.call{value: s.amount + reward}("");
        if (!sent) revert InvalidState();
        emit StakeClaimed(stakeId, s.staker, reward);
    }

    function slashStake(uint256 stakeId, string calldata reason) external override onlyAdmin whenNotPaused {
        Stake storage s = stakes[stakeId];
        if (s.slashed) revert InvalidState();
        s.slashed = true;
        emit StakeSlashed(stakeId, reason);
    }

    function calculateStakingReward(uint256 stakeId) public view override returns (uint256) {
        Stake storage s = stakes[stakeId];
        if (block.timestamp < s.lockUntil || s.slashed) return 0;
        uint256 duration = s.lockUntil - (s.lockUntil - SECONDS_IN_YEAR);
        return (s.amount * STAKING_REWARD_RATE * duration) / (100 * SECONDS_IN_YEAR);
    }

    function getUserStakes(address user) external view override returns (uint256[] memory) {
        return userStakes[user];
    }

    // Insurance
    function purchaseInsurance(uint256 propertyId, uint256 premium, uint256 coverageAmount) external payable override whenNotPaused returns (uint256) {
        if (msg.value != premium) revert InvalidAmount();
        if (coverageAmount == 0) revert InvalidAmount();
        uint256 insuranceId = nextInsuranceId++;
        insurances[insuranceId] = Insurance({id: insuranceId, insured: msg.sender, propertyId: propertyId, premium: premium, coverageAmount: coverageAmount, active: true, claimed: false});
        userInsurances[msg.sender].push(insuranceId);
        emit InsurancePurchased(insuranceId, msg.sender, propertyId);
        return insuranceId;
    }

    function claimInsurance(uint256 insuranceId, uint256 claimAmount) external override whenNotPaused {
        Insurance storage ins = insurances[insuranceId];
        if (msg.sender != ins.insured) revert NotAuthorized();
        if (!ins.active || ins.claimed) revert InsuranceInactive();
        if (claimAmount > ins.coverageAmount) revert InvalidAmount();
        ins.claimed = true;
        ins.active = false;
        (bool sent, ) = ins.insured.call{value: claimAmount}("");
        if (!sent) revert InvalidState();
        emit InsuranceClaimed(insuranceId, ins.insured, claimAmount);
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
