// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SupplyChain {
    // Roles
    address public manufacturer;
    address public distributor;
    address public retailer;

    // Product struct with lifecycle tracking
    struct Product {
        uint256 id;
        string name;
        uint256 quantity;
        address currentOwner;
        string batchNumber;
        uint256 productionDate;
        string[] history;
    }

    uint256 public nextProductId = 1;
    mapping(uint256 => Product) private products;

    // Events
    event ProductCreated(uint256 id, string name, uint256 quantity, address owner);
    event ProductUpdated(uint256 id, string action, address by);
    event ProductTransferred(uint256 id, address from, address to);

    constructor(address _distributor, address _retailer) {
        manufacturer = msg.sender;
        distributor = _distributor;
        retailer = _retailer;
    }
    
    function setDistributor(address _newDistributor) external {
        require(msg.sender == manufacturer, "Only manufacturer can change the distributor");
        distributor = _newDistributor;
    }

    function setRetailer(address _newRetailer) external {
        require(msg.sender == manufacturer, "Only manufacturer can change the retailer");
        retailer = _newRetailer;
    }

    function createProduct(string memory _name, uint256 _quantity, string memory _batchNumber) external {
        require(msg.sender == manufacturer, "Only manufacturer can create products");

        Product storage product = products[nextProductId];
        product.id = nextProductId;
        product.name = _name;
        product.quantity = _quantity;
        product.currentOwner = manufacturer;
        product.batchNumber = _batchNumber;
        product.productionDate = block.timestamp;
        product.history.push("Produced by manufacturer");

        emit ProductCreated(nextProductId, _name, _quantity, manufacturer);
        nextProductId++;
    }

    function transferProduct(uint256 _productId, address _to, string memory _action) external {
        Product storage product = products[_productId];
        require(msg.sender == product.currentOwner, "Only the current owner can transfer");
        require(_to == distributor || _to == retailer, "Invalid recipient: must be distributor or retailer");

        product.currentOwner = _to;
        product.history.push(_action);

        emit ProductTransferred(_productId, msg.sender, _to);
        emit ProductUpdated(_productId, _action, msg.sender);
    }

    function recordRetailEvent(uint256 _productId, string memory _event) external {
        require(msg.sender == retailer, "Only the retailer can record retail events");
        Product storage product = products[_productId];
        product.history.push(_event);
        emit ProductUpdated(_productId, _event, msg.sender);
    }

    // --- View Functions ---

    function getProduct(uint256 _productId)
        external
        view
        returns (
            uint256 id,
            string memory name,
            uint256 quantity,
            address currentOwner,
            string memory batchNumber,
            uint256 productionDate,
            string[] memory history
        )
    {
        Product storage product = products[_productId];
        return (
            product.id,
            product.name,
            product.quantity,
            product.currentOwner,
            product.batchNumber,
            product.productionDate,
            product.history
        );
    }
    
    // ADD THIS FUNCTION BACK
    function getProductCount() external view returns (uint256) {
        return nextProductId - 1;
    }

    function getProductHistory(uint256 _productId) external view returns (string[] memory) {
        return products[_productId].history;
    }
}

