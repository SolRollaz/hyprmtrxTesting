import qrCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

class QRCodeManager {
    constructor() {
        // Resolve the current directory using `import.meta.url`
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        // Set the QR code directory relative to the project root
        this.qrCodeDir = path.join(__dirname, "..", "QR_Codes");

        // Ensure the QR_Codes directory exists
        if (!fs.existsSync(this.qrCodeDir)) {
            fs.mkdirSync(this.qrCodeDir, { recursive: true });
            console.log(`QR_Codes directory created at: ${this.qrCodeDir}`);
        }
    }

    /**
     * Parses token details from a file name using the format:
     * TokenSymbol_NetworkCode_ContractAddress.png
     * @param {string} fileName - The file name to parse.
     * @returns {Object} - Extracted token details.
     */
    parseTokenDetailsFromFileName(fileName) {
        const match = fileName.match(/^([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)\.png$/);
        if (match) {
            const [, symbol, network, contractAddress] = match;
            return { symbol, network, contractAddress };
        }
        throw new Error(`Invalid file name format for token logo: ${fileName}`);
    }

    /**
     * Ensures the QR code directory exists.
     * Creates the directory if it does not exist.
     */
    async ensureQRCodeDirectory() {
        try {
            await fs.promises.mkdir(this.qrCodeDir, { recursive: true });
            console.log(`QR_Codes directory ensured at: ${this.qrCodeDir}`);
        } catch (error) {
            console.error("Error creating QR_Codes directory:", error.message);
            throw error;
        }
    }

    /**
     * Generates QR codes for an array of wallets.
     * Each QR code encodes wallet data including the network, address, and contract address.
     * @param {string} user_name - Name of the user.
     * @param {Array} wallets - Array of wallet objects.
     * @param {function} callback - A callback function to notify when QR code generation is complete.
     * @returns {Array} - Array of file paths for the generated QR codes.
     */
    async generateQRCodeForWallets(user_name, wallets, callback) {
        await this.ensureQRCodeDirectory(); // Ensure the directory exists
        const generatedPaths = [];

        for (const wallet of wallets) {
            try {
                if (!wallet.network || !wallet.address || !wallet.contract_address) {
                    throw new Error(`Wallet must include network, address, and contract_address. Wallet details: ${JSON.stringify(wallet)}`);
                }

                // Construct the path for the QR code file
                const qrCodePath = path.join(this.qrCodeDir, `${user_name}_${wallet.network}_${wallet.contract_address}_qrcode.png`);

                // Prepare the data to encode into the QR code
                const qrCodeData = JSON.stringify({
                    user: user_name,
                    network: wallet.network,
                    address: wallet.address,
                    contract_address: wallet.contract_address, // Include contract address
                });

                // Generate and save the QR code as an image file
                await qrCode.toFile(qrCodePath, qrCodeData, {
                    color: {
                        dark: "#000000", // Black QR code dots
                        light: "#ffffff", // White background
                    },
                });

                console.log(`QR code successfully generated for wallet (Network: ${wallet.network}, Address: ${wallet.address}): ${qrCodePath}`);
                generatedPaths.push(qrCodePath);
            } catch (error) {
                console.error(`Error generating QR code for wallet (Network: ${wallet.network}, Address: ${wallet.address}):`, error.message);
            }
        }

        // Validate and execute the callback function
        if (typeof callback === "function") {
            callback(generatedPaths); // Pass the generated paths back to MasterAuth
        } else {
            console.warn("Callback is not a function. Skipping callback execution.");
        }
    }
}

export default QRCodeManager;
