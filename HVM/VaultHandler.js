import crypto from 'crypto';

class VaultHandler {
    constructor() {
        this.algorithm = 'aes-256-ctr'; // AES-256-CTR for encryption
        this.secretKey = process.env.ENCRYPTION_KEY; // Load encryption key from environment variable

        // Validate the encryption key
        if (!this.secretKey) {
            throw new Error("ENCRYPTION_KEY is not set. Ensure it is defined in your environment variables.");
        }

        if (this.secretKey.length !== 64) { // 64 hex characters = 32 bytes
            throw new Error("ENCRYPTION_KEY must be a 32-byte string (64 hex characters).");
        }

        this.secretKeyBuffer = Buffer.from(this.secretKey, 'hex'); // Convert the hex string to a buffer
    }

    /**
     * Encrypt the given private key using AES-256-CTR algorithm.
     * @param {string} privateKey - The private key to be encrypted.
     * @returns {string} - The encrypted private key, along with the IV used for encryption.
     */
    encrypt(privateKey) {
        try {
            const iv = crypto.randomBytes(16); // Generate a random 16-byte IV for encryption
            const cipher = crypto.createCipheriv(this.algorithm, this.secretKeyBuffer, iv);

            let encrypted = cipher.update(privateKey, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            // Return the IV and encrypted private key, separated by a colon
            return `${iv.toString('hex')}:${encrypted}`;
        } catch (error) {
            console.error("Encryption error:", error.message);
            throw new Error("Failed to encrypt the private key.");
        }
    }

    /**
     * Decrypt the given encrypted private key.
     * @param {string} encryptedPrivateKey - The encrypted private key (IV + encrypted key).
     * @returns {string} - The decrypted private key.
     */
    decrypt(encryptedPrivateKey) {
        try {
            const parts = encryptedPrivateKey.split(':');
            if (parts.length !== 2) {
                throw new Error("Invalid encrypted private key format. Expected IV and encrypted text separated by a colon.");
            }

            const iv = Buffer.from(parts[0], 'hex'); // Extract the IV
            const encryptedText = parts[1]; // Extract the encrypted private key

            const decipher = crypto.createDecipheriv(this.algorithm, this.secretKeyBuffer, iv);

            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted; // Return the decrypted private key
        } catch (error) {
            console.error("Decryption error:", error.message);
            throw new Error("Failed to decrypt the private key. Ensure the input is correct and the encryption key is valid.");
        }
    }
}

export default VaultHandler;
