// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockLandRegistry is ERC721, Ownable {
    struct Property {
        string location;
        uint256 area;
        string propertyType;
        bool isVerified;
    }
    
    mapping(uint256 => Property) public properties;
    uint256 private _tokenIdCounter;
    
    constructor() ERC721("LandRegistry", "LAND") {
        _tokenIdCounter = 1;
    }
    
    function mintProperty(
        address to,
        string memory location,
        uint256 area,
        string memory propertyType
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        
        properties[tokenId] = Property({
            location: location,
            area: area,
            propertyType: propertyType,
            isVerified: false
        });
        
        _mint(to, tokenId);
        return tokenId;
    }
    
    function exists(uint256 tokenId) external view returns (bool) {
        return _exists(tokenId);
    }
    
    function getPropertyDetails(uint256 tokenId) external view returns (
        string memory location,
        uint256 area,
        string memory propertyType,
        bool isVerified
    ) {
        require(_exists(tokenId), "Property does not exist");
        Property memory prop = properties[tokenId];
        return (prop.location, prop.area, prop.propertyType, prop.isVerified);
    }
}
