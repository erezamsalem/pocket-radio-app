// server.js
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const port = 3001;

// Serve static files from the current directory (where index.html is)
app.use(express.static(__dirname));
console.log('Server: Static files middleware configured.');

// Proxy endpoint for audio streams
app.get('/proxy-audio', async (req, res) => {
    // Log when a proxy request is received
    console.log(`Proxy: Received request for /proxy-audio from ${req.ip}`);

    // Get the actual stream URL from the 'url' query parameter
    const streamUrl = req.query.url;

    // Log the target stream URL
    console.log(`Proxy: Attempting to proxy URL: ${streamUrl}`);

    // Basic validation: ensure a URL was provided
    if (!streamUrl) {
        console.warn('Proxy: Missing stream URL parameter in request.');
        return res.status(400).send('Error: Missing stream URL parameter.');
    }

    try {
        console.log(`Proxy: Making external request to ${streamUrl}`);
        // Use axios to make a request to the external stream URL
        // responseType: 'stream' is crucial for handling binary data like audio
        const response = await axios({
            method: 'get',
            url: streamUrl,
            responseType: 'stream',
            // Increased timeout to 30 seconds
            timeout: 30000 // 30 seconds
        });

        // Log successful external response
        console.log(`Proxy: Received response from ${streamUrl} with status ${response.status} and content-type: ${response.headers['content-type']}`);

        // Set the appropriate Content-Type header from the original response
        // This tells the browser what kind of data it's receiving (e.g., audio/mpeg)
        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
            console.log(`Proxy: Setting Content-Type header to: ${response.headers['content-type']}`);
        } else {
            // Fallback content type if not provided by the source
            res.setHeader('Content-Type', 'audio/mpeg');
            console.log('Proxy: Content-Type not provided by source, defaulting to audio/mpeg');
        }

        // You might want to copy other relevant headers like Content-Length, Cache-Control
        // For simplicity, we'll primarily focus on Content-Type for audio streaming.
        // If you encounter issues with specific streams, you might need to copy more headers.
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
            console.log(`Proxy: Setting Content-Length header to: ${response.headers['content-length']}`);
        }
        if (response.headers['accept-ranges']) {
            res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
            console.log(`Proxy: Setting Accept-Ranges header to: ${response.headers['accept-ranges']}`);
        }

        // Pipe the stream from the external source directly to the client's response
        // This makes the Express server act as a transparent proxy
        console.log(`Proxy: Starting to pipe stream data from ${streamUrl} to client.`);
        response.data.pipe(res);

        // Log when the piping process finishes successfully
        response.data.on('end', () => {
            console.log(`Proxy: Stream piping for ${streamUrl} completed successfully.`);
        });

        // Handle errors during the piping process
        response.data.on('error', (err) => {
            console.error(`Proxy: Stream piping error for ${streamUrl}:`, err.message, err.code ? `(Code: ${err.code})` : '');
            if (!res.headersSent) { // Only send error if headers haven't been sent yet
                res.status(500).send('Error streaming audio.');
            }
        });

    } catch (error) {
        // Log detailed error information, but avoid stringifying stream data
        let errorMessage = `Proxy error for ${streamUrl}: ${error.message}`;
        if (error.code) {
            errorMessage += ` (Code: ${error.code})`;
        }
        if (error.response) {
            // Only log status and statusText for response errors, as data can be a circular stream
            errorMessage += ` (Status: ${error.response.status}, StatusText: ${error.response.statusText})`;
            // If you absolutely need to inspect the data, and it's not a stream, you'd check response.config.responseType
            // For 'stream' responseType, error.response.data is the stream itself, not its content.
        }
        console.error(errorMessage);

        // If the request timed out or failed for other reasons
        if (error.code === 'ECONNABORTED') {
            res.status(504).send('Gateway Timeout: External stream took too long to respond.');
        } else if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            res.status(error.response.status).send(`Error from external stream: ${error.response.statusText}`);
        } else {
            // Something happened in setting up the request that triggered an Error
            res.status(500).send('Internal Server Error: Could not connect to external stream.');
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
    console.log(`📻 Audio proxy available at http://localhost:${port}/proxy-audio?url=[EXTERNAL_STREAM_URL] 📻`);
});