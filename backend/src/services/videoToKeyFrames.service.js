const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs-extra');

const VideoToKeyFramesService = async (videoPath, outputDir, videoId) => {
    try {
        console.log(`Starting frame extraction for video: ${videoPath}`);

        // Create/clean output directory
        const frameOutputDir = path.join(outputDir, 'frames', videoId);
        await fs.ensureDir(frameOutputDir);
        await fs.emptyDir(frameOutputDir);
        console.log(`Frame output directory: ${frameOutputDir}`);

        // Get video duration first
        const videoDuration = await getVideoDuration(videoPath);
        console.log(`Video duration: ${videoDuration} seconds`);
        
        // Extract frames using ffmpeg (1 frame every 5 seconds, ensure at least 1 frame)
        const frameInterval = 5; // seconds
        const timestamps = generateTimestamps(videoDuration, frameInterval);
        console.log(`Generated ${timestamps.length} timestamps:`, timestamps);

        // Ensure we have at least one timestamp
        if (timestamps.length === 0) {
            timestamps.push(0); // Always extract at least one frame at 0 seconds
        }

        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .screenshots({
                    timestamps: timestamps,
                    filename: 'frame_%05d.png',
                    folder: frameOutputDir,
                    size: '640x480'
                })
                .on('start', (commandLine) => {
                    console.log('FFmpeg command:', commandLine);
                })
                .on('progress', (progress) => {
                    console.log(`Frame extraction progress: ${Math.round(progress.percent || 0)}%`);
                })
                .on('end', () => {
                    console.log('Frame extraction completed');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Error during frame extraction:', err);
                    reject(err);
                });
        });

        // Read generated frames from disk and build metadata
        console.log('Reading generated frames from disk...');
        const files = (await fs.readdir(frameOutputDir))
            .filter(name => /^frame_\d+\.png$/i.test(name))
            .sort((a, b) => {
                const na = parseInt(a.match(/(\d+)/)[1], 10);
                const nb = parseInt(b.match(/(\d+)/)[1], 10);
                return na - nb;
            });

        console.log(`Found ${files.length} frame files:`, files);

        if (files.length === 0) {
            console.warn('No frames were generated. Trying alternative approach...');
            
            // Fallback: try to extract at least one frame at the beginning
            await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .screenshots({
                        timestamps: [0],
                        filename: 'frame_%05d.png',
                        folder: frameOutputDir,
                        size: '640x480'
                    })
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err));
            });
            
            // Check again
            const fallbackFiles = (await fs.readdir(frameOutputDir))
                .filter(name => /^frame_\d+\.png$/i.test(name));
            console.log(`Fallback generated ${fallbackFiles.length} frames`);
            
            if (fallbackFiles.length === 0) {
                throw new Error('Failed to extract any frames from video');
            }
            
            files.push(...fallbackFiles);
        }

        const extractedFrames = files.map((fileName, index) => {
            const frameNumber = index + 1;
            const timestamp = index * frameInterval;
            return {
                timestamp: timestamp,
                frame_path: path.join(frameOutputDir, fileName),
                frame_number: frameNumber
            };
        });

        console.log(`Extracted ${extractedFrames.length} frames with metadata`);

        return {
            success: true,
            frames: extractedFrames,
            totalFrames: extractedFrames.length,
            frameInterval: frameInterval,
            outputDirectory: frameOutputDir
        };

    } catch (error) {
        console.error('Error in VideoToKeyFramesService:', error);
        return {
            success: false,
            error: error.message,
            frames: []
        };
    }
};

// Helper function to get video duration
const getVideoDuration = (videoPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                const duration = metadata.format.duration;
                resolve(duration);
            }
        });
    });
};

// Helper function to generate timestamps array
const generateTimestamps = (duration, interval) => {
    const timestamps = [];
    for (let i = 0; i < duration; i += interval) {
        timestamps.push(i);
    }
    // Always include at least one timestamp
    if (timestamps.length === 0) {
        timestamps.push(0);
    }
    return timestamps;
};

module.exports = {
    VideoToKeyFramesService
};