// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./KYCRegistry.sol";

contract RealEstateToken is ERC20, Ownable {
    KYCRegistry public kycRegistry;
    
    uint256 public propertyValue; // in USD
    string public propertyAddress;
    string public propertyType; // "commercial", "residential", "industrial"
    uint256 public totalShares;
    
    mapping(address => uint256) public shareholderSince;
    mapping(address => bool) public isDividendExempt;
    
    uint256 public totalDividendsDistributed;
    uint256 public lastDividendTimestamp;
    
    event DividendDistributed(uint256 amount, uint256 timestamp);
    event PropertyValueUpdated(uint256 oldValue, uint256 newValue);
    
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalShares,
        uint256 _propertyValue,
        string memory _propertyAddress,
        string memory _propertyType,
        address _kycRegistry
    ) ERC20(_name, _symbol) {
        totalShares = _totalShares;
        propertyValue = _propertyValue;
        propertyAddress = _propertyAddress;
        propertyType = _propertyType;
        kycRegistry = KYCRegistry(_kycRegistry);
        
        _mint(msg.sender, _totalShares);
    }
    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);
        
        // Skip checks for minting and burning
        if (from == address(0) || to == address(0)) return;
        
        require(kycRegistry.isWhitelisted(from), "Sender not whitelisted");
        require(kycRegistry.isWhitelisted(to), "Recipient not whitelisted");
        
        // Track new shareholders
        if (balanceOf(to) == 0) {
            shareholderSince[to] = block.timestamp;
        }
    }
    
    function updatePropertyValue(uint256 newValue) external onlyOwner {
        emit PropertyValueUpdated(propertyValue, newValue);
        propertyValue = newValue;
    }
    
    function distributeDividends() external payable onlyOwner {
        require(msg.value > 0, "No dividends to distribute");
        totalDividendsDistributed += msg.value;
        lastDividendTimestamp = block.timestamp;
        emit DividendDistributed(msg.value, block.timestamp);
    }
    
    function getShareValue() public view returns (uint256) {
        return (propertyValue * 1e18) / totalShares;
    }
}