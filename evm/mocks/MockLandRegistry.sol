// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockLandRegistry {
    mapping(uint256 => address) private owners;
    mapping(uint256 => bool) private validProperties;

    constructor() {
        // Initialize some test properties
        validProperties[1] = true;
        validProperties[2] = true;
        validProperties[3] = true;
        
        owners[1] = msg.sender;
        owners[2] = msg.sender;
        owners[3] = msg.sender;
    }

    function transferOwnership(uint256 propertyId, address from, address to) external {
        require(owners[propertyId] == from, "Not current owner");
        owners[propertyId] = to;
    }

    function getOwner(uint256 propertyId) external view returns (address) {
        return owners[propertyId];
    }

    function isValidProperty(uint256 propertyId) external view returns (bool) {
        return validProperties[propertyId];
    }

    function addProperty(uint256 propertyId, address owner) external {
        validProperties[propertyId] = true;
        owners[propertyId] = owner;
    }
}
