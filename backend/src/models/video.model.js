const mongoose = require("mongoose");

const VideoSchema = new mongoose.Schema({
  original_name: {
    type: String,
    required: true,
    trim: true
  },
  uuid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  file_path: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  duration: {
    type: Number,
    min: 0
  },

  audio_transcription: {
    type: String
  },

  key_frames: [{
    timestamp: Number,
    frame_path: String
  }],

  is_indexed: {
    type: Boolean,
    default: false
  },
  indexing_status: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending"
  },

  uploaded_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },

  error_message: {
    type: String
  }
}, {
  timestamps: true
});

const VideoModel = mongoose.model("videos", VideoSchema);
module.exports = VideoModel;