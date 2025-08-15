// ================ Environment Variables Validation Utility ===================
// File: src/utils/validateEnvironmentVariables.utils.js

/**
 * Validates that all required environment variables are present and not empty
 * Throws an error if any required variables are missing
 * 
 * @throws {Error} If any required environment variables are missing
 */
const validateEnvironmentVariables = () => {
    const required = [
        'PORT',
        'NODE_ENV',
        'DEV_MONGODB_URI',
        'JWT_SECRET_KEY',
        'GEMINI_API_KEY',
        'DEV_EMBEDDING_MODEL',
        'DEV_GENERATIVE_MODEL',
        'MILVUS_ENDPOINT_ADDRESS',
        'MILVUS_TOKEN',
        'ASSEMBLYAI_API_KEY'
    ];

    const optional = [
        'HUGGING_FACE_TOKEN' // For CLIP visual embeddings
    ];

    const missing = required.filter(key => !process.env[key]?.trim());

    if (missing.length > 0) {
        console.error('❌ Missing Environment Variables:');
        missing.forEach(key => {
            console.error(`   - ${key}`);
        });
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Log optional variables
    optional.forEach(key => {
        if (process.env[key]) {
            console.log(`✅ Optional variable found: ${key}`);
        } else {
            console.log(`⚠️  Optional variable not set: ${key} (will use fallback methods)`);
        }
    });

    // Optional: Validate specific formats
    validateSpecificFormats();
    
    console.log('✅ All required environment variables are present');
};

/**
 * Validates specific environment variable formats
 * Provides helpful warnings for common configuration issues
 */
const validateSpecificFormats = () => {
    const warnings = [];
    
    // Validate PORT
    const port = process.env.PORT;
    if (port && (isNaN(port) || port < 1 || port > 65535)) {
        warnings.push(`PORT should be a number between 1-65535, got: ${port}`);
    }
    
    // Validate NODE_ENV
    const nodeEnv = process.env.NODE_ENV;
    const validEnvs = ['development', 'production', 'test'];
    if (nodeEnv && !validEnvs.includes(nodeEnv.toLowerCase())) {
        warnings.push(`NODE_ENV should be one of: ${validEnvs.join(', ')}, got: ${nodeEnv}`);
    }
    
    // Validate MongoDB URI format
    const mongoUri = process.env.DEV_MONGODB_URI;
    if (mongoUri && !mongoUri.startsWith('mongodb')) {
        warnings.push('DEV_MONGODB_URI should start with "mongodb://" or "mongodb+srv://"');
    }
    
    // Validate Milvus endpoint
    const milvusEndpoint = process.env.MILVUS_ENDPOINT_ADDRESS;
    if (milvusEndpoint && !milvusEndpoint.startsWith('http')) {
        warnings.push('MILVUS_ENDPOINT_ADDRESS should start with "http://" or "https://"');
    }
    
    // Validate embedding model format
    const embeddingModel = process.env.DEV_EMBEDDING_MODEL;
    if (embeddingModel && !embeddingModel.includes('embedding')) {
        warnings.push('DEV_EMBEDDING_MODEL should contain "embedding" (e.g., "models/embedding-001")');
    }
    
    // Display warnings
    if (warnings.length > 0) {
        console.warn('⚠️  Environment Variable Warnings:');
        warnings.forEach(warning => {
            console.warn(`   - ${warning}`);
        });
    }
};

/**
 * Gets environment-specific configuration
 * Useful for different settings based on NODE_ENV
 * 
 * @returns {Object} Environment-specific configuration
 */
const getEnvironmentConfig = () => {
    const env = process.env.NODE_ENV?.toLowerCase() || 'development';
    
    const config = {
        isDevelopment: env === 'development',
        isProduction: env === 'production',
        isTest: env === 'test',
        port: parseInt(process.env.PORT) || 3000,
        mongoUri: process.env.DEV_MONGODB_URI,
        jwtSecret: process.env.JWT_SECRET_KEY,
        geminiApiKey: process.env.GEMINI_API_KEY,
        embeddingModel: process.env.DEV_EMBEDDING_MODEL,
        generativeModel: process.env.DEV_GENERATIVE_MODEL,
        milvusEndpoint: process.env.MILVUS_ENDPOINT_ADDRESS,
        milvusToken: process.env.MILVUS_TOKEN,
        openaiApiKey: process.env.OPENAI_API_KEY,
        huggingFaceToken: process.env.HUGGING_FACE_TOKEN
    };
    
    return config;
};

/**
 * Validates environment variables and returns config
 * Convenience function that combines validation and config retrieval
 * 
 * @returns {Object} Environment configuration
 */
const validateAndGetConfig = () => {
    validateEnvironmentVariables();
    return getEnvironmentConfig();
};

// ✅ FIXED: Using CommonJS exports instead of ES6 export
module.exports = {
    validateEnvironmentVariables,
    validateSpecificFormats,
    getEnvironmentConfig,
    validateAndGetConfig
};

// ================ Usage Examples ===================
/*
// Basic validation
const { validateEnvironmentVariables } = require('./validateEnvironmentVariables.utils');
validateEnvironmentVariables();

// Get configuration after validation
const { validateAndGetConfig } = require('./validateEnvironmentVariables.utils');
const config = validateAndGetConfig();
console.log('Server port:', config.port);

// Get environment-specific settings
const { getEnvironmentConfig } = require('./validateEnvironmentVariables.utils');
const config2 = getEnvironmentConfig();
if (config2.isDevelopment) {
    console.log('Running in development mode');
}
*/