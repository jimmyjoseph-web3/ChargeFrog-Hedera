// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IRegistry {
    function updateProgress(uint256 stationId, uint256 amount) external;
}

interface IShares {
    function recordInvestment(address investor, uint256 stationId, uint256 amount) external;
    function recordClaim(address investor, uint256 stationId, uint256 amount) external;
}

/**
 * @title StationFund (Station.sol)
 * @notice One vault per EV charging station. Holds HBAR (investments) & BOLT (revenue).
 * Handles investments, revenue tracking, and proportional HBAR claims for investors.
 */
contract Station is Ownable, ReentrancyGuard {
    uint256 public stationId;
    string public stationName;
    uint256 public totalInvestmentTarget;
    uint256 public raisedAmount; // in tinybars
    uint256 public totalRevenueBolt;
    uint256 public totalRevenueHBAR;
    bool public activeForClaim;

    mapping(address => uint256) public investedAmount;
    mapping(address => uint256) public claimedAmount;

    address public registry;
    address public boltToken;
    address public sharesTracker; // optional analytics contract

    string public projectUrl;

    event Invested(uint256 indexed stationId, address indexed investor, uint256 amount);
    event RevenueAdded(uint256 indexed stationId, uint256 boltAmount);
    event Claimed(uint256 indexed stationId, address indexed investor, uint256 claimedAmount);
    event StationToggled(uint256 indexed stationId, bool active);

    error StationInactive();
    error NothingToClaim();
    error InvalidAmount();

    modifier onlyRegistry() {
        require(msg.sender == registry, "not registry");
        _;
    }

    constructor(
        uint256 _stationId,
        uint256 _totalInvestmentTarget,
        address _registry,
        address _boltToken,
        string memory _stationName,
        string memory _projectUrl
    ) {
        require(_registry != address(0) && _boltToken != address(0), "invalid addresses");
        stationId = _stationId;
        totalInvestmentTarget = _totalInvestmentTarget;
        registry = _registry;
        boltToken = _boltToken;
        stationName = _stationName;
        projectUrl = _projectUrl;
    }

    /**
     * @notice Investors contribute HBAR until funding goal met.
     */
    function invest() external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        require(raisedAmount + msg.value <= totalInvestmentTarget, "exceeds target");

        investedAmount[msg.sender] += msg.value;
        raisedAmount += msg.value;

        // update Registry
        IRegistry(registry).updateProgress(stationId, msg.value);

        // record in optional Shares analytics
        if (sharesTracker != address(0)) {
            IShares(sharesTracker).recordInvestment(msg.sender, stationId, msg.value);
        }

        emit Invested(stationId, msg.sender, msg.value);
    }

    /**
     * @notice Called by Bolt contract when BOLT tokens are spent on this station.
     */
    function addRevenue(uint256 boltAmount) external nonReentrant {
        require(msg.sender == boltToken, "only bolt token");
        totalRevenueBolt += boltAmount;
        emit RevenueAdded(stationId, boltAmount);
    }

    /**
     * @notice Admin-only: deposit HBAR revenue (profits or returns) into the contract for investors to claim.
     */
    function depositRevenueHBAR() external payable onlyOwner {
        require(msg.value > 0, "no value sent");
        totalRevenueHBAR += msg.value;
    }

    /**
     * @notice Admin toggles whether claim() is open.
     */
    function setStationActive(bool _active) external onlyOwner {
        activeForClaim = _active;
        emit StationToggled(stationId, _active);
    }

    /**
     * @notice Investors claim proportional share of BOLT-derived revenue, valued as (totalRevenueBolt / 3) HBAR-equivalent.
     * @dev Entitlement mirrors: (investedAmount[msg.sender] * (totalRevenueBolt/3)) / totalInvestmentTarget.
     */
    function claim() external nonReentrant {
        if (!activeForClaim) revert StationInactive();

        // Preserve precision by multiplying before dividing to avoid early truncation.
        // Equivalent to: invested * (totalRevenueBolt/3) / totalInvestmentTarget,
        // but with better precision: (invested * totalRevenueBolt) / (3 * target)
        uint256 numerator = investedAmount[msg.sender] * totalRevenueBolt;
        uint256 denominator = 3 * totalInvestmentTarget;
        uint256 entitled = denominator > 0 ? (numerator / denominator) : 0;
        uint256 claimable = entitled - claimedAmount[msg.sender];
        if (claimable == 0) revert NothingToClaim();

        claimedAmount[msg.sender] += claimable;
        _safeHBARTransfer(msg.sender, claimable);

        // record claim in optional Shares contract
        if (sharesTracker != address(0)) {
            IShares(sharesTracker).recordClaim(msg.sender, stationId, claimable);
        }

        emit Claimed(stationId, msg.sender, claimable);
    }

    /** @notice Returns unclaimed HBAR amount for a given investor (based on BOLT revenue valued as bolt/3) */
    function unclaimed(address investor) external view returns (uint256) {
        uint256 numerator = investedAmount[investor] * totalRevenueBolt;
        uint256 denominator = 3 * totalInvestmentTarget;
        uint256 entitled = denominator > 0 ? (numerator / denominator) : 0;
        return entitled - claimedAmount[investor];
    }

    /** @notice Admin-only: withdraw leftover funds (safeguard) */
    function withdrawExcess(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "invalid to");
        require(address(this).balance >= amount, "insufficient balance");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    /** @notice Optional analytics hook registration */
    function setSharesTracker(address tracker) external onlyOwner {
        sharesTracker = tracker;
    }

    /** @dev Internal safety wrapper for HBAR transfers */
    function _safeHBARTransfer(address to, uint256 amount) internal {
        (bool sent, ) = payable(to).call{value: amount}("");
        require(sent, "transfer failed");
    }

    receive() external payable {}
}
