// =================================
const mongoose  = require('mongoose');
require('dotenv').config();
// =================================

// ========= env config =============
const NODE_ENV = process.env.NODE_ENV;
const DEV_MONGODB_URI = process.env.DEV_MONGODB_URI;
// =================================


// ========= connect to db ==========
async function connectToDB() {
    try {
        if(!DEV_MONGODB_URI){
            throw new Error(`MongoDB URI is not found in .env file`);
        }
        const connection = await mongoose.connect(DEV_MONGODB_URI);
        console.log(`Database connected successfully - ${NODE_ENV} environment`);
        return connection;
    } catch (error) {
        console.error(`Error while connecting to db ${error}`);
        process.exit(1);
    }
};
// =================================

module.exports = {
    connectToDB
};