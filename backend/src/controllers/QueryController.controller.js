// controllers/query.controller.js
require('dotenv').config();
const { MilvusClient } = require('@zilliz/milvus2-sdk-node');
const VideoModel = require('../models/video.model'); // Fixed: should be video.model, not pdfs.model

// Import utility functions
const { validateAndGetConfig } = require('../utils/validateEnvironmentVariables.utils');

// Get validated environment configuration
const config = validateAndGetConfig();

// ============ Google Gemini ===================
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(config.geminiApiKey);

// Collection names (should match your indexing controller)
const TEXT_COLLECTION_NAME = "video_text_embeddings";
const VISUAL_COLLECTION_NAME = "video_visual_embeddings";

// Initialize Milvus client
const milvusClient = new MilvusClient({
    address: config.milvusEndpoint,
    token: config.milvusToken,
    timeout: 60000
});

/**
 * Generate embedding for the user query
 */
const generateQueryEmbedding = async (query) => {
    try {
        console.log(`Generating embedding for query: "${query}"`);
        const embeddingModel = genAI.getGenerativeModel({ model: config.embeddingModel });
        const embeddingResult = await embeddingModel.embedContent(query);
        const values = embeddingResult.embedding?.values || embeddingResult.data?.embedding?.values;
        if (!values || !Array.isArray(values)) {
            throw new Error('Embedding generation returned invalid response');
        }
        console.log(`Generated embedding with ${values.length} dimensions`);
        return values;
    } catch (error) {
        console.error('Error generating query embedding:', error);
        throw error;
    }
};

/**
 * Search for similar text chunks in Milvus
 */
const searchSimilarTextChunks = async (queryEmbedding, videoId, limit = 10) => {
    try {
        console.log(`Searching Milvus collection: ${TEXT_COLLECTION_NAME}`);
        console.log(`Query embedding dimensions: ${queryEmbedding.length}`);
        console.log(`Filter: video_id == "${videoId}"`);
        console.log(`Limit: ${limit}`);

        // Ensure collection is loaded
        try {
            await milvusClient.loadCollection({ collection_name: TEXT_COLLECTION_NAME });
            console.log('Collection loaded successfully');
        } catch (loadError) {
            console.warn('Collection already loaded or load failed:', loadError?.message || loadError);
        }

        const searchResult = await milvusClient.search({
            collection_name: TEXT_COLLECTION_NAME,
            anns_field: 'embedding',
            topk: limit,
            metric_type: 'COSINE',
            params: JSON.stringify({ nprobe: 128 }),
            vectors: [queryEmbedding],
            filter: `video_id == "${videoId}"`,
            output_fields: ["video_id", "text_chunk", "timestamp", "chunk_index"]
        });

        console.log('Search result structure:', JSON.stringify(searchResult, null, 2));
        return searchResult;
    } catch (error) {
        console.error('Error searching Milvus text collection:', error);
        throw error;
    }
};

/**
 * Search for similar visual frames in Milvus (optional - for future enhancement)
 */
const searchSimilarVisualFrames = async (queryEmbedding, videoId, limit = 5) => {
    try {
        // This would require visual query embedding generation
        // For now, we'll focus on text search
        return null;
    } catch (error) {
        console.error('Error searching Milvus visual collection:', error);
        throw error;
    }
};

/**
 * Generate AI response based on context
 */
const generateContextualResponse = async (query, contextChunks, videoMetadata) => {
    try {
        const generativeModel = genAI.getGenerativeModel({
            model: config.generativeModel
        });

        // Prepare context from search results
        const contextText = contextChunks.map((chunk, index) => {
            const timestamp = chunk.timestamp ? `[${Math.floor(chunk.timestamp / 60)}:${(chunk.timestamp % 60).toFixed(0).padStart(2, '0')}]` : '[No timestamp]';
            return `Context ${index + 1} ${timestamp}: ${chunk.text_chunk}`;
        }).join('\n\n');

        const prompt = `You are an intelligent video analysis assistant. Answer the user's query based strictly on the provided context from the video transcript.

Video Information:
- Title: ${videoMetadata.original_name || 'Unknown'}
- Duration: ${videoMetadata.duration ? `${Math.floor(videoMetadata.duration / 60)}:${(videoMetadata.duration % 60).toFixed(0).padStart(2, '0')}` : 'Unknown'}

Context from Video Transcript:
${contextText}

User Query: "${query}"

Instructions:
1. Answer based ONLY on the provided transcript context
2. If timestamps are available, reference them in your response
3. If the context doesn't contain sufficient information, clearly state: "I cannot find enough information about '${query}' in this video transcript."
4. Be specific and cite relevant parts of the transcript
5. Provide a helpful and comprehensive answer when possible

Answer:`;

        const result = await generativeModel.generateContent({
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            ]
        });

        return result.response.text();
    } catch (error) {
        console.error('Error generating contextual response:', error);
        throw error;
    }
};

/**
 * Main Query Controller
 */
const QueryController = async (req, res) => {
    try {
        console.log('Request received to query the vector database');

        // Extract UUID from URL parameters
        const { uuid } = req.params;
        const { query, limit = 10, include_visual = false } = req.body;

        console.log(`Query parameters:`, { uuid, query, limit, include_visual });

        // Validate input
        if (!uuid || typeof uuid !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Valid Video UUID is required in the URL'
            });
        }

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid query is required in request body'
            });
        }

        // Step 1: Verify video exists and is indexed
        console.log(`Looking up video with UUID: ${uuid}`);
        const videoRecord = await VideoModel.findOne({ uuid: uuid });

        if (!videoRecord) {
            return res.status(404).json({
                success: false,
                message: 'Video not found with the provided UUID'
            });
        }

        console.log(`Video found:`, {
            uuid: videoRecord.uuid,
            title: videoRecord.original_name,
            is_indexed: videoRecord.is_indexed,
            indexing_status: videoRecord.indexing_status
        });

        if (!videoRecord.is_indexed || videoRecord.indexing_status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Video is not yet indexed or indexing failed. Please wait for indexing to complete.',
                indexing_status: videoRecord.indexing_status
            });
        }

        // Step 2: Convert the query into vector embedding using Gemini
        console.log('Generating query embedding...');
        const queryVectorEmbedding = await generateQueryEmbedding(query);
        console.log('✅ Query vector embedding generated');

        // Step 3: Search Milvus vector database for relevant chunks (filtered by UUID)
        console.log(`Searching for similar content in video: ${uuid}`);
        const milvusResponseForQuery = await searchSimilarTextChunks(
            queryVectorEmbedding,
            uuid,
            Math.min(limit, 20) // Cap at 20 results max
        );

        console.log('Raw Milvus response:', JSON.stringify(milvusResponseForQuery, null, 2));

        // Parse search results more robustly
        let results = [];
        if (milvusResponseForQuery.results && Array.isArray(milvusResponseForQuery.results)) {
            results = milvusResponseForQuery.results;
        } else if (milvusResponseForQuery.data && Array.isArray(milvusResponseForQuery.data)) {
            results = milvusResponseForQuery.data;
        } else if (Array.isArray(milvusResponseForQuery)) {
            results = milvusResponseForQuery;
        } else if (milvusResponseForQuery.results && Array.isArray(milvusResponseForQuery.results[0]?.results)) {
            results = milvusResponseForQuery.results[0].results;
        }

        console.log(`Parsed ${results.length} results from Milvus response`);

        if (!results || results.length === 0) {
            // Check if collection has any data
            try {
                const stats = await milvusClient.getCollectionStatistics({
                    collection_name: TEXT_COLLECTION_NAME
                });
                console.log('Collection statistics:', stats);

                if (stats.stats && stats.stats.length > 0) {
                    const rowCount = stats.stats.find(s => s.key === 'row_count')?.value || '0';
                    console.log(`Collection has ${rowCount} total rows`);
                }
            } catch (statsError) {
                console.error('Error getting collection statistics:', statsError);
            }

            return res.status(404).json({
                success: false,
                message: 'No relevant content found for this query in the video. The video might not contain information related to your query.',
                suggestions: [
                    'Try using different keywords',
                    'Make your query more general',
                    'Check if the video content matches your query topic'
                ],
                debug: {
                    collection_name: TEXT_COLLECTION_NAME,
                    video_id: uuid,
                    query_length: query.length,
                    embedding_dimensions: queryVectorEmbedding.length
                }
            });
        }

        // Extract relevant text from search results
        const relevantChunks = results.map(result => {
            const text = result.text_chunk || result.fields?.text_chunk || result.entity?.text_chunk;
            const timestamp = result.timestamp || result.fields?.timestamp || result.entity?.timestamp;
            const score = result.score || result.distance;
            const chunkIndex = result.chunk_index || result.fields?.chunk_index || result.entity?.chunk_index;

            return {
                text_chunk: text,
                timestamp: timestamp,
                similarity_score: score,
                chunk_index: chunkIndex
            };
        }).filter(r => r.text_chunk && r.text_chunk.trim().length > 0);

        console.log(`Found ${relevantChunks.length} relevant chunks after filtering`);

        if (relevantChunks.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Search returned results but no valid text chunks found.',
                debug: {
                    total_results: results.length,
                    results_sample: results.slice(0, 2)
                }
            });
        }

        // Step 4: Generate an answer based on the context and query
        console.log('Generating contextual response...');
        const aiResponse = await generateContextualResponse(
            query,
            relevantChunks,
            videoRecord
        );

        console.log('✅ Generated answer for Video UUID:', uuid);

        // Step 5: Return the answer with metadata
        res.status(200).json({
            success: true,
            message: 'Query processed successfully',
            data: {
                query: query,
                video_info: {
                    uuid: videoRecord.uuid,
                    title: videoRecord.original_name,
                    duration: videoRecord.duration,
                    file_size: videoRecord.size,
                    indexed_at: videoRecord.updatedAt
                },
                ai_response: aiResponse,
                context_used: {
                    total_chunks_found: relevantChunks.length,
                    chunks: relevantChunks.map(chunk => ({
                        text: chunk.text_chunk.substring(0, 200) + '...', // First 200 chars
                        timestamp: chunk.timestamp,
                        similarity_score: Math.round(chunk.similarity_score * 100) / 100,
                        timestamp_formatted: chunk.timestamp ?
                            `${Math.floor(chunk.timestamp / 60)}:${(chunk.timestamp % 60).toFixed(0).padStart(2, '0')}` :
                            null
                    }))
                },
                search_metadata: {
                    query_processed_at: new Date().toISOString(),
                    search_type: 'semantic_similarity',
                    collection_searched: TEXT_COLLECTION_NAME,
                    embedding_model: config.embeddingModel,
                    generative_model: config.generativeModel
                }
            }
        });

    } catch (error) {
        console.error('❌ Error in QueryController:', error);

        // Specific error handling
        if (error.message.includes('Milvus')) {
            return res.status(500).json({
                success: false,
                message: 'Vector database error. Please try again later.',
                error: config.isDevelopment ? error.message : 'Database connection issue'
            });
        }

        if (error.message.includes('Gemini') || error.message.includes('API')) {
            return res.status(500).json({
                success: false,
                message: 'AI service error. Please try again later.',
                error: config.isDevelopment ? error.message : 'AI service unavailable'
            });
        }

        // General error
        res.status(500).json({
            success: false,
            message: 'Internal server error while processing query',
            error: config.isDevelopment ? error.message : 'Something went wrong'
        });
    }
};

/**
 * Test endpoint to check collection status
 */
const QueryTestController = async (req, res) => {
    try {
        console.log('Testing collection status...');
        
        // Check if collection exists
        const hasCollection = await milvusClient.hasCollection({
            collection_name: TEXT_COLLECTION_NAME
        });
        
        if (!hasCollection.value) {
            return res.status(404).json({
                success: false,
                message: `Collection ${TEXT_COLLECTION_NAME} does not exist`
            });
        }
        
        // Get collection statistics
        const stats = await milvusClient.getCollectionStatistics({
            collection_name: TEXT_COLLECTION_NAME
        });
        
        // Try to load collection
        try {
            await milvusClient.loadCollection({
                collection_name: TEXT_COLLECTION_NAME
            });
        } catch (loadError) {
            console.warn('Collection load error:', loadError?.message || loadError);
        }
        
        // Get collection description
        const description = await milvusClient.describeCollection({
            collection_name: TEXT_COLLECTION_NAME
        });
        
        // Try to get a sample of data
        let sampleData = null;
        try {
            const searchResult = await milvusClient.search({
                collection_name: TEXT_COLLECTION_NAME,
                anns_field: 'embedding',
                topk: 1,
                metric_type: 'COSINE',
                params: JSON.stringify({ nprobe: 1 }),
                vectors: [new Array(3072).fill(0.1)], // Test vector
                output_fields: ["video_id", "text_chunk", "timestamp", "chunk_index"]
            });
            sampleData = searchResult;
        } catch (searchError) {
            console.warn('Sample search error:', searchError?.message || searchError);
        }
        
        res.status(200).json({
            success: true,
            collection_name: TEXT_COLLECTION_NAME,
            exists: hasCollection.value,
            statistics: stats,
            description: description,
            row_count: stats.stats?.find(s => s.key === 'row_count')?.value || '0',
            sample_search: sampleData,
            debug_info: {
                collection_id: description.collectionID,
                schema_fields: description.schema?.fields?.map(f => ({
                    name: f.name,
                    type: f.data_type,
                    dim: f.type_params?.find(p => p.key === 'dim')?.value || f.dim
                }))
            }
        });
        
    } catch (error) {
        console.error('Error in QueryTestController:', error);
        res.status(500).json({
            success: false,
            message: 'Error testing collection',
            error: error.message
        });
    }
};

/**
 * Health check for query service dependencies
 */
const QueryHealthController = async (req, res) => {
    try {
        // Check Milvus connection
        const collections = await milvusClient.showCollections();
        const milvusHealthy = collections && collections.collection_names.includes(TEXT_COLLECTION_NAME);

        // Check Gemini API (simple test)
        const testModel = genAI.getGenerativeModel({ model: config.embeddingModel });
        await testModel.embedContent("test");

        res.status(200).json({
            success: true,
            message: 'Query service is healthy',
            services: {
                milvus: milvusHealthy ? 'healthy' : 'unhealthy',
                gemini: 'healthy',
                collections: {
                    text_collection: TEXT_COLLECTION_NAME,
                    visual_collection: VISUAL_COLLECTION_NAME
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Query service health check failed',
            error: config.isDevelopment ? error.message : 'Service unavailable'
        });
    }
};

module.exports = {
    QueryController,
    QueryHealthController,
    QueryTestController
};