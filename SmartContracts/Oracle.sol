// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RealEstateOracle is Ownable {
    struct PriceFeed {
        AggregatorV3Interface aggregator;
        uint256 lastUpdate;
        uint256 price;
        string description;
    }
    
    mapping(address => PriceFeed) public priceFeeds;
    mapping(address => uint256) public propertyPrices;
    mapping(address => uint256) public lastPropertyUpdate;
    
    uint256 public constant PRICE_VALIDITY_PERIOD = 3600; // 1 hour
    
    event PriceUpdated(address indexed asset, uint256 price, uint256 timestamp);
    event PropertyPriceUpdated(address indexed property, uint256 price, uint256 timestamp);
    
    // For real estate market indices
    address public constant REAL_ESTATE_INDEX_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419; // Example
    
    function addPriceFeed(address asset, address aggregator, string memory description) external onlyOwner {
        priceFeeds[asset] = PriceFeed({
            aggregator: AggregatorV3Interface(aggregator),
            lastUpdate: 0,
            price: 0,
            description: description
        });
    }
    
    function updatePrice(address asset) public {
        require(address(priceFeeds[asset].aggregator) != address(0), "Price feed not configured");
        
        (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeeds[asset].aggregator.latestRoundData();
        
        require(price > 0, "Invalid price");
        require(updatedAt > 0, "Round not complete");
        
        priceFeeds[asset].price = uint256(price);
        priceFeeds[asset].lastUpdate = updatedAt;
        
        emit PriceUpdated(asset, uint256(price), updatedAt);
    }
    
    function updatePropertyPrice(address property, uint256 price) external onlyOwner {
        propertyPrices[property] = price;
        lastPropertyUpdate[property] = block.timestamp;
        emit PropertyPriceUpdated(property, price, block.timestamp);
    }
    
    function getPrice(address asset) external view returns (uint256, uint256) {
        require(priceFeeds[asset].price > 0, "Price not available");
        require(
            block.timestamp - priceFeeds[asset].lastUpdate <= PRICE_VALIDITY_PERIOD,
            "Price data is stale"
        );
        return (priceFeeds[asset].price, priceFeeds[asset].lastUpdate);
    }
    
    function getPropertyPrice(address property) external view returns (uint256, uint256) {
        require(propertyPrices[property] > 0, "Property price not available");
        return (propertyPrices[property], lastPropertyUpdate[property]);
    }
    
    function isPriceValid(address asset) public view returns (bool) {
        return block.timestamp - priceFeeds[asset].lastUpdate <= PRICE_VALIDITY_PERIOD;
    }
}