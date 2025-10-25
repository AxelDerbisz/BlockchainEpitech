// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./KYCRegistry.sol";
import "./RealEstateToken.sol";

contract TradingPlatform is Ownable {
    KYCRegistry public kycRegistry;
    ISwapRouter public immutable swapRouter;
    
    mapping(address => bool) public approvedTokens;
    mapping(address => uint256) public tokenTradingFees; // in basis points
    
    uint256 public constant DEFAULT_FEE = 30; // 0.3%
    uint256 public totalFeesCollected;
    
    event TokenTraded(
        address indexed seller,
        address indexed buyer,
        address token,
        uint256 amount,
        uint256 price
    );
    
    event LimitOrderPlaced(
        uint256 orderId,
        address indexed trader,
        address token,
        uint256 amount,
        uint256 price,
        bool isBuy
    );
    
    struct LimitOrder {
        address trader;
        address token;
        uint256 amount;
        uint256 price;
        bool isBuy;
        bool isActive;
        uint256 timestamp;
    }
    
    mapping(uint256 => LimitOrder) public limitOrders;
    uint256 public nextOrderId;
    
    constructor(address _kycRegistry, address _swapRouter) {
        kycRegistry = KYCRegistry(_kycRegistry);
        swapRouter = ISwapRouter(_swapRouter);
    }
    
    modifier onlyWhitelisted() {
        require(kycRegistry.isWhitelisted(msg.sender), "Not whitelisted");
        _;
    }
    
    function placeLimitOrder(
        address token,
        uint256 amount,
        uint256 price,
        bool isBuy
    ) external onlyWhitelisted returns (uint256) {
        require(approvedTokens[token], "Token not approved for trading");
        
        uint256 orderId = nextOrderId++;
        limitOrders[orderId] = LimitOrder({
            trader: msg.sender,
            token: token,
            amount: amount,
            price: price,
            isBuy: isBuy,
            isActive: true,
            timestamp: block.timestamp
        });
        
        emit LimitOrderPlaced(orderId, msg.sender, token, amount, price, isBuy);
        return orderId;
    }
    
    function executeTrade(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint24 poolFee
    ) external onlyWhitelisted returns (uint256 amountOut) {
        require(approvedTokens[tokenIn] && approvedTokens[tokenOut], "Token not approved");
        
        // Transfer tokens from user
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        
        // Approve Uniswap router
        IERC20(tokenIn).approve(address(swapRouter), amountIn);
        
        // Set up swap parameters
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: poolFee,
                recipient: msg.sender,
                deadline: block.timestamp + 300,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });
        
        // Execute swap
        amountOut = swapRouter.exactInputSingle(params);
        
        // Calculate and collect fees
        uint256 fee = (amountOut * tokenTradingFees[tokenOut]) / 10000;
        if (fee > 0) {
            IERC20(tokenOut).transferFrom(msg.sender, address(this), fee);
            totalFeesCollected += fee;
        }
        
        return amountOut;
    }
    
    function approveToken(address token, uint256 fee) external onlyOwner {
        approvedTokens[token] = true;
        tokenTradingFees[token] = fee;
    }
}