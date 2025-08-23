// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DocumentVerification {
    address public landRegistry;

    // sample roles
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant AI_ORACLE_ROLE = keccak256("AI_ORACLE_ROLE");
    bytes32 public constant DOCUMENT_ADMIN_ROLE = keccak256("DOCUMENT_ADMIN_ROLE");

    constructor(address _landRegistry) {
        landRegistry = _landRegistry;
    }
}