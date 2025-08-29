// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockDocumentVerification {
    mapping(bytes32 => bool) private verifiedDocuments;
    mapping(bytes32 => address) private documentVerifiers;

    function verifyDocument(bytes32 documentHash) external view returns (bool) {
        return verifiedDocuments[documentHash];
    }

    function addDocument(bytes32 documentHash, address verifier) external {
        verifiedDocuments[documentHash] = true;
        documentVerifiers[documentHash] = verifier;
    }

    function getDocumentVerifier(bytes32 documentHash) external view returns (address) {
        return documentVerifiers[documentHash];
    }
}
