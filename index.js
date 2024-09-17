const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const { createClient } = require('@deepgram/sdk');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Middleware to parse JSON with an increased size limit
app.use(express.json({ limit: '1000mb' }));

// Middleware to log incoming requests
app.use((req, res, next) => {
  console.log('Incoming Request');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});


const transcribeUrl = async (url) => {
  // STEP 1: Create a Deepgram client using the API key
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  // STEP 2: Call the transcribeUrl method with the audio payload and options
  const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
    {
      url: url,
    },
 
    {
      model: "nova-2",
      smart_format: true,
    }
  );

  if (error) throw error;
 
  if (!error) console.dir(result, { depth: null });
  return result
};

app.post('/upload', async (req, res) => {
  console.log('hit');
  const { video } = req.body;
  console.log("Called with video data:", video);

  if (!video) {
    return res.status(400).send('No video data provided');
  }

  try {
    // Prepare the data for Cloudinary
    const formData = new FormData();
    formData.append('file', video);
    formData.append('upload_preset', 'qmakq1p3'); // Replace with your Cloudinary upload preset

    // Upload to Cloudinary
    const cloudinaryResponse = await axios.post(
      'https://api.cloudinary.com/v1_1/dojwag3u1/video/upload',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      }
    );

    const videoUrl = cloudinaryResponse.data.secure_url;
    console.log("Cloudinary URL:", videoUrl);
   const result = await transcribeUrl(videoUrl)
 
    res.status(200).json({ result });
  } catch (error) {
    console.error('Error processing video:', error);
    res.status(500).send('Processing failed');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
