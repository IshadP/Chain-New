// FILE: apps/contracts/contracts/SupplyChain.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SupplyChain {
    mapping(address => bool) public isManufacturer;
    mapping(address => bool) public isDistributor;
    mapping(address => bool) public isRetailer;

    enum Status { Created, InTransit, Received }

    struct Batch {
        bytes16 batchId; // CHANGED: from bytes32 to bytes16
        address creator;
        address currentHolder;
        uint256 quantity;
        string ewaybillNo;
        uint256 cost;
        string internalBatchNo;
        string currentLocation;
        Status status;
        uint256 createdAt;
        uint256 updatedAt;
    }

    mapping(bytes16 => Batch) public products; // CHANGED: Key is now bytes16

    event BatchCreated(bytes16 indexed batchId, address indexed creator, uint256 quantity); // CHANGED
    event BatchTransferred(bytes16 indexed batchId, address indexed from, address indexed to); // CHANGED
    event BatchReceived(bytes16 indexed batchId, address indexed receiver); // CHANGED
    event RoleGranted(address indexed user, string role);
    event RoleRevoked(address indexed user, string role);

    modifier onlyManufacturer() {
        require(isManufacturer[msg.sender], "Caller is not a manufacturer");
        _;
    }

    modifier onlyCurrentHolder(bytes16 _batchId) { // CHANGED
        require(msg.sender == products[_batchId].currentHolder, "Caller is not the current holder");
        _;
    }
    
    modifier batchExists(bytes16 _batchId) { // CHANGED
        require(products[_batchId].createdAt != 0, "Batch does not exist");
        _;
    }

    constructor() {
        isManufacturer[msg.sender] = true;
        emit RoleGranted(msg.sender, "Manufacturer");
    }

    // Role management functions remain the same...
    function grantManufacturerRole(address _manufacturer) external { require(_manufacturer != address(0)); isManufacturer[_manufacturer] = true; emit RoleGranted(_manufacturer, "Manufacturer"); }
    function grantDistributorRole(address _distributor) external onlyManufacturer { require(_distributor != address(0)); isDistributor[_distributor] = true; emit RoleGranted(_distributor, "Distributor"); }
    function revokeDistributorRole(address _distributor) external onlyManufacturer { require(_distributor != address(0)); isDistributor[_distributor] = false; emit RoleRevoked(_distributor, "Distributor"); }
    function grantRetailerRole(address _retailer) external onlyManufacturer { require(_retailer != address(0)); isRetailer[_retailer] = true; emit RoleGranted(_retailer, "Retailer"); }
    function revokeRetailerRole(address _retailer) external onlyManufacturer { require(_retailer != address(0)); isRetailer[_retailer] = false; emit RoleRevoked(_retailer, "Retailer"); }

    function createBatch(
        bytes16 _batchId, // CHANGED
        uint256 _quantity,
        string memory _ewaybillNo,
        uint256 _cost,
        string memory _internalBatchNo,
        string memory _currentLocation
    ) external onlyManufacturer {
        require(_batchId != bytes16(0), "Batch ID cannot be empty");
        require(products[_batchId].createdAt == 0, "Batch ID already exists");
        require(_quantity > 0, "Quantity must be greater than zero");

        products[_batchId] = Batch({
            batchId: _batchId,
            creator: msg.sender,
            currentHolder: msg.sender,
            quantity: _quantity,
            ewaybillNo: _ewaybillNo,
            cost: _cost,
            internalBatchNo: _internalBatchNo,
            currentLocation: _currentLocation,
            status: Status.Received,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        emit BatchCreated(_batchId, msg.sender, _quantity);
    }
    
    function transferBatch(bytes16 _batchId, address _newHolder) external batchExists(_batchId) onlyCurrentHolder(_batchId) { // CHANGED
        require(_newHolder != address(0));
        require(isDistributor[_newHolder] || isRetailer[_newHolder]);
        Batch storage batch = products[_batchId];
        require(batch.status == Status.Received);
        batch.currentHolder = _newHolder;
        batch.status = Status.InTransit;
        batch.updatedAt = block.timestamp;
        emit BatchTransferred(_batchId, msg.sender, _newHolder);
    }

    function receiveBatch(bytes16 _batchId) external batchExists(_batchId) onlyCurrentHolder(_batchId) { // CHANGED
        Batch storage batch = products[_batchId];
        require(batch.status == Status.InTransit);
        batch.status = Status.Received;
        batch.updatedAt = block.timestamp;
        emit BatchReceived(_batchId, msg.sender);
    }

    function getBatch(bytes16 _batchId) external view batchExists(_batchId) returns (Batch memory) { // CHANGED
        return products[_batchId];
    }
}