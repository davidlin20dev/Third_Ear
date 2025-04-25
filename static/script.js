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

    // Event listener for the button
    if (processButton) {
        processButton.addEventListener('click', () => {
            console.log("Process Audio button clicked");

            rawTranscriptArea.value = '';
            correctedTranscriptArea.value = '';
            interleavedContainer.innerHTML = '';
            lastRawText = null;

            // Simulation
            console.log("Simulating transcript data...")

            setTimeout(() => {
                const raw1 = "Hi, uhm it it custom servicer?"
                appendToTextarea(rawTranscriptArea, "Raw: " + raw1);
                addBubble(raw1, 'raw');
                lastRawText = raw1;
            }, 500);

            setTimeout(() => {
                const corrected1 = "Hi, is it customer service?";
                appendToTextarea(correctedTranscriptArea, "Correct: " + corrected1);
                if (lastRawText === "Hi, uhm it it custom servicer?") {
                    addBubble(corrected1, 'correct1');
                }
            }, 1000);

            setTimeout(() => {
                const raw2 = "Yes I needing help with my account";
                appendToTextarea(rawTranscriptArea, "Raw: " + raw2);
                addBubble(raw2, 'raw');
                lastRawText = raw2;
            }, 1500);

            setTimeout(() => {
                const corrected2 = "Yes, I need help with my account.";
                appendToTextarea(correctedTranscriptArea, "Corrected: " + corrected2);
                 if (lastRawText === "Yes I needing help with my account") {
                    addBubble(corrected2, 'corrected');
                 }
            }, 2000);
             setTimeout(() => {
                const raw3 = "the billing is incorrect i think";
                appendToTextarea(rawTranscriptArea, "Raw: " + raw3);
                addBubble(raw3, 'raw');
                lastRawText = raw3;
            }, 2500);

            setTimeout(() => {
                const corrected3 = "I think the billing is incorrect.";
                appendToTextarea(correctedTranscriptArea, "Corrected: " + corrected3);
                 if (lastRawText === "the billing is incorrect i think") {
                    addBubble(corrected3, 'corrected');
                 }
            }, 3000);
        })
    }
});