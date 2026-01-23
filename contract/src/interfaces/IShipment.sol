// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


interface IShipment {
enum ShipmentStatus {
Created,
InTransit,
Delivered,
Cancelled
}


function getShipmentStatus(uint256 shipmentId)
external
view
returns (ShipmentStatus);


function getShipmentParties(uint256 shipmentId)
external
view
returns (address shipper, address carrier);
}

```solidity
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
```


---


## 4️⃣ Tests (Skeleton)


📄 **File:** `contract/tests/EscrowPayment.t.sol` (Foundry example)


```solidity
contract EscrowPaymentTest {
function testCreateEscrowLocksFunds() public {}
function testCreateEscrowWrongAmountFails() public {}
function testReleaseAfterDelivery() public {}
function testReleaseBeforeDeliveryFails() public {}
function testRefundAfterCancellation() public {}
function testDisputeBeforeDeadline() public {}
function testDisputeAfterDeadlineFails() public {}
function testOnlyArbitratorCanResolve() public {}
}
