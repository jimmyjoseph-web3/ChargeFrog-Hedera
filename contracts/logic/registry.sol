// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Registry
 * @notice Global controller + station metadata hub
 * - Tracks station fundraising targets, progress, activation
 * - Links stationId -> StationFund address
 * - Admin (owner) creates stations and updates progress
 */
contract Registry is Ownable {
    struct Station {
        uint256 id;
        uint256 totalInvestment; // HBAR goal (tinybar precision)
        uint256 raisedAmount;    // total raised (tinybars)
        uint256 totalShares;     // optional reference
        bool active;
        address fundAddress;     // StationFund address
        bytes stationMetadata;    // IPFS or metadata
    }

    mapping(uint256 => Station) public stations;
    uint256 public nextId;

    // Per-station admin who can operate specific actions on behalf of the owner
    mapping(uint256 => address) public stationAdmin;

    // Registry-level admin (optional) who can perform owner-authorized actions
    address public admin;

    // Events
    event StationCreated(uint256 indexed stationId, uint256 totalInvestment, uint256 totalShares, address fundAddress);
    event InvestmentRecorded(uint256 indexed stationId, uint256 amount);
    event StationActivated(uint256 indexed stationId);
    event StationAdminInitialized(uint256 indexed stationId, address admin);
    event AdminInitialized(address admin);

    error StationDoesNotExist(uint256 stationId);
    error StationAlreadyExists(uint256 stationId);
    error ExceedsTarget(uint256 stationId, uint256 attempted, uint256 target);
    error AlreadyInitialized(uint256 stationId);
    error AdminAlreadyInitialized();

    modifier stationExists(uint256 stationId) {
        if (stations[stationId].fundAddress == address(0) && stations[stationId].id != stationId) {
            revert StationDoesNotExist(stationId);
        }
        _;
    }

    modifier onlyAdminOrOwner(uint256 stationId) {
        if (msg.sender != owner() && msg.sender != stationAdmin[stationId] && msg.sender != admin) {
            revert("not owner/admin");
        }
        _;
    }

    modifier onlyOwnerOrAdmin() {
        if (msg.sender != owner() && msg.sender != admin) {
            revert("not owner/admin");
        }
        _;
    }

    constructor() {
        nextId = 1; // start IDs at 1
    }

    /**
     * @notice Initialize a registry-level admin. Owner-only, one-time.
     */
    function initializeAdmin(address _admin) external onlyOwner {
        require(_admin != address(0), "invalid admin");
        if (admin != address(0)) revert AdminAlreadyInitialized();
        admin = _admin;
        emit AdminInitialized(_admin);
    }

    /**
     * @notice Create a new station record. Owner-only
     * @param totalInvestment target in tinybars
     * @param totalShares optional shares reference
     * @param stationMetadata metadata bytes
     * @param fundAddress deployed StationFund contract address
     * @return stationId assigned id
     */
    function createStation(
        uint256 totalInvestment,
        uint256 totalShares,
        bytes calldata stationMetadata,
        address fundAddress
    ) external onlyOwnerOrAdmin returns (uint256) {
        require(fundAddress != address(0), "invalid fund address");

        uint256 stationId = nextId++;

        Station memory s = Station({
            id: stationId,
            totalInvestment: totalInvestment,
            raisedAmount: 0,
            totalShares: totalShares,
            active: false,
            fundAddress: fundAddress,
            stationMetadata: stationMetadata
        });

        stations[stationId] = s;

        emit StationCreated(stationId, totalInvestment, totalShares, fundAddress);
        return stationId;
    }

    /**
     * @notice Initialize the per-station admin. Owner-only, one-time setup per station.
     * @dev Typical use: set the Station contract address so it can call updateProgress.
     */
    function initializeStationAdmin(uint256 stationId, address stationAdminAddr) external onlyOwner stationExists(stationId) {
        require(stationAdminAddr != address(0), "invalid admin");
        if (stationAdmin[stationId] != address(0)) {
            revert AlreadyInitialized(stationId);
        }
        stationAdmin[stationId] = stationAdminAddr;
        emit StationAdminInitialized(stationId, stationAdminAddr);
    }

    /**
     * @notice Record investment progress (tinybars). Owner-only.
     * @dev Ensures raisedAmount does not exceed totalInvestment
     */
    function updateProgress(uint256 stationId, uint256 amount) external onlyAdminOrOwner(stationId) stationExists(stationId) {
        Station storage s = stations[stationId];
        uint256 newRaised = s.raisedAmount + amount;
        if (newRaised > s.totalInvestment) {
            revert ExceedsTarget(stationId, newRaised, s.totalInvestment);
        }
        s.raisedAmount = newRaised;
        emit InvestmentRecorded(stationId, amount);
    }

    /**
     * @notice Mark a station active. Only allowed if fully funded.
     */
    function markActive(uint256 stationId) external onlyAdminOrOwner(stationId) stationExists(stationId) {
        Station storage s = stations[stationId];
        require(s.raisedAmount >= s.totalInvestment, "station not fully funded");
        if (!s.active) {
            s.active = true;
            emit StationActivated(stationId);
        }
    }

    /** @notice Returns whether a station is active */
    function isStationActive(uint256 stationId) public view stationExists(stationId) returns (bool) {
        return stations[stationId].active;
    } 

    /** @notice Returns the StationFund address for a station */ 
    function getStationFund(uint256 stationId) public view stationExists(stationId) returns (address) {
        return stations[stationId].fundAddress;
    }

    /** @notice Helper: how much funding remains (target - raised). */
    function fundingRemaining(uint256 stationId) public view stationExists(stationId) returns (uint256) {
        Station storage s = stations[stationId];
        if (s.raisedAmount >= s.totalInvestment) return 0;
        return s.totalInvestment - s.raisedAmount;
    }

    /** @notice Admin helper to update fund address (in case of redeploy) */
    function updateFundAddress(uint256 stationId, address newFund) external onlyAdminOrOwner(stationId) stationExists(stationId) {
        require(newFund != address(0), "invalid address");
        stations[stationId].fundAddress = newFund;
    }

    /** @notice Read full station metadata */
    function getStation(uint256 stationId) external view stationExists(stationId) returns (Station memory) {
        return stations[stationId];
    }
}
