const express = require('express');
const { QueryController, QueryTestController } = require('./../../controllers/QueryController.controller');
const { AuthMiddleware } = require('../../middlewares/auth.middleware');

const queryRouter = express.Router();

// POST /api/v1/video/query/ask/:uuid
queryRouter.post('/ask/:uuid', AuthMiddleware, QueryController);

// GET /api/v1/video/query/test - Test collection status
queryRouter.get('/test', QueryTestController);

module.exports = queryRouter;