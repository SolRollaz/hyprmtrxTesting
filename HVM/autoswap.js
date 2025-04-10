// File: HVM/autoswap.js

const { ethers } = require("ethers");
const HyprmtrxTrx = require("../Schema/hyprmtrxTrxSchema");
const SystemConfig = require("../systemConfig");
const GamePrivateKeys = require("../Schema/GamePrivateKeys");
const UniswapRouterABI = require("../abi/IUniswapV2Router02.json");

const ROUTER_ADDRESSES = {
  BASE: "0x327Df1E6de05895d2ab08513aaDD9313Fe505d86", // Baseswap
  BNB: "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap
  AVAX: "0x60aE616a2155Ee3d9A68541Ba4544862310933d4" // TraderJoe
};

const STABLECOIN_ADDRESS = {
  BASE: "0xd9AaD8A0491A015fd0b38c9Aa30CAbA420163A6F", // USDbC
  BNB: "0x55d398326f99059fF775485246999027B3197955", // USDT
  AVAX: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"  // USDC.e
};

const WETH_ADDRESS = {
  BASE: "0x4200000000000000000000000000000000000006",
  BNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  AVAX: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
};

async function maybeAutoSwapGas(walletRecord) {
  const { network, token_address, wallet, eth_balance, token_balance } = walletRecord;
  const threshold = 0.003;
  const chain = network.toUpperCase();

  if (chain === "DAG" || eth_balance >= threshold || token_balance === 0) return;

  const provider = SystemConfig.providers[chain];
  const routerAddr = ROUTER_ADDRESSES[chain];
  const stableAddr = STABLECOIN_ADDRESS[chain];
  const wethAddr = WETH_ADDRESS[chain];

  if (!provider || !routerAddr || !stableAddr || !wethAddr) return;

  const pkDoc = await GamePrivateKeys.findOne({ network: chain, user: walletRecord.user });
  if (!pkDoc) return;

  const signer = new ethers.Wallet(pkDoc.private_key, provider);
  const token = new ethers.Contract(token_address, [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function balanceOf(address account) view returns (uint256)"
  ], signer);

  const router = new ethers.Contract(routerAddr, UniswapRouterABI, signer);

  try {
    const bal = await token.balanceOf(wallet);
    if (bal.isZero()) return;

    await token.approve(routerAddr, bal);

    const path = [token_address, stableAddr, wethAddr];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

    const tx = await router.swapExactTokensForETH(
      bal,
      0,
      path,
      wallet,
      deadline
    );

    await tx.wait();

    await HyprmtrxTrx.create({
      user: walletRecord.user,
      type: "auto_swap",
      timestamp: new Date(),
      data: {
        network,
        wallet,
        token_address,
        swap_path: path,
        tx_hash: tx.hash
      }
    });
  } catch (err) {
    console.error("[autoswap]", err);
  }
}

module.exports = maybeAutoSwapGas;
