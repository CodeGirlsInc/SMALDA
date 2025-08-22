require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const ALCHEMY_SEPOLIA_URL = process.env.ALCHEMY_SEPOLIA_URL;
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: ALCHEMY_SEPOLIA_URL,
      accounts: [SEPOLIA_PRIVATE_KEY],
    },
    etherscan: {
      apiKey: { 
        sepolia: process.env.ETHERSCAN_API_KEY 
      },
    },
  },
};
