// File: /api/auth/CheckUserName.js

import User from "../Schema/userSchema.js";
import R18Check from "../../HVM/R18Check.js";
import AddUser from "../../HVM/AddUser.js";
import JWTManager from "../../HVM/JWTManager.js";

class CheckUserName {
    constructor(dbClient) {
        this.dbClient = dbClient;
        this.jwtManager = new JWTManager();
    }

    /**
     * Validates, creates user, and sends response
     * @param {WebSocket} ws
     * @param {string} walletAddress
     * @param {string} userName
     */
    async handle(ws, walletAddress, userName) {
        try {
            const normalizedUserName = userName.trim().toLowerCase();

            if (!/^[a-zA-Z0-9\-_]+$/.test(normalizedUserName)) {
                return ws.send(JSON.stringify({
                    status: "failure",
                    message: "Please use only letters, numbers, and '-' or '_'"
                }));
            }

            const nameExists = await User.findOne({ user_name: normalizedUserName });
            if (nameExists) {
                return ws.send(JSON.stringify({
                    status: "failure",
                    message: "User name exists, please try a different user name."
                }));
            }

            const isClean = await R18Check.isAllowed(normalizedUserName);
            if (!isClean) {
                return ws.send(JSON.stringify({
                    status: "failure",
                    message: "User name is not allowed, please try a different user name."
                }));
            }

            const newUser = await AddUser.createNewUser(walletAddress, normalizedUserName);
            if (!newUser) {
                return ws.send(JSON.stringify({
                    status: "failure",
                    message: "User creation failed. Please try again."
                }));
            }

            const token = await this.jwtManager.generateToken(
                newUser.user_name,
                walletAddress
                // gameName omitted until dynamic support added
            );

            return ws.send(JSON.stringify({
                status: "success",
                message: "User name registered to the hyprmtrx network!",
                token,
                hyprmtrx_user_name: newUser.user_name
            }));
        } catch (error) {
            console.error("❌ Error in CheckUserName:", error.message);
            ws.send(JSON.stringify({
                status: "failure",
                message: "Internal server error while checking user name."
            }));
        }
    }
}

export default CheckUserName;
