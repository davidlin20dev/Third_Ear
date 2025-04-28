/**
 * Client-side script for real-time audio transcription display.
 * Manages WebSocket communication, audio playback synchronization,
 * and updates the UI with raw and corrected transcripts.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");

    // --- UI Element References ---
    const rawTranscriptArea = document.getElementById('raw-transcript-area');
    const correctedTranscriptArea = document.getElementById('corrected-transcript-area');
    const interleavedContainer = document.getElementById('interleaved-bubbles-content');
    const processButton = document.getElementById('process-audio-btn');
    const audioElement = document.getElementById('audio-player');
    const statusIndicator = document.getElementById('status-indicator'); // Added for visual feedback

    // --- State Variables ---
    // Buffer to hold incoming transcript items (both raw and corrected)
    // before they are displayed in sync with the audio playback.
    let transcriptBuffer = [];
    // Timer used to periodically check the buffer against audio playback time.
    let displayInterval = null;
    const DISPLAY_CHECK_INTERVAL_MS = 100; // Check buffer every 100ms

    // --- Helper Functions ---

    /**
     * Appends text to a given textarea and ensures it scrolls to the bottom.
     * @param {HTMLTextAreaElement} textareaElement - The target textarea.
     * @param {string} text - The text line to append.
     */
    function appendToTextarea(textareaElement, text) {
        if (!textareaElement) return; // Guard against missing elements
        textareaElement.value += text + "\n"; // Add newline for separation
        textareaElement.scrollTop = textareaElement.scrollHeight; // Auto-scroll
    }

    /**
     * Creates and adds a chat-style bubble to the interleaved transcript container.
     * @param {string} text - The text content for the bubble.
     * @param {string} type - 'raw' or 'corrected', determines styling and icon.
     */
    function addBubble(text, type) {
        if (!interleavedContainer) {
            console.error("Interleaved container not found.");
            return;
        }

        const bubble = document.createElement('div');
        bubble.classList.add('bubble', type === 'raw' ? 'raw-bubble' : 'corrected-bubble');

        const icon = document.createElement('img');
        icon.classList.add('bubble-icon');
        icon.alt = type === 'raw' ? 'User (Raw)' : 'AI (Corrected)';
        // Use appropriate icons based on the transcript type
        icon.src = type === 'raw'
            ? '/static/images/user_icon.png' // Placeholder path
            : '/static/images/ai_icon.png';   // Placeholder path
        bubble.appendChild(icon);

        const textSpan = document.createElement('span');
        textSpan.classList.add('bubble-text');
        // Display status messages differently if needed
        if (text.startsWith('[')) {
             textSpan.classList.add('status-text'); // Add a class for styling status/errors
             textSpan.textContent = text; // Display as is
        } else {
            textSpan.textContent = text;
        }
        bubble.appendChild(textSpan);

        interleavedContainer.appendChild(bubble);
        // Ensure the container scrolls to show the latest bubble
        interleavedContainer.scrollTop = interleavedContainer.scrollHeight;
    }

     /**
     * Updates the status indicator text and style.
     * @param {string} message - The status message to display.
     * @param {'idle' | 'processing' | 'finished' | 'error'} type - The status type for styling.
     */
    function updateStatus(message, type = 'idle') {
        if (!statusIndicator) return;
        statusIndicator.textContent = message;
        statusIndicator.className = `status-indicator status-${type}`; // Reset classes and apply new one
    }

    /**
     * Periodically checks the transcript buffer. If the audio playback time
     * has passed the end time of buffered items, it displays them.
     * This function is the core of the synchronization logic.
     */
    function checkBufferAndDisplay() {
        // Ensure audio element exists and buffer has items
        if (!audioElement || transcriptBuffer.length === 0) {
            return;
        }
        // Get the current playback time of the audio element.
        const currentTime = audioElement.currentTime;
        // Debug log (optional, can be removed in production)
        // console.log(`---> Timer Check: Audio time = ${currentTime.toFixed(2)}s, Buffer size = ${transcriptBuffer.length}`);

        // Process items whose end time is before or at the current audio time.
        // Using `while` handles cases where multiple items might become ready between checks.
        while (transcriptBuffer.length > 0 && transcriptBuffer[0].endTime <= currentTime) {
            // Remove the item from the front of the buffer (since it's sorted by time).
            const item = transcriptBuffer.shift();

            console.log(`Displaying item ended at ${item.endTime.toFixed(2)}s: [${item.type}] ${item.text.substring(0, 50)}...`);

            // Display the item in the appropriate UI element(s).
            if (item.type === 'raw') {
                appendToTextarea(rawTranscriptArea, "Raw: " + item.text);
                addBubble(item.text, 'raw');
            } else if (item.type === 'corrected') {
                appendToTextarea(correctedTranscriptArea, "Corrected: " + item.text);
                // Only add a bubble if it's not an error/status message (optional, adjust as needed)
                // if (!item.text.startsWith('[')) {
                     addBubble(item.text, 'corrected');
                // }
            }
        }

        // If the buffer is empty and audio has finished playing, stop the timer.
        if (transcriptBuffer.length === 0 && audioElement.ended && displayInterval) {
             console.log("Audio ended and buffer empty, stopping display timer.");
             clearInterval(displayInterval);
             displayInterval = null;
             // Keep status as 'Finished' or update if needed
        }
    }

    // --- WebSocket Connection Setup ---
    const socket = io(); // Connect to the Socket.IO server

    // --- WebSocket Event Handlers ---

    socket.on('connect', () => {
        console.log('WebSocket connected! Socket ID:', socket.id);
        updateStatus('Connected to server.', 'idle');
    });

    socket.on('disconnect', () => {
        console.log('WebSocket disconnected.');
        updateStatus('Disconnected. Please refresh.', 'error');
        // Clean up the interval timer if the connection drops.
        if (displayInterval) {
            clearInterval(displayInterval);
            displayInterval = null;
        }
        // Disable button if connection is lost during processing
        if (processButton && processButton.textContent === "Processing...") {
             processButton.disabled = true; // Or re-enable with caution
        }
    });

    // General server messages (e.g., connection confirmation)
    socket.on('response', (msg) => {
        console.log('Server response:', msg);
        // Could display msg.data in a status area if needed
    });

    /**
     * Handles incoming raw transcript data. Pushes it onto the buffer
     * and sorts the buffer to maintain chronological order based on end time.
     */
    socket.on('raw_transcript_update', (data) => {
        console.log(`Buffered raw (ends ${data.end_time.toFixed(2)}s): ${data.text.substring(0, 50)}...`);
        // Add the raw transcript item to the buffer.
        transcriptBuffer.push({ type: 'raw', text: data.text, endTime: data.end_time });
        // Sort the buffer by end time to ensure chronological display.
        // This is crucial because STT final results might arrive slightly out of order.
        transcriptBuffer.sort((a, b) => a.endTime - b.endTime);
    });

    /**
     * Handles incoming corrected transcript data. Pushes it onto the buffer
     * and sorts the buffer to maintain chronological order.
     */
    socket.on('corrected_transcript_update', (data) => {
        console.log(`Buffered corrected (ends ${data.end_time.toFixed(2)}s): ${data.text.substring(0, 50)}...`);
        // Add the corrected transcript item to the buffer.
        transcriptBuffer.push({ type: 'corrected', text: data.text, endTime: data.end_time });
        // Re-sort the buffer to integrate the new item correctly by end time.
        transcriptBuffer.sort((a, b) => a.endTime - b.endTime);
    });

    /**
     * Handles the signal that server-side processing is finished.
     */
    socket.on('processing_finished', (data) => {
        console.log('Server indicated processing finished:', data.status);
        updateStatus(`Processing finished: ${data.status}`, 'finished');
        // Re-enable the button once processing is fully complete.
        // The display interval will stop itself when the buffer is empty and audio ends.
        if (processButton) {
            processButton.disabled = false;
            processButton.textContent = "Process Sample Audio 1";
        }
         // Final check in case audio finishes before last buffer check
         // setTimeout(checkBufferAndDisplay, DISPLAY_CHECK_INTERVAL_MS * 2);
    });

    /**
     * Handles errors reported by the server during processing.
     */
    socket.on('processing_error', (data) => {
        console.error('Processing error from server:', data.error);
        updateStatus(`Error: ${data.error}`, 'error');
        // Stop the display timer in case of an error.
        if (displayInterval) {
            clearInterval(displayInterval);
            displayInterval = null;
        }
        // Re-enable the button after an error.
        if (processButton) {
            processButton.disabled = false;
            processButton.textContent = "Process Sample Audio 1";
        }
        // Optionally display the error in the transcript areas or a dedicated error zone.
        appendToTextarea(rawTranscriptArea, `*** ERROR: ${data.error} ***`);
        appendToTextarea(correctedTranscriptArea, `*** ERROR: ${data.error} ***`);
    });

    // --- Audio Element Event Listeners ---
    if (audioElement) {
        audioElement.addEventListener('ended', () => {
            console.log("Audio playback finished.");
            // The checkBufferAndDisplay function will handle stopping the interval
            // once the buffer is also empty. No need to stop it here directly unless
            // buffer processing should halt immediately on audio end regardless of buffer content.
        });

         audioElement.addEventListener('error', (e) => {
             console.error("Audio element error:", e);
             updateStatus('Error playing audio.', 'error');
             if (displayInterval) {
                 clearInterval(displayInterval);
                 displayInterval = null;
             }
             if (processButton) {
                 processButton.disabled = false;
                 processButton.textContent = "Process Sample Audio 1";
             }
             alert("Could not play audio. Check browser console or file path.");
         });
    }

    // --- Button Event Listener ---
    if (processButton && audioElement) {
        processButton.addEventListener('click', () => {
            console.log("Process Audio button clicked");

            // 1. Reset UI and State
            if (rawTranscriptArea) rawTranscriptArea.value = '';
            if (correctedTranscriptArea) correctedTranscriptArea.value = '';
            if (interleavedContainer) interleavedContainer.innerHTML = ''; // Clear bubbles
            transcriptBuffer = []; // Clear the transcript buffer
            updateStatus('Initializing...', 'idle');

            // Clear any existing display timer interval.
            if (displayInterval) {
                clearInterval(displayInterval);
                displayInterval = null;
            }

            // Disable button and update text during processing.
            processButton.disabled = true;
            processButton.textContent = "Processing...";
            updateStatus('Processing audio...', 'processing');

            // 2. Prepare Audio
            const audioSampleName = 'sample1'; // Hardcoded for now, could be dynamic
            const audioFilePath = `/static/audio_samples/${audioSampleName}.wav`;
            console.log(`Setting audio source to: ${audioFilePath}`);
            audioElement.src = audioFilePath;
            // audioElement.load(); // Not always necessary, but good practice

            // 3. Start Processing and Playback
            // Wait for audio metadata to load before playing (optional but safer)
            // audioElement.oncanplaythrough = () => { // Alternative event
            audioElement.play()
                .then(() => {
                    console.log("Audio playback started successfully.");
                    // Start the interval timer ONLY AFTER playback begins successfully.
                    displayInterval = setInterval(checkBufferAndDisplay, DISPLAY_CHECK_INTERVAL_MS);
                    console.log("Display synchronization timer started.");

                    // 4. Notify Server to Start STT
                    // Send the request to the backend via WebSocket AFTER confirming playback start.
                    console.log(`Emitting 'start_processing' for audio: ${audioSampleName}`);
                    socket.emit('start_processing', { audio_sample: audioSampleName });
                })
                .catch(e => {
                    // Handle errors during audio playback attempt (e.g., browser restrictions)
                    console.error("Error starting audio playback:", e);
                    updateStatus('Error playing audio.', 'error');
                    alert("Could not play audio. Check browser permissions (autoplay) or console for details.");
                    // Reset button state on playback error
                    processButton.disabled = false;
                    processButton.textContent = "Process Sample Audio 1";
                     if (displayInterval) { // Ensure timer is cleared if it somehow started
                        clearInterval(displayInterval);
                        displayInterval = null;
                    }
                });
             // }; // End of oncanplaythrough handler if used
        });
    } else {
        console.error("Process button or audio player element not found in the DOM.");
        updateStatus('UI Error: Missing elements.', 'error');
    }

    // Initial status
    updateStatus('Ready', 'idle');
});