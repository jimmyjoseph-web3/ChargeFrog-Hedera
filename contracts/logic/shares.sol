// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Shares.sol
 * @notice Optional analytics layer for tracking investments and claims across all stations.
 * Does NOT hold any funds — purely informational for dashboards or reporting.
 */
contract Shares is Ownable {
    struct InvestorStat {
        uint256 totalInvested;
        uint256 totalClaimed;
    } 

    mapping(address => InvestorStat) public investors;
    mapping(uint256 => uint256) public stationTotals; // stationId -> total invested

    address public registry;

    event InvestmentTracked(address indexed investor, uint256 indexed stationId, uint256 amount);
    event ClaimTracked(address indexed investor, uint256 indexed stationId, uint256 claimedAmount);

    error NotAuthorized();

    constructor(address _registry) {
        registry = _registry;
    }

    modifier onlyStationOrOwner() {
        // registry or owner (admin) can record data; registry ensures legitimate Station contracts
        if (msg.sender != owner() && msg.sender != registry) revert NotAuthorized();
        _;
    }

    /**
     * @notice Record investment updates from Station contract.
     * @param investor address of user investing
     * @param stationId id of station
     * @param amount tinybars invested
     */
    function recordInvestment(address investor, uint256 stationId, uint256 amount) external onlyStationOrOwner {
        investors[investor].totalInvested += amount;
        stationTotals[stationId] += amount;
        emit InvestmentTracked(investor, stationId, amount);
    }

    /**
     * @notice Record claim updates from Station contract.
     * @param investor address of user
     * @param stationId id of station
     * @param amount claimed in tinybars
     */
    function recordClaim(address investor, uint256 stationId, uint256 amount) external onlyStationOrOwner {
        investors[investor].totalClaimed += amount;
        emit ClaimTracked(investor, stationId, amount);
    }

    /** @notice Total invested across all stations for a given investor */
    function investedAcrossAll(address investor) external view returns (uint256) {
        return investors[investor].totalInvested;
    }

    /** @notice Total claimed across all stations for a given investor */
    function claimedAcrossAll(address investor) external view returns (uint256) {
        return investors[investor].totalClaimed;
    }

    /** @notice Update registry (admin only) */
    function setRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "invalid registry");
        registry = _registry;
    }
}
