"""
Flask-SocketIO application for real-time audio transcription and correction.

This application uses Google Cloud Speech-to-Text (STT) for audio transcription
and Gemini NLP for text correction. It streams audio, processes transcription
responses, and emits real-time updates to connected clients via WebSocket.
"""

from flask import Flask, render_template, request
import time
import io
import os
from flask_socketio import SocketIO, emit
import traceback # Keep traceback for detailed error logging if needed
from google.cloud import speech
import google.generativeai as genai

# --- Configuration ---
# Attempt to load the Gemini API key from environment variables.
try:
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable not set.")
    genai.configure(api_key=GEMINI_API_KEY)
    print("Gemini API Key loaded and configured.")
except ValueError as e:
    print(f"Configuration Error: {e}")
    exit(1) # Exit if critical configuration is missing
except Exception as e:
    print(f"An unexpected error occurred configuring Gemini: {e}")
    exit(1)

# Check for Google Cloud credentials, but allow falling back to default ADC.
if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    print("Warning: GOOGLE_APPLICATION_CREDENTIALS environment variable not set.")
    print("Attempting to use Application Default Credentials (ADC) if available.")

# --- Initialization ---
app = Flask(__name__)
# SECRET_KEY is needed for Flask sessions, which SocketIO might use under the hood.
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'default-secret-key!')
socketio = SocketIO(app, async_mode=None) # Use default threading mode

# Initialize Google Cloud Speech client. Handle potential errors during init.
try:
    speech_client = speech.SpeechClient()
    print("Google Cloud Speech client initialized successfully.")
except Exception as e:
    print(f"FATAL: Error initializing Google Cloud Speech client: {e}")
    print("Speech-to-Text functionality will be unavailable.")
    speech_client = None # Ensure client is None if init fails

# Initialize Gemini NLP model. Handle potential errors during init.
try:
    # Using gemini-1.5-flash-latest as it's generally faster and suitable for this task.
    gemini_model = genai.GenerativeModel('gemini-1.5-flash-latest')
    # Optional: Verify model availability (can be removed in production)
    # print("Available Gemini models:", [m.name for m in genai.list_models()])
    print("Gemini model ('gemini-1.5-flash-latest') initialized successfully.")
except Exception as e:
    print(f"FATAL: Error initializing Gemini model: {e}")
    print("Text correction functionality will be unavailable.")
    gemini_model = None # Ensure model is None if init fails

# --- Flask Routes ---
@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

# --- Helper Functions ---
def get_gemini_correction(text_to_correct: str) -> str:
    """
    Uses the initialized Gemini model to correct grammar, spelling, and clarity
    of the provided text, preserving the original meaning.

    Args:
        text_to_correct: The raw transcription text from STT.

    Returns:
        The corrected text, or a specific error/status message if correction fails.
    """
    # Check if the Gemini model was initialized successfully.
    if not gemini_model:
        print("Gemini correction skipped: Model not available.")
        return "[NLP Correction Service Unavailable]"
    # Avoid calling the API for empty strings.
    if not text_to_correct or text_to_correct.isspace():
        return ""

    # Construct the prompt for Gemini, providing context and instructions.
    prompt = f"""Please act as a text correction tool. The text is from someone who needs help from the customer support. Correct the grammar, spelling, and punctuation, and improve the overall clarity of the following text. This text is a transcription from speech that might be noisy, contain accented speech, or have grammatical errors typical of spoken language. Preserve the original meaning accurately. Do not add any explanations, preamble, or sign-off; provide only the corrected text directly.

Original Text: "{text_to_correct}"

Corrected Text:"""

    try:
        print(f"Sending to Gemini for correction: '{text_to_correct[:80]}...'")
        # Call the Gemini API to generate content based on the prompt.
        response = gemini_model.generate_content(prompt)

        # --- Handle potential API response issues ---
        # Check if the response contains generated parts.
        if not response.parts:
            # If no parts, check for specific reasons like safety blocks.
            if response.candidates and response.candidates[0].finish_reason:
                reason = response.candidates[0].finish_reason.name
                print(f"Gemini generation stopped due to: {reason}")
                print(f"Prompt Feedback: {response.prompt_feedback}")
                # Provide informative message back to the client.
                return f"[Correction Blocked: {reason}]"
            else:
                # Handle cases where the response is unexpectedly empty.
                print("Warning: Gemini response was empty or missing content.")
                return "[Correction Unavailable or Empty]"

        # Extract the corrected text from the response.
        corrected_text = response.text.strip()
        print(f"Received correction from Gemini: '{corrected_text[:80]}...'")
        return corrected_text

    # Catch potential exceptions during the API call.
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        traceback.print_exc() # Log the full traceback for debugging.
        return "[NLP Correction Error]"

# --- SocketIO Event Handlers ---
@socketio.on('connect')
def handle_connect():
    """Handles new client WebSocket connections."""
    print(f'Client connected: {request.sid}')
    # Send a confirmation message back to the newly connected client.
    emit('response', {'data': f'Connected to server with SID: {request.sid}'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handles client WebSocket disconnections."""
    print(f'Client disconnected: {request.sid}')
    # No action needed here usually, but can be used for cleanup if required.

def audio_generator(file_path: str, chunk_size: int = 4096):
    """
    Generator function that reads an audio file in chunks and yields
    them as StreamingRecognizeRequest messages for the Google STT API.

    Args:
        file_path: Path to the audio file (.wav expected).
        chunk_size: Size of audio chunks to read and send in bytes.

    Yields:
        speech.StreamingRecognizeRequest containing audio content chunks.
    """
    try:
        # Open the audio file in binary read mode.
        with io.open(file_path, "rb") as audio_file:
            # Read the file in chunks until the end is reached.
            while True:
                chunk = audio_file.read(chunk_size)
                # If chunk is empty, it means end of file.
                if not chunk:
                    break
                # Yield the chunk wrapped in the required proto message.
                yield speech.StreamingRecognizeRequest(audio_content=chunk)
    except FileNotFoundError:
        print(f"Error: Audio file not found at {file_path}")
        # Re-raise or handle appropriately if needed upstream.
        raise
    except Exception as e:
        print(f"Error reading or streaming audio file {file_path}: {e}")
        # Re-raise or handle appropriately if needed upstream.
        raise

@socketio.on('start_processing')
def handle_start_processing(message: dict):
    """
    Handles the 'start_processing' event from a client. It initiates
    the Google Cloud STT streaming process for a specified audio file and
    sends back raw and corrected transcripts via WebSocket events.

    Args:
        message: A dictionary expected to contain {'audio_sample': 'sample_name'}.
                 Defaults to 'sample1' if not provided.
    """
    client_sid = request.sid
    print(f'Received start processing request from {client_sid}: {message}')

    # Determine the audio file to process.
    audio_sample_name = message.get('audio_sample', 'sample1') # Default to 'sample1'
    # Construct the full path to the audio file.
    audio_file_path = os.path.join('static', 'audio_samples', f'{audio_sample_name}.wav')

    # --- Pre-checks ---
    # Ensure the Speech client is available.
    if not speech_client:
        print("STT processing aborted: Speech client not available.")
        emit('processing_error', {'error': 'Speech processing service unavailable.'}, to=client_sid)
        return

    # Check if the specified audio file exists.
    if not os.path.exists(audio_file_path):
        print(f"STT processing aborted: Audio file not found at {audio_file_path}")
        emit('processing_error', {'error': f'Audio file "{audio_sample_name}.wav" not found on server.'}, to=client_sid)
        return

    # --- Google Cloud STT Streaming Configuration ---
    try:
        # Define the configuration for the audio stream recognition.
        recognition_config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16, # Encoding for WAV files
            sample_rate_hertz=48000, # Sample rate matching the audio file
            language_code="en-US",   # Language of the audio
            enable_automatic_punctuation=True, # Let STT add basic punctuation
            # Optional: Add model="telephony" or "medical_dictation" etc. if applicable
            # model="telephony",
            # use_enhanced=True, # Use enhanced models if available and needed
        )
        # Configure the streaming specific settings.
        streaming_config = speech.StreamingRecognitionConfig(
            config=recognition_config,
            interim_results=False, # Set to False: Only process final results for stability
                                   # Set to True for faster, less accurate intermediate updates
        )

        print(f"Starting STT stream for {audio_file_path} (Client: {client_sid})...")
        # Create the audio generator for the specified file.
        requests_gen = audio_generator(audio_file_path)

        # Initiate the streaming recognition request. This returns an iterator.
        responses = speech_client.streaming_recognize(
            config=streaming_config,
            requests=requests_gen,
        )

        # --- Process STT Responses ---
        # Iterate through the responses received from the STT API stream.
        for response in responses:
            # Each response may contain multiple results; typically focus on the first.
            if not response.results:
                continue # Skip empty responses

            result = response.results[0]
            # Check if there are any transcription alternatives.
            if not result.alternatives:
                continue # Skip if no transcription text is available

            # Get the most likely transcript.
            transcript = result.alternatives[0].transcript.strip()

            # --- Handle Final Results ---
            # We only process results marked as 'is_final' because interim_results=False.
            # If interim_results=True, you would handle both final and non-final results here.
            if result.is_final:
                # Get the end time of the utterance in the audio stream.
                utterance_end_time_secs = 0.0
                if result.result_end_time:
                    utterance_end_time_secs = result.result_end_time.total_seconds()

                print(f"STT Final Raw Transcript (End: {utterance_end_time_secs:.2f}s): '{transcript}'")
                # Emit the raw transcript and its end time to the client.
                emit('raw_transcript_update', {
                    'text': transcript,
                    'end_time': utterance_end_time_secs
                }, to=client_sid)

                # --- Get Gemini Correction ---
                # Send the final raw transcript to Gemini for correction.
                corrected_transcript = get_gemini_correction(transcript)
                print(f"NLP Corrected Transcript: '{corrected_transcript}'")

                # Emit the corrected transcript if correction was successful.
                if corrected_transcript and not corrected_transcript.startswith("["): # Avoid emitting error messages as valid corrections
                    emit('corrected_transcript_update', {
                        'text': corrected_transcript,
                        'end_time': utterance_end_time_secs # Use same end time as raw
                    }, to=client_sid)
                elif corrected_transcript: # Emit specific statuses like '[Correction Blocked: ...]'
                     emit('corrected_transcript_update', {
                        'text': corrected_transcript, # Send the status message
                        'end_time': utterance_end_time_secs
                    }, to=client_sid)


        # --- Stream Finished ---
        print(f"STT stream finished successfully for {audio_file_path} (Client: {client_sid}).")
        # Notify the client that processing is complete.
        emit('processing_finished', {'status': 'Completed successfully'}, to=client_sid)

    # --- Error Handling for STT/Processing ---
    except FileNotFoundError:
        # This might occur if the audio_generator raises it after the initial check
        print(f"STT processing error: Audio file not found during streaming for {client_sid}")
        emit('processing_error', {'error': 'Audio file became unavailable during processing.'}, to=client_sid)
    except Exception as e:
        print(f"Error occurred during STT processing for {client_sid}: {e}")
        traceback.print_exc() # Log the full stack trace for server-side debugging.
        # Send a generic error message to the client.
        emit('processing_error', {'error': f'An unexpected error occurred during transcription: {e}'}, to=client_sid)


# --- Main Execution ---
if __name__ == '__main__':
    """Starts the Flask-SocketIO development server."""
    print("Starting Flask-SocketIO server...")
    # debug=True enables auto-reloading and provides detailed error pages.
    # allow_unsafe_werkzeug=True might be needed for newer Werkzeug versions with reloader.
    # Consider using a production-ready WSGI server (like Gunicorn with eventlet/gevent) for deployment.
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)