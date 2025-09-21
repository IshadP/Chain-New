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

    mapping(bytes16 => Batch) public products;

    // Events and Modifiers remain the same...
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

        emit BatchCreated(_batchId, msg.sender);
    }
    
    // UPDATED: Modified transferBatch to allow transfers based on current holder's role
    function transferBatch(bytes16 _batchId, address _recipient) external batchExists(_batchId) onlyCurrentHolder(_batchId) onlyValidRole {
        require(_recipient != address(0), "Recipient cannot be the zero address");
        require(_recipient != msg.sender, "Cannot transfer to yourself");
        
        // Define transfer rules based on current holder's role
        if (isManufacturer[msg.sender]) {
            // Manufacturer can only transfer to distributors
            require(isDistributor[_recipient], "Manufacturer can only transfer to distributors");
        } else if (isDistributor[msg.sender]) {
            // Distributor can transfer to other distributors or retailers
            require(isDistributor[_recipient] || isRetailer[_recipient], 
                    "Distributor can only transfer to distributors or retailers");
        } else if (isRetailer[msg.sender]) {
            // Retailers typically don't transfer further, but if they do, only to other retailers
            require(isRetailer[_recipient], "Retailer can only transfer to other retailers");
        }
        
        Batch storage batch = products[_batchId];
        batch.intendedRecipient = _recipient;
        batch.currentHolder = address(0);
        batch.status = Status.InTransit;
        batch.updatedAt = block.timestamp;
        emit BatchTransferred(_batchId, msg.sender, _recipient);
    }

    // UPDATED: Modified receiveBatch to ensure only valid roles can receive
    function receiveBatch(bytes16 _batchId) external batchExists(_batchId) onlyValidRole {
        Batch storage batch = products[_batchId];
        require(msg.sender == batch.intendedRecipient, "Caller is not the intended recipient");
        require(batch.status == Status.InTransit, "Batch is not in transit");
        
        batch.currentHolder = msg.sender;
        batch.intendedRecipient = address(0);
        batch.status = Status.Received;
        batch.updatedAt = block.timestamp;
        emit BatchReceived(_batchId, msg.sender);
    }

    function getBatch(bytes16 _batchId) external view batchExists(_batchId) returns (Batch memory) {
        return products[_batchId];
    }
    
    // HELPER: Function to check what role an address has (useful for frontend)
    function getUserRole(address _user) external view returns (string memory) {
        if (isManufacturer[_user]) return "manufacturer";
        if (isDistributor[_user]) return "distributor";
        if (isRetailer[_user]) return "retailer";
        return "none";
    }
    
    // HELPER: Function to check if a transfer is valid (useful for frontend validation)
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