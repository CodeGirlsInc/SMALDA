// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ILandRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
    function exists(uint256 tokenId) external view returns (bool);
    function getPropertyDetails(uint256 tokenId) external view returns (
        string memory location,
        uint256 area,
        string memory propertyType,
        bool isVerified
    );
}
