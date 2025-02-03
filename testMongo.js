import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGO_URI;

async function testMongo() {
    try {
        console.log("Connecting to MongoDB...");
        const client = new MongoClient(uri);
        await client.connect();
        console.log("Connected successfully to MongoDB!");
        await client.close();
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}

testMongo();

