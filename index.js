const express = require('express');
const multer = require('multer');
const { createClient } = require('@deepgram/sdk');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const storage = multer.memoryStorage(); 
const upload = multer({ storage });

app.use(express.json()); 

app.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }

  try {
    const fileBuffer = req.file.buffer;
    const result = await deepgram.transcription.preRecorded({
      buffer: fileBuffer,
      mimetype: 'audio/mp4', 
    }, {
      punctuate: true,
      utterances: true,
      language: "en-US", 
    });

    const transcription = result.results.utterances;
    res.json({ transcription });

  } catch (error) {
    console.error('Error transcribing audio:', error);
    res.status(500).send('Transcription failed');
  }
});


app.post('/update-captions', async (req, res) => {
    const { videoUri, captions } = req.body;
  
    if (!videoUri || !captions) {
      return res.status(400).send('Video URI and captions are required');
    }
  
    try {
      // Fetch video from the URI
      const videoResponse = await axios.get(videoUri, { responseType: 'arraybuffer' });
      const videoBuffer = Buffer.from(videoResponse.data);
  
      // Create a temporary file for the video
      const videoPath = path.join(__dirname, 'temp', 'video.mp4');
      await fs.outputFile(videoPath, videoBuffer);
  
      // Create a temporary file for the captions
      const captionsPath = path.join(__dirname, 'temp', 'captions.srt');
      await fs.outputFile(captionsPath, captions.join('\n'));
  
      // Generate output file path
      const outputPath = path.join(__dirname, 'temp', 'output.mp4');
  
      // Burn captions into video using FFmpeg
      ffmpeg(videoPath)
        .input(captionsPath)
        .inputOptions(['-c:s srt'])
        .outputOptions(['-c:v libx264', '-c:a aac', '-strict experimental'])
        .output(outputPath)
        .on('end', () => {
          res.sendFile(outputPath);
        })
        .on('error', (err) => {
          console.error('Error processing video:', err);
          res.status(500).send('Video processing failed');
        })
        .run();
    } catch (error) {
      console.error('Error updating captions:', error);
      res.status(500).send('Caption update failed');
    }
  });
  

  
app.post('/adjust-captions', upload.single('video'), async (req, res) => {
  if (!req.file || !req.body.captions) {
    return res.status(400).send('Missing video or captions');
  }

  try {
    const videoBuffer = req.file.buffer;
    const captions = req.body.captions;
    
    const videoPath = `./uploads/${uuidv4()}.mp4`;
    const captionsPath = `./uploads/${uuidv4()}.srt`; // .srt format for captions

    fs.writeFileSync(videoPath, videoBuffer);

    // Convert captions JSON to .srt format
    const srtCaptions = convertToSRT(captions);
    fs.writeFileSync(captionsPath, srtCaptions);

    // Step 3: Burn captions into video using ffmpeg
    const outputVideoPath = `./uploads/output-${uuidv4()}.mp4`;

    ffmpeg(videoPath)
      .input(captionsPath)
      .outputOptions('-c:v libx264', '-crf 23', '-preset medium', '-vf subtitles=' + captionsPath)
      .save(outputVideoPath)
      .on('end', () => {
        // Step 4: Send the processed video file or upload link
        res.download(outputVideoPath, (err) => {
          if (err) console.error('Error sending file:', err);
          // Cleanup temp files
          fs.unlinkSync(videoPath);
          fs.unlinkSync(captionsPath);
          fs.unlinkSync(outputVideoPath);
        });
      })
      .on('error', (err) => {
        console.error('Error processing video:', err);
        res.status(500).send('Failed to process video with captions');
      });

  } catch (error) {
    console.error('Error processing adjusted captions:', error);
    res.status(500).send('Failed to bind captions to video');
  }
});

// Convert JSON captions to .srt format
const convertToSRT = (captions) => {
  return captions.map((caption, index) => {
    const start = formatTime(caption.start);
    const end = formatTime(caption.end);
    return `${index + 1}\n${start} --> ${end}\n${caption.text}\n`;
  }).join('\n');
};

 
const formatTime = (timeInMs) => {
  const date = new Date(timeInMs);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds},${milliseconds}`;
};

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
