import User from "../Schema/userSchema.js";  // Correct path for the User model
import AddUser from "../HVM/AddUser.js";  // Correct path for AddUser
import JWTManager from "../HVM/JWTManager.js";  // Correct path for JWTManager
import AuthValidator from "../HVM/AuthValidator.js";  // Correct path for AuthValidator

class MasterAuth {
    constructor() {
        this.authValidator = new AuthValidator();
        this.jwtManager = new JWTManager();
    }

    // ✅ Generates the authentication message for signing
    generateAuthMessage(walletAddress) {
        return `Sign this message to authenticate with your wallet: ${walletAddress}`;
    }

    // ✅ Verifies signed authentication message & handles user creation if necessary
    async verifySignedMessage(walletAddress, signedMessage, authType, gameName, userName) { 
        try { 
            const message = this.generateAuthMessage(walletAddress); 
            console.log(`Verifying signed message for wallet: ${walletAddress}`); 

            // ✅ Step 1: Verify wallet authentication
            const isAuthenticated = await this.authValidator.validateWallet(authType, walletAddress, signedMessage, message); 

            if (!isAuthenticated) { 
                return { status: "failure", message: "Wallet authentication failed. Please try again." }; 
            } 

            // ✅ Step 2: Check if user exists in the database
            let existingUser = await User.findOne({ "auth_wallets.ETH": walletAddress });

            if (!existingUser) { 
                console.log(`User with wallet ${walletAddress} does not exist. Creating new user...`);

                // ✅ Step 3: Create the user
                existingUser = await AddUser.createNewUser(walletAddress, userName);

                if (!existingUser) {
                    return { status: "failure", message: "User creation failed." };
                }
            } 

            // ✅ Step 4: Generate JWT token for the user
            const token = await this.jwtManager.generateToken(existingUser.user_name, walletAddress, gameName); 
            console.log("Wallet successfully authenticated and token generated:", token); 

            return { 
                status: "success", 
                message: "Wallet successfully authenticated and user created (if necessary).", 
                token, 
            }; 
        } catch (error) { 
            console.error("Error verifying signed message:", error.message); 
            return { status: "failure", message: "Internal server error during authentication." }; 
        } 
    }
}

export default MasterAuth;
