import { JsonRpcProvider } from 'ethers';
console.log("Testing ethers.js...");
const provider = new JsonRpcProvider("https://mainnet.infura.io/v3/98453e56b3db48f4b199411005d69316");
console.log("Provider initialized:", provider);
