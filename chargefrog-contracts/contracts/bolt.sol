// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IStationFund {
    function addRevenue(uint256 boltAmount) external;
}

/**
 * @title Bolt Token
 * @notice ERC20 token used across the EV charging ecosystem.
 * - BUY: users send native coin (HBAR equivalent) to buy BOLT at EXCHANGE_RATE
 * - SPEND: users spend approved BOLT at allow-listed StationFund addresses
 * - Admin can register stations (stationId -> fundAddress)
 */
contract Bolt is ERC20, Ownable, ReentrancyGuard {
    // Pricing: 1 native HBAR => 3.0 BOLT (human units)
    uint256 public constant EXCHANGE_RATE = 3; // per 1 HBAR
    // Hedera EVM note: msg.value is denominated in tinybars (1e8 per HBAR).
    // ERC-20 uses 18 decimals. To map 1 HBAR -> 3e18 BOLT, scale by 1e10.
    uint256 private constant NATIVE_TO_TOKEN_SCALE = 10 ** 10; // 1e18 / 1e8

    // stationId => fundAddress
    mapping(uint256 => address) public stationAllowlist;

    // Events
    event BoltPurchased(address indexed buyer, uint256 amount, uint256 valuePaid);
    event StationRegistered(uint256 indexed stationId, address fundAddress);
    event BoltSpent(uint256 indexed stationId, uint256 amount);
    event TreasuryWithdraw(address indexed to, uint256 amount);

    error StationNotAllowed(uint256 stationId);

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        // owner is set by Ownable
    }

    /**
     * @notice Buy BOLT by sending native value. Mints EXCHANGE_RATE * msg.value tokens to sender.
     * @dev msg.value is interpreted as the HBAR (or native) amount in wei/tinybars.
     */
    function buyBolt() external payable nonReentrant returns (uint256) {
        require(msg.value > 0, "send native currency to buy");
        // On Hedera: msg.value in tinybars. Convert to 18-decimal token units.
        uint256 boltAmount = msg.value * EXCHANGE_RATE * NATIVE_TO_TOKEN_SCALE;
        _mint(msg.sender, boltAmount);
        emit BoltPurchased(msg.sender, boltAmount, msg.value);
        return boltAmount;
    }

    /**
     * @notice Admin-only: register a stationId with its StationFund address
     */
    function registerStation(uint256 stationId, address fundAddress) external onlyOwner {
        require(fundAddress != address(0), "invalid fund address");
        stationAllowlist[stationId] = fundAddress;
        emit StationRegistered(stationId, fundAddress);
    }

    /**
     * @notice Spend BOLT at an allow-listed station.
     * - Caller must have approved this contract to spend `amount` BOLT on their behalf.
     * - Transfers BOLT tokens from caller -> station fund
     * - Calls addRevenue(boltAmount) on the StationFund
     */
    function spendBolt(uint256 stationId, uint256 amount) external nonReentrant {
        address fund = stationAllowlist[stationId];
        if (fund == address(0)) revert StationNotAllowed(stationId);

        // Spend allowance (will revert if not enough)
        _spendAllowance(_msgSender(), address(this), amount);

        // Transfer tokens to the fund address
        _transfer(_msgSender(), fund, amount);

        // Notify station fund of revenue (bolt units)
        IStationFund(fund).addRevenue(amount);

        emit BoltSpent(stationId, amount);
    }

    /**
     * @notice Admin-only mint hook
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /** @notice Returns whether a stationId is allow-listed */
    function isAllowedStation(uint256 stationId) external view returns (bool) {
        return stationAllowlist[stationId] != address(0);
    }

    /**
     * @notice Admin: withdraw native currency (HBAR/ETH) collected from buyBolt()
     */
    function withdrawNative(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "invalid to");
        require(address(this).balance >= amount, "insufficient balance");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "transfer failed");
        emit TreasuryWithdraw(to, amount);
    }

    // Prevent accidental native transfers to this contract except via buyBolt
    receive() external payable {
        revert("use buyBolt()");
    }

    fallback() external payable {
        revert("use buyBolt()");
    }

    /**
     * @notice Convenience helper for scripts/UI to read an account's BOLT balance.
     * @dev Mirrors ERC20 balanceOf; added to satisfy deploy script expectations.
     */
    function getBalance(address account) external view returns (uint256) {
        return balanceOf(account);
    }

} 