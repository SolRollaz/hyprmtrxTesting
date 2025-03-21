// File: /api/auth/CheckUserName.js

import User from "../Schema/userSchema.js"; // ✅ User schema
import R18Check from "../../HVM/R18Check.js"; // ✅ R18 check

class CheckUserName {
    constructor(dbClient) {
        this.dbClient = dbClient;
    }

    /**
     * Handles checking the user name
     * @param {WebSocket} ws - active WebSocket client
     * @param {string} userName - user name to validate
     */
    async handle(ws, userName) {
        try {
            const normalizedUserName = userName.trim().toLowerCase();

            // ✅ Reject disallowed characters
            if (!/^[a-zA-Z0-9\-_]+$/.test(userName)) {
                return ws.send(JSON.stringify({
                    status: "failure",
                    message: "Please use only letters, numbers, and '-' or '_'"
                }));
            }

            // ✅ Check if user already exists
            const existingUser = await User.findOne({ user_name: normalizedUserName });
            if (existingUser) {
                return ws.send(JSON.stringify({
                    status: "failure",
                    message: "User name exists, please try a different user name."
                }));
            }

            // ✅ Check R18 filter
            const isClean = await R18Check.isAllowed(normalizedUserName);
            if (!isClean) {
                return ws.send(JSON.stringify({
                    status: "failure",
                    message: "User name is not allowed, please try a different user name."
                }));
            }

            // ✅ Valid & available
            return ws.send(JSON.stringify({
                status: "success",
                message: "User name registered to the hyprmtrx network!",
                hyprmtrx_user_name: normalizedUserName
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
