const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = 'uploads/videos';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Created upload directory: ${uploadDir}`);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        // Enhanced filename with more unique identifier
        const uniqueName = `${name}_${timestamp}_${Math.random().toString(36).substr(2, 9)}${ext}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    // Enhanced file validation
    const allowedExtensions = /\.(mp4|mov|avi|mkv|webm)$/i;
    const allowedMimeTypes = /^video\/(mp4|quicktime|x-msvideo|x-matroska|webm)$/i;
    
    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        return cb(new Error('Only video files (MP4, MOV, AVI, MKV, WebM) are allowed'), false);
    }
};

const uploadVideo = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // Enhanced: Increased to 100MB for video files
        files: 1 // Only allow single file upload
    }
}).single('video');

const multerMiddleware = (req, res, next) => {
    uploadVideo(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ 
                    success: false,
                    error: 'File size too large. Maximum allowed size is 100MB.',
                    code: 'FILE_TOO_LARGE'
                });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({ 
                    success: false,
                    error: 'Too many files. Only one video file is allowed.',
                    code: 'TOO_MANY_FILES'
                });
            }
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({ 
                    success: false,
                    error: 'Unexpected file field. Use field name "video".',
                    code: 'UNEXPECTED_FIELD'
                });
            }
            
            return res.status(400).json({ 
                success: false,
                error: `Upload error: ${err.message}`,
                code: 'UPLOAD_ERROR'
            });
        } else if (err) {
            console.error('File filter error:', err);
            return res.status(400).json({ 
                success: false,
                error: err.message,
                code: 'INVALID_FILE'
            });
        }
        
        // Validate that file was actually uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No video file uploaded. Please select a video file.',
                code: 'NO_FILE'
            });
        }
        
        // Add file info to logs
        console.log(`Video uploaded: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        next();
    });
};

module.exports = multerMiddleware;