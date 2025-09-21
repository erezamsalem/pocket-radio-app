// server.js

// At the very top, require and configure dotenv to load environment variables.
require('dotenv').config(); 

const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const port = 3001;

// Serve static files from the current directory (where index.html is)
app.use(express.static(__dirname));
console.log('Server: Static files middleware configured.');

// --- NEW ENDPOINT to securely provide the API key to the frontend ---
app.get('/api/key', (req, res) => {
    // This endpoint reads the API key from the server's environment variables
    // (loaded from the .env file or Kubernetes Secret) and sends it to the 
    // client-side code upon request.
    if (process.env.API_KEY) {
        res.json({ apiKey: process.env.API_KEY });
    } else {
        // If the API key is not found on the server, send an error.
        console.error('Server Error: API_KEY not found in environment variables.');
        res.status(500).json({ error: 'API key not configured on the server.' });
    }
});

// Proxy endpoint for audio streams
app.get('/proxy-audio', async (req, res) => {
    // Log when a proxy request is received
    console.log(`Proxy: Received request for /proxy-audio from ${req.ip}`);
    const streamUrl = req.query.url;
    console.log(`Proxy: Attempting to proxy URL: ${streamUrl}`);
    if (!streamUrl) {
        console.warn('Proxy: Missing stream URL parameter in request.');
        return res.status(400).send('Error: Missing stream URL parameter.');
    }
    try {
        console.log(`Proxy: Making external request to ${streamUrl}`);
        const response = await axios({
            method: 'get',
            url: streamUrl,
            responseType: 'stream',
            timeout: 30000 // 30 seconds
        });
        console.log(`Proxy: Received response from ${streamUrl} with status ${response.status}`);
        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        } else {
            res.setHeader('Content-Type', 'audio/mpeg');
        }
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }
        if (response.headers['accept-ranges']) {
            res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
        }
        response.data.pipe(res);
        response.data.on('end', () => {
            console.log(`Proxy: Stream piping for ${streamUrl} completed successfully.`);
        });
        response.data.on('error', (err) => {
            console.error(`Proxy: Stream piping error for ${streamUrl}:`, err.message);
            if (!res.headersSent) {
                res.status(500).send('Error streaming audio.');
            }
        });
    } catch (error) {
        let errorMessage = `Proxy error for ${streamUrl}: ${error.message}`;
        console.error(errorMessage);
        if (error.code === 'ECONNABORTED') {
            res.status(504).send('Gateway Timeout');
        } else if (error.response) {
            res.status(error.response.status).send(`Error from external stream: ${error.response.statusText}`);
        } else {
            res.status(500).send('Internal Server Error');
        }
    }
});

// Send index.html when the root URL is requested
app.get('/', (req, res) => {
    console.log(`Server: Serving index.html to ${req.ip}`);
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`📻 Pocket Radio app listening at http://localhost:${port} 📻`);
});

