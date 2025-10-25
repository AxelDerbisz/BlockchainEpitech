// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract KYCRegistry is Ownable {
    mapping(address => bool) public isKYCVerified;
    mapping(address => bool) public isBlacklisted;
    mapping(address => uint256) public kycTimestamp;
    mapping(address => string) public kycLevel; // "basic", "enhanced", "institutional"
    
    event KYCVerified(address indexed user, string level, uint256 timestamp);
    event KYCRevoked(address indexed user, uint256 timestamp);
    event UserBlacklisted(address indexed user, uint256 timestamp);
    event UserWhitelisted(address indexed user, uint256 timestamp);
    
    modifier onlyKYCProvider() {
        require(kycProviders[msg.sender], "Not authorized KYC provider");
        _;
    }
    
    mapping(address => bool) public kycProviders;
    
    constructor() {
        kycProviders[msg.sender] = true;
    }
    
    function addKYCProvider(address provider) external onlyOwner {
        kycProviders[provider] = true;
    }
    
    function verifyKYC(address user, string memory level) external onlyKYCProvider {
        require(!isBlacklisted[user], "User is blacklisted");
        isKYCVerified[user] = true;
        kycLevel[user] = level;
        kycTimestamp[user] = block.timestamp;
        emit KYCVerified(user, level, block.timestamp);
    }
    
    function revokeKYC(address user) external onlyKYCProvider {
        isKYCVerified[user] = false;
        emit KYCRevoked(user, block.timestamp);
    }
    
    function blacklistUser(address user) external onlyOwner {
        isBlacklisted[user] = true;
        isKYCVerified[user] = false;
        emit UserBlacklisted(user, block.timestamp);
    }
    
    function removeFromBlacklist(address user) external onlyOwner {
        isBlacklisted[user] = false;
        emit UserWhitelisted(user, block.timestamp);
    }
    
    function isWhitelisted(address user) public view returns (bool) {
        return isKYCVerified[user] && !isBlacklisted[user];
    }
}