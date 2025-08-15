# Video RAG Backend System

A multimodal RAG (Retrieval-Augmented Generation) system that processes video content, extracts key frames, transcribes audio, and enables semantic search and chat functionality.

## 🚀 Features

- **Video Processing**: Extract key frames using FFmpeg
- **Audio Transcription**: Convert video audio to text using AssemblyAI
- **Text Chunking**: Multiple strategies (standard, sentence-based, timestamp-aware)
- **Vector Embeddings**: Generate embeddings for text (Google Gemini) and visual data (CLIP via Hugging Face)
- **Vector Database**: Store and search embeddings using Zilliz/Milvus
- **Query Interface**: Chat with videos using semantic search
- **Authentication**: JWT-based security

## 🛠️ Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment variables** (`.env`):
   ```env
   PORT=4000
   NODE_ENV=development
   DEV_MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET_KEY=your_jwt_secret
   GEMINI_API_KEY=your_gemini_api_key
   DEV_EMBEDDING_MODEL=text-embedding-004
   DEV_GENERATIVE_MODEL=gemini-1.5-flash
   MILVUS_ENDPOINT_ADDRESS=your_zilliz_endpoint
   MILVUS_TOKEN=your_zilliz_token
   ASSEMBLYAI_API_KEY=your_assemblyai_api_key
   HUGGING_FACE_TOKEN=your_hf_token  # Optional, for CLIP embeddings
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

## 📡 API Endpoints

### Video Upload & Indexing
- `POST /api/v1/video/upload` - Upload and index a new video
- `GET /api/v1/video/debug/:videoId` - Debug video indexing status
- `POST /api/v1/video/reindex/:videoId` - Force reindex an existing video

### Query & Search
- `POST /api/v1/video/query/ask/:uuid` - Query a specific video
- `GET /api/v1/video/query/test` - Test collection status
- `GET /api/v1/video/query/health` - Health check

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login

## 🔍 Troubleshooting

### Issue: "No relevant content found" in queries

This usually means the video wasn't properly indexed or embeddings weren't stored. Follow these steps:

1. **Check video indexing status**:
   ```bash
   GET /api/v1/video/debug/f1935e9f-adee-45ad-87bd-8c1ad9cc066e
   ```

2. **Check collection status**:
   ```bash
   GET /api/v1/video/query/test
   ```

3. **Run Milvus diagnostic test**:
   ```bash
   node test-milvus.js
   ```

4. **Force reindex the video**:
   ```bash
   POST /api/v1/video/reindex/f1935e9f-adee-45ad-87bd-8c1ad9cc066e
   ```

### Issue: Frames not extracted (framesExtracted: 0)

1. **Check FFmpeg installation**:
   ```bash
   ffmpeg -version
   ```

2. **Verify video file exists and is readable**

3. **Check server logs for FFmpeg errors**

### Issue: Visual embeddings not stored

1. **Check if Hugging Face token is set** (optional)
2. **Verify frame extraction is working**
3. **Check Milvus collection status**

### Issue: Text embeddings not stored

1. **Verify Gemini API key is valid**
2. **Check transcription was successful**
3. **Run Milvus diagnostic test**

## 🧪 Testing

### 1. Test Collection Status
```bash
curl http://localhost:4000/api/v1/video/query/test
```

### 2. Test Video Query
```bash
curl -X POST http://localhost:4000/api/v1/video/query/ask/f1935e9f-adee-45ad-87bd-8c1ad9cc066e \
  -H "Content-Type: application/json" \
  -d '{"query": "What is this video about?"}'
```

### 3. Debug Video Indexing
```bash
curl http://localhost:4000/api/v1/video/debug/f1935e9f-adee-45ad-87bd-8c1ad9cc066e
```

### 4. Force Reindex
```bash
curl -X POST http://localhost:4000/api/v1/video/reindex/f1935e9f-adee-45ad-87bd-8c1ad9cc066e \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔧 Development

### Project Structure
```
src/
├── controllers/          # API controllers
├── middlewares/          # Authentication & file upload
├── models/              # Database models
├── routers/             # API routes
├── services/            # Business logic
└── utils/               # Helper functions
```

### Key Components

- **IndexNewVideoController**: Main video processing pipeline
- **QueryController**: Video query and search functionality
- **VideoToKeyFramesService**: Frame extraction using FFmpeg
- **VideoToAudioTranscriptionService**: Audio transcription using AssemblyAI
- **Chunking utilities**: Text segmentation strategies

### Adding New Features

1. **New embedding model**: Update `validateEnvironmentVariables.utils.js`
2. **New chunking strategy**: Add to `chunkText.utils.js`
3. **New API endpoint**: Create controller and add to router

## 📊 Monitoring

### Logs to Watch
- Frame extraction progress
- Embedding generation
- Milvus insertion results
- Collection statistics

### Key Metrics
- Frames extracted per video
- Text chunks generated
- Embeddings stored successfully
- Query response time

## 🚨 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| No frames extracted | FFmpeg not installed/configured | Install FFmpeg, check file permissions |
| Transcription failed | AssemblyAI API key invalid | Verify API key, check quota |
| Embeddings not stored | Milvus connection issue | Check credentials, verify collection exists |
| Query returns no results | Video not indexed | Force reindex, check collection status |
| Dimension mismatch | Model changed | Drop and recreate collection |

## 📞 Support

For issues:
1. Check server logs
2. Run diagnostic tests
3. Verify environment variables
4. Check collection status in Zilliz UI

## 🔮 Future Enhancements

- [ ] Background job processing for large videos
- [ ] Real-time indexing progress updates
- [ ] Advanced visual understanding with CLIP
- [ ] Multi-language support
- [ ] Video summarization
- [ ] Content moderation
