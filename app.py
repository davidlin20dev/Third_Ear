from flask import Flask, render_template
import time
from flask_socketio import SocketIO, emit
app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret'
socketio = SocketIO(app)


@app.route('/')
def index():
    return render_template('index.html')

# SocketIO Event Handlers
@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('response', {'data': 'Connected to server.'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('start_processing')
def handle_start_processsing(message):
    print('Received start processing signal:', message)
    audio_sample = message.get('audio_sample', 'default_sample')

    # Simulating the backend processing
    print(f"Simulating processing for: {audio_sample}")

    try:
        raw1= "Hi, uhm it it custom servicer?"
        time.sleep(0.5)
        emit('raw_transcript_update', {'text': raw1})
        print(f"Emmited raw: {raw1}")

        corrected1 = "Hello, welcome to customer service."
        time.sleep(0.5)  # Simulate NLP time
        emit('corrected_transcript_update', {'text': corrected1})
        print(f"Emitted corrected: {corrected1}")

        raw2 = "Yes I needing help with my account"
        time.sleep(0.5)
        emit('raw_transcript_update', {'text': raw2})
        print(f"Emitted raw: {raw2}")

        corrected2 = "Yes, I need help with my account."
        time.sleep(0.5)
        emit('corrected_transcript_update', {'text': corrected2})
        print(f"Emitted corrected: {corrected2}")

        raw3 = "the billing is incorrect i think"
        time.sleep(0.5)
        emit('raw_transcript_update', {'text': raw3})
        print(f"Emitted raw: {raw3}")

        corrected3 = "I think the billing is incorrect."
        time.sleep(0.5)
        emit('corrected_transcript_update', {'text': corrected3})
        print(f"Emitted corrected: {corrected3}")

        print("Simulation finished.")
        emit('processing_finished', {'status': 'Completed'})


    except Exception as e:
        print(f"Error during simulation: {e}")
        emit('processing_error', {'error': str(e)})

if __name__ == '__main__':
    print("Starting Flask-SocketIO server...")

    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)
