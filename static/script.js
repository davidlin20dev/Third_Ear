document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");

    // Get references to UI elements
    const rawTranscriptArea = document.getElementById('raw-transcript-area');
    const correctedTranscriptArea = document.getElementById('corrected-transcript-area');
    const interleavedContainer = document.getElementById('interleaved-bubbles-content')
    const processButton = document.getElementById('process-audio-btn')

    let lastRawText = null;

    function appendToTextarea(textareaElement, text) {
        textareaElement.value += text + "\n";
        textareaElement.scrollTop = textareaElement.scrollHeight;
    }

    function addBubble(text, type) {
        const bubble = document.createElement('div');
        bubble.classList.add('bubble');
        bubble.classList.add(type === 'raw' ? 'raw-bubble' : 'corrected-bubble');
        bubble.textContent = text;
        interleavedContainer.appendChild(bubble);
        interleavedContainer.scrollTop = interleavedContainer.scrollHeight;
    }

    // WebSocket Connection
    const socket = io();

    socket.on('connect', () => {
        console.log('WebSocket connected! Socket ID:', socket.id);
    });

    socket.on('disconnect', () => {
        console.log('WebSocket disconnected.')
    })

    socket.on('response', (msg) => {
        console.log('Server response:', msg)
    })

    // WebSocket Event Listeners for transcripts
    socket.on('raw_transcript_update', (data) => {
        console.log('Received raw:', data.text);
        appendToTextarea(rawTranscriptArea, "Raw: " + data.text);
        addBubble(data.text, 'raw');
    })

    socket.on('corrected_transcript_update', (data) => {
        console.log('Received corrected:', data.text);
        appendToTextarea(correctedTranscriptArea, "Corrected: " + data.text);
        addBubble(data.text, 'corrected');
    });

    socket.on('processing_finished', (data) => {
        console.log('Processing finished: ', data.status)
        processButton.disabled = false;
        processButton.textContent = "Process Sample Audio 1";
    })

    socket.on('processing_error', (data) => {
        console.error('Processing error:', data.error);
        alert("An error occurred during processing: " + data.error);
        processButton.disable = false;
        processButton.textContent = "Process Sample Audio 1"
    })

    // Event listener for the button
    if (processButton) {
        processButton.addEventListener('click', () => {
            console.log("Process Audio button clicked");

            if (rawTranscriptArea) rawTranscriptArea.value = '';
            if (correctedTranscriptArea) correctedTranscriptArea.value = '';
            if (interleavedContainer) interleavedContainer.innerHTML = '';

            processButton.disabled = true;
            processButton.textContent = "Processing...";

            const sampleToProcess = 'sample1';
            console.log(`Emitting start_processing for ${sampleToProcess}`);
            socket.emit('start_processing', { audio_sample: sampleToProcess})
        })
    } else {
        console.log("Process button not found")
    }
});