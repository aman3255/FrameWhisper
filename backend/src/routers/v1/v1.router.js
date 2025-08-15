const express = require('express');
const videoRouter = require('./video.router');
const authRouter = require('./auth.router');
const queryRouter = require('./query.router');

const v1Router = express.Router();

v1Router.use('/auth', authRouter);
v1Router.use('/video', videoRouter);
v1Router.use('/video/query', queryRouter);

module.exports = v1Router;