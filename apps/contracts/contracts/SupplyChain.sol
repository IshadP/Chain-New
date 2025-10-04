// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SupplyChain {
    // Role mappings remain the same
    mapping(address => bool) public isManufacturer;
    mapping(address => bool) public isDistributor;
    mapping(address => bool) public isRetailer;
    enum Status { Created, InTransit, Received }

    // UPDATED: Added back ewaybillNo and currentLocation for on-chain tracking
    struct Batch {
        bytes16 batchId;
        address creator;
        address currentHolder;
        address intendedRecipient;
        string ewaybillNo; // ADDED BACK
        string currentLocation; // ADDED BACK
        Status status;
        uint256 createdAt;
        uint256 updatedAt;
    }

    struct HistoryEvent {
        uint256 timestamp;
        string eventDescription;
        string location;
        address actor;
    }

    mapping(bytes16 => Batch) public products;
    
    // NEW: Array to store all batch IDs for easy retrieval
    bytes16[] private allBatchIds;

    // Events and Modifiers remain the same...
    mapping(bytes16 => HistoryEvent[]) public batchHistory;
    event BatchCreated(bytes16 indexed batchId, address indexed creator);
    event BatchTransferred(bytes16 indexed batchId, address indexed from, address indexed to);
    event BatchReceived(bytes16 indexed batchId, address indexed receiver);
    event RoleGranted(address indexed user, string role);
    event RoleRevoked(address indexed user, string role);
    modifier onlyManufacturer() { require(isManufacturer[msg.sender], "Caller is not a manufacturer"); _; }
    modifier onlyCurrentHolder(bytes16 _batchId) { require(msg.sender == products[_batchId].currentHolder, "Caller is not the current holder"); _; }
    modifier batchExists(bytes16 _batchId) { require(products[_batchId].createdAt != 0, "Batch does not exist"); _; }
    
    // UPDATED: New modifier to check if caller has any valid role
    modifier onlyValidRole() { 
        require(isManufacturer[msg.sender] || isDistributor[msg.sender] || isRetailer[msg.sender], 
                "Caller does not have any valid role");
        _; 
    }
    
    constructor() { isManufacturer[msg.sender] = true; emit RoleGranted(msg.sender, "Manufacturer"); }
    
    function grantManufacturerRole(address _manufacturer) external { require(_manufacturer != address(0)); isManufacturer[_manufacturer] = true; emit RoleGranted(_manufacturer, "Manufacturer"); }
    function grantDistributorRole(address _distributor) external onlyManufacturer { require(_distributor != address(0)); isDistributor[_distributor] = true; emit RoleGranted(_distributor, "Distributor"); }
    function revokeDistributorRole(address _distributor) external onlyManufacturer { require(_distributor != address(0)); isDistributor[_distributor] = false; emit RoleRevoked(_distributor, "Distributor"); }
    function grantRetailerRole(address _retailer) external onlyManufacturer { require(_retailer != address(0)); isRetailer[_retailer] = true; emit RoleGranted(_retailer, "Retailer"); }
    function revokeRetailerRole(address _retailer) external onlyManufacturer { require(_retailer != address(0)); isRetailer[_retailer] = false; emit RoleRevoked(_retailer, "Retailer"); }
    
    /**
     * UPDATED
     * The function now accepts ewaybillNo and currentLocation to store them on-chain.
     */
    function createBatch(
        bytes16 _batchId,
        string memory _ewaybillNo,
        string memory _currentLocation
    ) external onlyManufacturer {
        require(_batchId != bytes16(0), "Batch ID cannot be empty");
        require(products[_batchId].createdAt == 0, "Batch ID already exists");

        products[_batchId] = Batch({
            batchId: _batchId,
            creator: msg.sender,
            currentHolder: msg.sender,
            intendedRecipient: address(0),
            ewaybillNo: _ewaybillNo, // ADDED BACK
            currentLocation: _currentLocation, // ADDED BACK
       
             status: Status.Received,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        
        // NEW: Add the new batch ID to our tracking array
        allBatchIds.push(_batchId);

         batchHistory[_batchId].push(HistoryEvent({
            timestamp: block.timestamp,
            eventDescription: "Batch Created by Manufacturer",
            location: _currentLocation,
            actor: msg.sender
        }));

        emit BatchCreated(_batchId, msg.sender);
    }
    
    // transferBatch function remains the same...
    function transferBatch(bytes16 _batchId, address _recipient) external batchExists(_batchId) onlyCurrentHolder(_batchId) onlyValidRole {
        require(_recipient != address(0), "Recipient cannot be the zero address");
        require(_recipient != msg.sender, "Cannot transfer to yourself");
        
        if (isManufacturer[msg.sender]) {
            require(isDistributor[_recipient], "Manufacturer can only transfer to distributors");
        } else if (isDistributor[msg.sender]) {
            require(isDistributor[_recipient] || isRetailer[_recipient], "Distributor can only transfer to distributors or retailers");
        } else if (isRetailer[msg.sender]) {
            require(isRetailer[_recipient], "Retailer can only transfer to other retailers");
        }
        
        Batch storage batch = products[_batchId];
        batch.intendedRecipient = _recipient;
        batch.currentHolder = address(0);
        batch.status = Status.InTransit;
        batch.updatedAt = block.timestamp;

        batchHistory[_batchId].push(HistoryEvent({
            timestamp: block.timestamp,
            eventDescription: "Batch Shipped",
            location: batch.currentLocation,
            actor: msg.sender
        }));

        emit BatchTransferred(_batchId, msg.sender, _recipient);
    }

    // receiveBatch function remains the same...
    function receiveBatch(bytes16 _batchId, string memory _currentLocation) external batchExists(_batchId) onlyValidRole {
        Batch storage batch = products[_batchId];
        require(msg.sender == batch.intendedRecipient, "Caller is not the intended recipient");
        require(batch.status == Status.InTransit, "Batch is not in transit");
        
        batch.currentHolder = msg.sender;
        batch.currentLocation = _currentLocation;
        batch.intendedRecipient = address(0);
        batch.status = Status.Received;
        batch.updatedAt = block.timestamp;

        batchHistory[_batchId].push(HistoryEvent({
            timestamp: block.timestamp,
            eventDescription: "Batch Shipped",
            location: batch.currentLocation,
            actor: msg.sender
        }));

        emit BatchReceived(_batchId, msg.sender);
    }

    function getBatch(bytes16 _batchId) external view batchExists(_batchId) returns (Batch memory) {
        return products[_batchId];
    }
    
    // NEW: Function to get all batches at once
    function getAllBatches() public view returns (Batch[] memory) {
        Batch[] memory allBatches = new Batch[](allBatchIds.length);
        for (uint i = 0; i < allBatchIds.length; i++) {
            allBatches[i] = products[allBatchIds[i]];
        }
        return allBatches;
    }

    // Helper functions getUserRole and canTransferTo remain the same...
    function getBatchHistory(bytes16 _batchId) public view returns (HistoryEvent[] memory) {
        return batchHistory[_batchId];
    }

    function getUserRole(address _user) external view returns (string memory) {
        if (isManufacturer[_user]) return "manufacturer";
        if (isDistributor[_user]) return "distributor";
        if (isRetailer[_user]) return "retailer";
        return "none";
    }
    
    function canTransferTo(address _from, address _to) external view returns (bool) {
        if (_from == _to) return false;
        if (isManufacturer[_from]) {
            return isDistributor[_to];
        } else if (isDistributor[_from]) {
            return isDistributor[_to] || isRetailer[_to];
        } else if (isRetailer[_from]) {
            return isRetailer[_to];
        }
        return false;
    }
}