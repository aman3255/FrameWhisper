const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs-extra'); // Use fs-extra for promise-based operations
const axios = require('axios');

// AssemblyAI configuration
const baseUrl = "https://api.assemblyai.com";
const headers = {
    authorization: process.env.ASSEMBLYAI_API_KEY,
};

if (!headers.authorization) {
    throw new Error('ASSEMBLYAI_API_KEY is missing in environment variables');
}

const VideoToAudioTranscriptionService = async (videoPath, outputDir, videoId) => {
    try {
        console.log(`Starting transcription process for video: ${videoId}`);
        
        // Create output directories
        const audioOutputDir = path.join(outputDir, 'audio', videoId);
        const transcriptionOutputDir = path.join(outputDir, 'transcriptions', videoId);
        
        if (!fs.existsSync(audioOutputDir)) {
            fs.mkdirSync(audioOutputDir, { recursive: true });
        }
        
        if (!fs.existsSync(transcriptionOutputDir)) {
            fs.mkdirSync(transcriptionOutputDir, { recursive: true });
        }

        // Step 1: Extract audio from video
        console.log('Step 1: Extracting audio from video...');
        const audioFilePath = await extractAudioFromVideo(videoPath, audioOutputDir, videoId);
        
        if (!audioFilePath) {
            throw new Error('Failed to extract audio from video');
        }

        // Step 2: Transcribe audio to text using AssemblyAI
        console.log('Step 2: Transcribing audio to text with AssemblyAI...');
        const transcriptionResult = await transcribeAudioWithAssemblyAI(audioFilePath, transcriptionOutputDir, videoId);
        
        return {
            success: true,
            videoId: videoId,
            audioFilePath: audioFilePath,
            transcription: transcriptionResult,
            outputDirectories: {
                audio: audioOutputDir,
                transcription: transcriptionOutputDir
            }
        };

    } catch (error) {
        console.error('Error in VideoToAudioTranscriptionService:', error);
        return {
            success: false,
            error: error.message,
            videoId: videoId
        };
    }
};

// Step 1: Extract audio from video using FFmpeg
const extractAudioFromVideo = (videoPath, audioOutputDir, videoId) => {
    return new Promise((resolve, reject) => {
        const audioFileName = `${videoId}_audio.wav`;
        const audioFilePath = path.join(audioOutputDir, audioFileName);
        
        console.log(`Extracting audio to: ${audioFilePath}`);
        
        ffmpeg(videoPath)
            .toFormat('wav')
            .audioCodec('pcm_s16le')
            .audioChannels(1) // Convert to mono for better transcription performance
            .audioFrequency(16000) // 16kHz sample rate
            .output(audioFilePath)
            .on('start', (commandLine) => {
                console.log('FFmpeg command:', commandLine);
            })
            .on('progress', (progress) => {
                console.log(`Audio extraction progress: ${Math.round(progress.percent || 0)}%`);
            })
            .on('end', () => {
                console.log('Audio extraction completed successfully');
                
                // Verify the audio file exists and has content
                if (fs.existsSync(audioFilePath) && fs.statSync(audioFilePath).size > 0) {
                    resolve(audioFilePath);
                } else {
                    reject(new Error('Audio file was not created or is empty'));
                }
            })
            .on('error', (err) => {
                console.error('Error during audio extraction:', err);
                reject(err);
            })
            .run();
    });
};

// Step 2: Transcribe audio using AssemblyAI API
const transcribeAudioWithAssemblyAI = async (audioFilePath, transcriptionOutputDir, videoId) => {
    try {
        console.log(`Starting AssemblyAI transcription for: ${audioFilePath}`);
        
        // Check file size and get file stats
        const fileStats = fs.statSync(audioFilePath);
        const fileSizeInMB = fileStats.size / (1024 * 1024);
        
        console.log(`Audio file size: ${fileSizeInMB.toFixed(2)}MB`);
        
        // Step 1: Upload the audio file to AssemblyAI
        console.log('Uploading audio file to AssemblyAI...');
        const audioData = await fs.readFile(audioFilePath);
        const uploadResponse = await axios.post(`${baseUrl}/v2/upload`, audioData, {
            headers,
        });
        const audioUrl = uploadResponse.data.upload_url;
        console.log('Audio file uploaded successfully');
        
        // Step 2: Submit transcription request
        console.log('Submitting transcription request...');
        const transcriptionData = {
            audio_url: audioUrl,
            speech_model: "universal",
            // Enable additional features for better results
            punctuate: true,
            format_text: true,
            dual_channel: false,
            // Get word-level timestamps
            word_boost: [],
            boost_param: "default",
        };
        
        const transcriptionUrl = `${baseUrl}/v2/transcript`;
        const transcriptionResponse = await axios.post(transcriptionUrl, transcriptionData, { 
            headers: headers 
        });
        
        const transcriptId = transcriptionResponse.data.id;
        console.log(`Transcription job submitted with ID: ${transcriptId}`);
        
        // Step 3: Poll for completion
        console.log('Waiting for transcription to complete...');
        const pollingEndpoint = `${baseUrl}/v2/transcript/${transcriptId}`;
        let attempts = 0;
        const maxAttempts = 100; // Max wait time: 100 * 3 seconds = 5 minutes
        
        while (attempts < maxAttempts) {
            const pollingResponse = await axios.get(pollingEndpoint, {
                headers: headers,
            });
            const result = pollingResponse.data;
            
            console.log(`Transcription status: ${result.status}`);
            
            if (result.status === "completed") {
                console.log('Transcription completed successfully');
                
                // Process and format transcription data to match expected format
                const processedTranscription = await processAssemblyAIResult(result, videoId, audioFilePath, fileStats);
                
                // Save transcription files
                await saveTranscriptionFiles(processedTranscription, transcriptionOutputDir, videoId);
                
                return processedTranscription;
                
            } else if (result.status === "error") {
                throw new Error(`Transcription failed: ${result.error}`);
            } else {
                // Still processing, wait and try again
                await new Promise((resolve) => setTimeout(resolve, 3000));
                attempts++;
            }
        }
        
        throw new Error('Transcription timeout: Process took too long to complete');
        
    } catch (error) {
        console.error('Error during AssemblyAI transcription:', error);
        throw error;
    }
};

// Process AssemblyAI result to match expected format
const processAssemblyAIResult = async (assemblyAIResult, videoId, audioFilePath, fileStats) => {
    try {
        // Convert AssemblyAI words to segments format (similar to Whisper segments)
        const segments = [];
        
        if (assemblyAIResult.words && assemblyAIResult.words.length > 0) {
            // Group words into segments (roughly every 10 words or by sentence breaks)
            const wordsPerSegment = 10;
            
            for (let i = 0; i < assemblyAIResult.words.length; i += wordsPerSegment) {
                const segmentWords = assemblyAIResult.words.slice(i, i + wordsPerSegment);
                const startTime = segmentWords[0].start / 1000; // Convert ms to seconds
                const endTime = segmentWords[segmentWords.length - 1].end / 1000;
                const segmentText = segmentWords.map(w => w.text).join(' ');
                
                segments.push({
                    id: i / wordsPerSegment,
                    seek: Math.floor(startTime),
                    start: startTime,
                    end: endTime,
                    text: segmentText,
                    tokens: segmentWords.map(w => w.text),
                    temperature: 0.0,
                    avg_logprob: assemblyAIResult.confidence || 0.5,
                    compression_ratio: 1.0,
                    no_speech_prob: 0.0
                });
            }
        }
        
        // Create transcription data in expected format
        const transcriptionData = {
            videoId: videoId,
            transcribedAt: new Date().toISOString(),
            duration: assemblyAIResult.audio_duration || 0,
            language: assemblyAIResult.language_code || 'en',
            fullText: assemblyAIResult.text || '',
            segments: segments,
            audioFilePath: audioFilePath,
            metadata: {
                fileSize: fileStats.size,
                fileSizeMB: (fileStats.size / (1024 * 1024)).toFixed(2),
                confidence: assemblyAIResult.confidence || 0,
                assemblyAIId: assemblyAIResult.id,
                speechModel: "universal",
                service: "AssemblyAI"
            },
            // Additional AssemblyAI specific data
            assemblyAI: {
                confidence: assemblyAIResult.confidence,
                audio_duration: assemblyAIResult.audio_duration,
                language_code: assemblyAIResult.language_code,
                acoustic_model: assemblyAIResult.acoustic_model,
                words: assemblyAIResult.words || []
            }
        };
        
        console.log(`Transcription processed successfully:`);
        console.log(`- Duration: ${transcriptionData.duration}s`);
        console.log(`- Language: ${transcriptionData.language}`);
        console.log(`- Full text length: ${transcriptionData.fullText.length} characters`);
        console.log(`- Number of segments: ${segments.length}`);
        console.log(`- Confidence: ${assemblyAIResult.confidence || 'N/A'}`);
        
        return transcriptionData;
        
    } catch (error) {
        console.error('Error processing AssemblyAI result:', error);
        throw error;
    }
};

// Save transcription files
const saveTranscriptionFiles = async (transcriptionData, transcriptionOutputDir, videoId) => {
    try {
        // Save full JSON transcription
        const transcriptionFileName = `${videoId}_transcription.json`;
        const transcriptionFilePath = path.join(transcriptionOutputDir, transcriptionFileName);
        
        fs.writeFileSync(transcriptionFilePath, JSON.stringify(transcriptionData, null, 2));
        
        // Save plain text version
        const textFileName = `${videoId}_transcript.txt`;
        const textFilePath = path.join(transcriptionOutputDir, textFileName);
        fs.writeFileSync(textFilePath, transcriptionData.fullText);
        
        // Save segments as separate JSON (useful for timestamp-based queries)
        if (transcriptionData.segments && transcriptionData.segments.length > 0) {
            const segmentsFileName = `${videoId}_segments.json`;
            const segmentsFilePath = path.join(transcriptionOutputDir, segmentsFileName);
            fs.writeFileSync(segmentsFilePath, JSON.stringify(transcriptionData.segments, null, 2));
        }
        
        transcriptionData.files = {
            json: transcriptionFilePath,
            txt: textFilePath,
            segments: transcriptionData.segments.length > 0 ? path.join(transcriptionOutputDir, `${videoId}_segments.json`) : null
        };
        
        console.log('Transcription files saved successfully');
        
    } catch (error) {
        console.error('Error saving transcription files:', error);
        throw error;
    }
};

module.exports = {
    VideoToAudioTranscriptionService,
    extractAudioFromVideo,
    transcribeAudioWithAssemblyAI
};