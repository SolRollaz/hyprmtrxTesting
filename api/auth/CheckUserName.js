import User from "../../Schema/userSchema.js";
import R18Check from "../../HVM/R18Check.js";
import AddUser from "../../HVM/AddUser.js";
import JWTManager from "../../HVM/JWTManager.js";

class CheckUserName {
    constructor(dbClient) {
        this.dbClient = dbClient;
        this.jwtManager = new JWTManager();
    }

    /**
     * Shared validation and creation logic
     */
    async validateAndRegister(walletAddress, userName) {
        const normalizedUserName = userName.trim().toLowerCase();

        if (!/^[a-zA-Z0-9\-_]+$/.test(normalizedUserName)) {
            return {
                status: "failure",
                message: "Please use only letters, numbers, and '-' or '_'"
            };
        }

        const nameExists = await User.findOne({ user_name: normalizedUserName });
        if (nameExists) {
            return {
                status: "failure",
                message: "User name exists, please try a different user name."
            };
        }

        const isClean = await R18Check.isAllowed(normalizedUserName);
        if (!isClean) {
            return {
                status: "failure",
                message: "User name is not allowed, please try a different user name."
            };
        }

        const newUser = await AddUser.createNewUser(walletAddress, normalizedUserName);
        if (!newUser) {
            return {
                status: "failure",
                message: "User creation failed. Please try again."
            };
        }

        const token = await this.jwtManager.generateToken(
            newUser.user_name,
            walletAddress
        );

        return {
            status: "success",
            message: "User name registered to the hyprmtrx network!",
            token,
            hyprmtrx_user_name: newUser.user_name
        };
    }

    /**
     * WebSocket handler
     */
    async handle(ws, walletAddress, userName) {
        try {
            const result = await this.validateAndRegister(walletAddress, userName);
            ws.send(JSON.stringify(result));
        } catch (error) {
            console.error("❌ Error in CheckUserName:", error.message);
            ws.send(JSON.stringify({
                status: "failure",
                message: "Internal server error while checking user name."
            }));
        }
    }

    /**
     * REST handler
     */
    async handleREST(req, res) {
        try {
            const { walletAddress, userName } = req.body;
            const result = await this.validateAndRegister(walletAddress, userName);
            res.status(result.status === "success" ? 200 : 400).json(result);
        } catch (error) {
            console.error("❌ REST Error in CheckUserName:", error.message);
            res.status(500).json({
                status: "failure",
                message: "Internal server error while checking user name."
            });
        }
    }
}

export default CheckUserName;
