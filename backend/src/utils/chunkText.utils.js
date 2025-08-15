// ================ Text Chunking Utility ===================
// File: src/utils/chunkText.utils.js

/**
 * Chunks text into smaller segments with overlap for better context preservation
 * Optimized for video transcription processing and embedding generation
 * 
 * @param {string} text - The text to be chunked
 * @param {number} chunkSize - Number of words per chunk (optional)
 * @param {number} overlap - Number of overlapping words between chunks (optional)
 * @returns {Array<string>} Array of text chunks
 */
const chunkText = (text, chunkSize = null, overlap = null) => {
  // Input validation
  if (!text || typeof text !== 'string') {
      console.warn('Invalid text input for chunking');
      return [];
  }
  
  // Clean and split text into words
  const cleanText = text.trim().replace(/\s+/g, ' '); // Normalize whitespace
  const words = cleanText.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  
  // Return original text if it's too short to chunk
  if (wordCount <= 50) {
      return [cleanText];
  }
  
  // Dynamic chunk size and overlap based on text length
  // Optimized for video transcriptions which can vary greatly in length
  if (!chunkSize || !overlap) {
      if (wordCount <= 300) {
          // Short videos/segments
          chunkSize = 150;
          overlap = 30;
      } else if (wordCount <= 1000) {
          // Medium videos (5-10 minutes)
          chunkSize = 300;
          overlap = 60;
      } else if (wordCount <= 3000) {
          // Long videos (10-30 minutes)
          chunkSize = 500;
          overlap = 100;
      } else if (wordCount <= 10000) {
          // Very long videos (30+ minutes)
          chunkSize = 800;
          overlap = 160;
      } else {
          // Extremely long videos (1+ hour)
          chunkSize = 1000;
          overlap = 200;
      }
  }
  
  // Ensure overlap doesn't exceed chunk size
  if (overlap >= chunkSize) {
      overlap = Math.floor(chunkSize * 0.2); // 20% overlap max
  }
  
  const chunks = [];
  const step = chunkSize - overlap;
  
  // Create chunks with overlap
  for (let i = 0; i < words.length; i += step) {
      const chunkWords = words.slice(i, i + chunkSize);
      
      if (chunkWords.length > 0) {
          const chunk = chunkWords.join(' ').trim();
          
          // Only add non-empty chunks
          if (chunk && chunk.length > 10) { // Minimum 10 characters
              chunks.push(chunk);
          }
      }
      
      // Break if we've processed all words
      if (i + chunkSize >= words.length) {
          break;
      }
  }
  
  // Handle edge case where no chunks were created
  if (chunks.length === 0) {
      chunks.push(cleanText);
  }
  
  return chunks;
};

/**
* Chunks text based on sentences for better semantic coherence
* Useful for maintaining context in transcriptions
* 
* @param {string} text - The text to be chunked
* @param {number} maxWords - Maximum words per chunk
* @returns {Array<string>} Array of sentence-based chunks
*/
const chunkTextBySentence = (text, maxWords = 500) => {
  if (!text || typeof text !== 'string') {
      return [];
  }
  
  // Split by sentence endings
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  
  if (sentences.length === 0) {
      return [text.trim()];
  }
  
  const chunks = [];
  let currentChunk = '';
  let currentWordCount = 0;
  
  for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).length;
      
      // If adding this sentence exceeds limit, save current chunk
      if (currentWordCount + sentenceWords > maxWords && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
          currentWordCount = sentenceWords;
      } else {
          currentChunk += (currentChunk ? '. ' : '') + sentence;
          currentWordCount += sentenceWords;
      }
  }
  
  // Add final chunk
  if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [text.trim()];
};

/**
* Chunks text with timestamp awareness for video transcriptions
* Maintains timestamp boundaries when possible
* 
* @param {Array} segments - Array of {text, start, end} segments
* @param {number} maxWords - Maximum words per chunk
* @returns {Array} Array of {text, startTime, endTime} chunks
*/
const chunkTranscriptionSegments = (segments, maxWords = 400) => {
  if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return [];
  }
  
  const chunks = [];
  let currentChunk = {
      text: '',
      startTime: null,
      endTime: null,
      wordCount: 0
  };
  
  for (const segment of segments) {
      if (!segment.text || typeof segment.text !== 'string') {
          continue;
      }
      
      const segmentWords = segment.text.split(/\s+/).length;
      
      // If adding this segment exceeds limit, save current chunk
      if (currentChunk.wordCount + segmentWords > maxWords && currentChunk.text.length > 0) {
          chunks.push({
              text: currentChunk.text.trim(),
              startTime: currentChunk.startTime,
              endTime: currentChunk.endTime
          });
          
          // Start new chunk
          currentChunk = {
              text: segment.text,
              startTime: segment.start || segment.startTime || null,
              endTime: segment.end || segment.endTime || null,
              wordCount: segmentWords
          };
      } else {
          // Add to current chunk
          currentChunk.text += (currentChunk.text ? ' ' : '') + segment.text;
          currentChunk.wordCount += segmentWords;
          
          // Set timestamps
          if (currentChunk.startTime === null) {
              currentChunk.startTime = segment.start || segment.startTime || null;
          }
          currentChunk.endTime = segment.end || segment.endTime || null;
      }
  }
  
  // Add final chunk
  if (currentChunk.text.trim()) {
      chunks.push({
          text: currentChunk.text.trim(),
          startTime: currentChunk.startTime,
          endTime: currentChunk.endTime
      });
  }
  
  return chunks;
};

// ✅ FIXED: Using CommonJS exports instead of ES6 export
module.exports = {
  chunkText,
  chunkTextBySentence,
  chunkTranscriptionSegments
};

// ================ Usage Examples ===================
/*
// Basic usage
const chunks1 = chunkText("Your long text here...");

// Custom chunk size
const chunks2 = chunkText("Your text...", 500, 100);

// Sentence-based chunking
const chunks3 = chunkTextBySentence("Your text...", 300);

// Timestamp-aware chunking for video segments
const segments = [
  { text: "Hello world", start: 0, end: 2 },
  { text: "How are you", start: 2, end: 4 }
];
const chunks4 = chunkTranscriptionSegments(segments, 400);
*/