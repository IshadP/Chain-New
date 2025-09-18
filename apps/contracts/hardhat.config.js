// FILE: apps/contracts/hardhat.config.js

require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat:{
      chainId: 31337
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      // This change allows your Hardhat node to be accessible from other computers
      // on your local network, which is essential for the 3-laptop demonstration.
      hostname: "0.0.0.0"
    },
  },
};