const axios = require("axios");
const fs = require("fs-extra");

const baseUrl = "https://api.assemblyai.com";

const headers = {
  authorization: process.env.ASSEMBLYAI_API_KEY,
};

if (!headers.authorization) {
  throw new Error('ASSEMBLYAI_API_KEY is missing in environment variables');
}

async function transcribeAudio() {
  try {
    // Set your local audio file path here
    console.log("Starting transcription...");
    const path = "./670ca1b7-df4f-4c9c-b5a1-9a8392838a96_audio.wav"; // Replace with your actual file path
    console.log(`Reading audio file from: ${path}`);
    
    const audioData = await fs.readFile(path);
    const uploadResponse = await axios.post(`${baseUrl}/v2/upload`, audioData, {
      headers,
    });
    const audioUrl = uploadResponse.data.upload_url;

    const data = {
      audio_url: audioUrl,
      speech_model: "universal",
    };

    const url = `${baseUrl}/v2/transcript`;
    const response = await axios.post(url, data, { headers: headers });

    const transcriptId = response.data.id;
    const pollingEndpoint = `${baseUrl}/v2/transcript/${transcriptId}`;

    while (true) {
      const pollingResponse = await axios.get(pollingEndpoint, {
        headers: headers,
      });
      const transcriptionResult = pollingResponse.data;

      if (transcriptionResult.status === "completed") {
        console.log(transcriptionResult.text);
        break;
      } else if (transcriptionResult.status === "error") {
        throw new Error(`Transcription failed: ${transcriptionResult.error}`);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  } catch (error) {
    console.error("Error during transcription:", error.message);
  }
}

// Call the async function
transcribeAudio();