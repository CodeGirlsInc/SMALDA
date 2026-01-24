// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IShipment.sol";


contract EscrowPayment is ReentrancyGuard {
enum PaymentStatus {
Pending,
Locked,
Released,
Refunded,
Disputed
}


struct Escrow {
uint256 paymentId;
uint256 shipmentId;
address payer;
address payee;
uint256 amount;
PaymentStatus status;
uint256 createdAt;
uint256 releasedAt;
uint256 disputeDeadline;
}


uint256 private paymentCounter;
address public arbitrator;
IShipment public shipmentContract;


mapping(uint256 => Escrow) private escrows;
mapping(uint256 => uint256) private shipmentToPayment;


// EVENTS
event EscrowCreated(uint256 paymentId, uint256 shipmentId, uint256 amount, address payer, address payee);
event PaymentReleased(uint256 paymentId, uint256 amount, address payee, uint256 timestamp);
event PaymentRefunded(uint256 paymentId, uint256 amount, address payer, uint256 timestamp);
event DisputeInitiated(uint256 paymentId, address initiator, string reason, uint256 timestamp);
event DisputeResolved(uint256 paymentId, bool released, uint256 timestamp);


modifier onlyArbitrator() {
require(msg.sender == arbitrator, "Not arbitrator");
_;
}


constructor(address _shipmentContract, address _arbitrator) {
require(_shipmentContract != address(0), "Invalid shipment contract");
require(_arbitrator != address(0), "Invalid arbitrator");
shipmentContract = IShipment(_shipmentContract);
arbitrator = _arbitrator;
}

/ 1️⃣ CREATE ESCROW
shipmentContract.getShipmentStatus(e.shipmentId)
== IShipment.ShipmentStatus.Cancelled,
"Shipment not cancelled"
);


e.status = PaymentStatus.Refunded;
payable(e.payer).transfer(e.amount);
emit PaymentRefunded(paymentId, e.amount, e.payer, block.timestamp);
}


// 4️⃣ INITIATE DISPUTE
function initiateDispute(uint256 paymentId, string calldata reason) external {
Escrow storage e = escrows[paymentId];
require(e.status == PaymentStatus.Locked, "Invalid status");
require(block.timestamp <= e.disputeDeadline, "Deadline passed");
require(msg.sender == e.payer || msg.sender == e.payee, "Not participant");


e.status = PaymentStatus.Disputed;
emit DisputeInitiated(paymentId, msg.sender, reason, block.timestamp);
}


// 5️⃣ RESOLVE DISPUTE
function resolveDispute(uint256 paymentId, bool releaseToCarrier)
external
nonReentrant
onlyArbitrator
{
Escrow storage e = escrows[paymentId];
require(e.status == PaymentStatus.Disputed, "Not disputed");


if (releaseToCarrier) {
e.status = PaymentStatus.Released;
payable(e.payee).transfer(e.amount);
} else {
e.status = PaymentStatus.Refunded;
payable(e.payer).transfer(e.amount);
}


emit DisputeResolved(paymentId, releaseToCarrier, block.timestamp);
}


// 6️⃣ GET PAYMENT DETAILS
function getPayment(uint256 paymentId) external view returns (Escrow memory) {
return escrows[paymentId];
}
}