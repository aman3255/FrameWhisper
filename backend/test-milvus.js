require('dotenv').config();
const { MilvusClient } = require('@zilliz/milvus2-sdk-node');

// Get environment config
const MILVUS_ENDPOINT_ADDRESS = process.env.MILVUS_ENDPOINT_ADDRESS;
const MILVUS_TOKEN = process.env.MILVUS_TOKEN;

if (!MILVUS_ENDPOINT_ADDRESS || !MILVUS_TOKEN) {
    console.error('❌ Milvus credentials are missing in .env');
    process.exit(1);
}

const milvusClient = new MilvusClient({
    address: MILVUS_ENDPOINT_ADDRESS,
    token: MILVUS_TOKEN,
    timeout: 60000
});

const TEXT_COLLECTION_NAME = "video_text_embeddings";
const VISUAL_COLLECTION_NAME = "video_visual_embeddings";

async function testMilvusConnection() {
    try {
        console.log('🔍 Testing Milvus connection...');
        
        // Test basic connection
        const collections = await milvusClient.showCollections();
        console.log('✅ Connected to Milvus successfully');
        console.log('📚 Available collections:', collections.collection_names || []);
        
        return true;
    } catch (error) {
        console.error('❌ Failed to connect to Milvus:', error.message);
        return false;
    }
}

async function checkCollectionStatus(collectionName) {
    try {
        console.log(`\n🔍 Checking collection: ${collectionName}`);
        
        // Check if collection exists
        const hasCollection = await milvusClient.hasCollection({
            collection_name: collectionName
        });
        
        if (!hasCollection.value) {
            console.log(`❌ Collection ${collectionName} does not exist`);
            return false;
        }
        
        console.log(`✅ Collection ${collectionName} exists`);
        
        // Get collection statistics
        const stats = await milvusClient.getCollectionStatistics({
            collection_name: collectionName
        });
        
        console.log('📊 Collection statistics:', stats);
        
        // Get collection description
        const description = await milvusClient.describeCollection({
            collection_name: collectionName
        });
        
        console.log('📋 Collection description:', JSON.stringify(description, null, 2));
        
        // Check if collection is loaded
        try {
            const loadState = await milvusClient.getLoadState({
                collection_name: collectionName
            });
            console.log('📥 Collection load state:', loadState);
        } catch (error) {
            console.log('⚠️  Could not get load state:', error.message);
        }
        
        return true;
        
    } catch (error) {
        console.error(`❌ Error checking collection ${collectionName}:`, error.message);
        return false;
    }
}

async function testSearch(collectionName, videoId) {
    try {
        console.log(`\n🔍 Testing search in ${collectionName} for video: ${videoId}`);
        
        // Try to load collection first
        try {
            await milvusClient.loadCollection({
                collection_name: collectionName
            });
            console.log('✅ Collection loaded successfully');
        } catch (error) {
            console.log('⚠️  Collection load warning:', error.message);
        }
        
        // Create a test vector (3072 dimensions for text-embedding-004)
        const testVector = new Array(3072).fill(0.1);
        
        // Test search without filter
        const searchResult = await milvusClient.search({
            collection_name: collectionName,
            anns_field: 'embedding',
            topk: 5,
            metric_type: 'COSINE',
            params: JSON.stringify({ nprobe: 128 }),
            vectors: [testVector],
            output_fields: ["video_id", "text_chunk", "timestamp", "chunk_index"]
        });
        
        console.log('🔍 Search result (no filter):', {
            total_results: searchResult.results?.length || 0,
            results: searchResult.results?.slice(0, 2) || []
        });
        
        // Test search with video filter
        const filteredSearchResult = await milvusClient.search({
            collection_name: collectionName,
            anns_field: 'embedding',
            topk: 5,
            metric_type: 'COSINE',
            params: JSON.stringify({ nprobe: 128 }),
            vectors: [testVector],
            filter: `video_id == "${videoId}"`,
            output_fields: ["video_id", "text_chunk", "timestamp", "chunk_index"]
        });
        
        console.log('🔍 Search result (with video filter):', {
            total_results: filteredSearchResult.results?.length || 0,
            results: filteredSearchResult.results?.slice(0, 2) || []
        });
        
        return true;
        
    } catch (error) {
        console.error(`❌ Error testing search in ${collectionName}:`, error.message);
        return false;
    }
}

async function createTestCollection() {
    try {
        console.log('\n🔧 Creating test collection...');
        
        const schema = [
            { name: 'id', data_type: 'VarChar', max_length: 100, is_primary_key: true },
            { name: 'video_id', data_type: 'VarChar', max_length: 100 },
            { name: 'text_chunk', data_type: 'VarChar', max_length: 5000 },
            { name: 'timestamp', data_type: 'Float' },
            { name: 'chunk_index', data_type: 'Int64' },
            { name: 'embedding', data_type: 'FloatVector', dim: 3072 }
        ];
        
        await milvusClient.createCollection({
            collection_name: TEXT_COLLECTION_NAME,
            fields: schema
        });
        
        console.log('✅ Test collection created');
        
        // Create index
        await milvusClient.createIndex({
            collection_name: TEXT_COLLECTION_NAME,
            field_name: 'embedding',
            index_type: 'IVF_FLAT',
            metric_type: 'COSINE',
            params: { nlist: 128 }
        });
        
        console.log('✅ Index created');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error creating test collection:', error.message);
        return false;
    }
}

async function insertTestData(videoId) {
    try {
        console.log('\n📝 Inserting test data...');
        
        // Create test embedding (3072 dimensions)
        const testEmbedding = new Array(3072).fill(0.1);
        
        const testData = [
            {
                id: `${videoId}_test_1`,
                video_id: videoId,
                text_chunk: "This is a test text chunk for testing the video RAG system.",
                timestamp: 0.0,
                chunk_index: 0,
                embedding: testEmbedding
            },
            {
                id: `${videoId}_test_2`,
                video_id: videoId,
                text_chunk: "Another test chunk to verify the embedding storage works correctly.",
                timestamp: 5.0,
                chunk_index: 1,
                embedding: testEmbedding
            }
        ];
        
        const insertResult = await milvusClient.insert({
            collection_name: TEXT_COLLECTION_NAME,
            data: testData
        });
        
        console.log('✅ Test data inserted:', insertResult);
        
        // Flush collection
        await milvusClient.flush({
            collection_names: [TEXT_COLLECTION_NAME]
        });
        
        console.log('✅ Collection flushed');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error inserting test data:', error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Starting Milvus diagnostic test...\n');
    
    const videoId = "f1935e9f-adee-45ad-87bd-8c1ad9cc066e"; // Your video ID
    
    try {
        // Test connection
        const connected = await testMilvusConnection();
        if (!connected) {
            process.exit(1);
        }
        
        // Check text collection
        const textCollectionExists = await checkCollectionStatus(TEXT_COLLECTION_NAME);
        
        if (!textCollectionExists) {
            console.log('\n🔧 Text collection does not exist. Creating it...');
            const created = await createTestCollection();
            if (created) {
                await insertTestData(videoId);
            }
        } else {
            // Test search functionality
            await testSearch(TEXT_COLLECTION_NAME, videoId);
        }
        
        // Check visual collection
        await checkCollectionStatus(VISUAL_COLLECTION_NAME);
        
        console.log('\n✅ Diagnostic test completed!');
        
    } catch (error) {
        console.error('\n❌ Diagnostic test failed:', error);
    } finally {
        process.exit(0);
    }
}

main();
