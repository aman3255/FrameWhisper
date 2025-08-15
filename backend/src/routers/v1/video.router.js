const express = require('express');
const multerMiddleware = require('../../middlewares/multer.middleware');
const { AuthMiddleware } = require('../../middlewares/auth.middleware');
const { IndexNewVideoController, DebugVideoIndexingController, ForceReindexVideoController } = require('../../controllers/IndexNewVideoController.controller');

const videoRouter = express.Router();

videoRouter.post('/upload', AuthMiddleware, multerMiddleware, IndexNewVideoController);

// Debug endpoint to check video indexing status
videoRouter.get('/debug/:videoId', DebugVideoIndexingController);

// Force reindex endpoint for existing videos
videoRouter.post('/reindex/:videoId', AuthMiddleware, ForceReindexVideoController);

module.exports = videoRouter;