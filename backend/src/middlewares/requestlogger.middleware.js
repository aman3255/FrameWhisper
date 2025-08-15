

// This middleware logs the incoming request to the console
const RequestLoggerMiddleware = (req, res, next) => {
    try {
        const httpMethod = req.method;
        const ip = req.ip;
        const url = req.originalUrl || req.url;
        const timeStamp = new Date().toISOString(); 

        console.log(`📌 Request ${httpMethod} ${url} from ${ip} at ${timeStamp}`);
        // 📌 Request GET /api/users from 192.168.1.10 at 2025-03-11T14:30:00.789Z

        next();
    } catch (error) {
        console.error(`❌ Error while logging the request ${error}`);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || `Internal server error`
        })
    }
}

module.exports = { RequestLoggerMiddleware };

