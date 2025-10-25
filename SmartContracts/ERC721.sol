// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./KYCRegistry.sol";

contract PropertyNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    
    KYCRegistry public kycRegistry;
    Counters.Counter private _tokenIdCounter;
    
    struct Property {
        string propertyAddress;
        uint256 squareFootage;
        string propertyType;
        uint256 valuationUSD;
        uint256 yearBuilt;
        string legalDescription;
        uint256 lastValuationDate;
        bool isRented;
        uint256 monthlyRentUSD;
    }
    
    mapping(uint256 => Property) public properties;
    mapping(uint256 => uint256[]) public valuationHistory;
    
    event PropertyMinted(uint256 tokenId, string propertyAddress, uint256 valuationUSD);
    event PropertyValuationUpdated(uint256 tokenId, uint256 newValuation);
    event RentalStatusUpdated(uint256 tokenId, bool isRented, uint256 monthlyRent);
    
    constructor(address _kycRegistry) ERC721("PropertyDeed", "DEED") {
        kycRegistry = KYCRegistry(_kycRegistry);
    }
    
    function mintProperty(
        address to,
        string memory uri,
        string memory propertyAddress,
        uint256 squareFootage,
        string memory propertyType,
        uint256 valuationUSD,
        uint256 yearBuilt,
        string memory legalDescription
    ) public onlyOwner returns (uint256) {
        require(kycRegistry.isWhitelisted(to), "Recipient not whitelisted");
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        properties[tokenId] = Property({
            propertyAddress: propertyAddress,
            squareFootage: squareFootage,
            propertyType: propertyType,
            valuationUSD: valuationUSD,
            yearBuilt: yearBuilt,
            legalDescription: legalDescription,
            lastValuationDate: block.timestamp,
            isRented: false,
            monthlyRentUSD: 0
        });
        
        valuationHistory[tokenId].push(valuationUSD);
        
        emit PropertyMinted(tokenId, propertyAddress, valuationUSD);
        return tokenId;
    }
    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override {
        super._beforeTokenTransfer(from, to, tokenId);
        
        // Skip checks for minting and burning
        if (from == address(0) || to == address(0)) return;
        
        require(kycRegistry.isWhitelisted(from), "Sender not whitelisted");
        require(kycRegistry.isWhitelisted(to), "Recipient not whitelisted");
    }
    
    function updateValuation(uint256 tokenId, uint256 newValuation) external onlyOwner {
        require(_exists(tokenId), "Property does not exist");
        properties[tokenId].valuationUSD = newValuation;
        properties[tokenId].lastValuationDate = block.timestamp;
        valuationHistory[tokenId].push(newValuation);
        emit PropertyValuationUpdated(tokenId, newValuation);
    }
    
    function updateRentalStatus(uint256 tokenId, bool isRented, uint256 monthlyRent) external onlyOwner {
        require(_exists(tokenId), "Property does not exist");
        properties[tokenId].isRented = isRented;
        properties[tokenId].monthlyRentUSD = monthlyRent;
        emit RentalStatusUpdated(tokenId, isRented, monthlyRent);
    }
    
    // Required overrides
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
}