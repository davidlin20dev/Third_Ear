# Third Ear

## Introduction

This project presents a "Third Ear" web prototype, a tool designed to assist contact center agents during live calls. It aims to reduce agent burnout and enhance customer experience (CX) by minimizing back-and-forth communication.

## Issue Addressed

The prototype tackles the significant challenge agents face in accurately understanding customers who

* Speak unclearly due to agitation or strong emotion (agitated speech).
* Have strong or unfamiliar accents.
* Are non-native speakers.
* Are speaking in noisy environments.

These situations can hinder effective communication and negatively impact service quality.

## Core Idea

The central concept is to enhance agent comprehension by providing two simultaneous streams of information:

1.  The raw, real-time Speech-to-Text (STT) transcription of the customer's speech.
2.  An AI-corrected and clarified version of that same transcription.

This prototype simulates this dual-display functionality using a pre-recorded audio file, synchronizing the appearance of both transcript versions with the audio playback.

## Tech Stack
* **Backend:** Python 3, Flask, Flask-SocketIO
* **Frontend:** HTML5, CSS, JavaScript
* **Real-time Communication:** WebSockets (via Socket.IO)
* **Speech-to-Text (STT):** Google Cloud Speech-to-Text API (`google-cloud-speech` library)
* **NLP Correction:** Google Gemini API (`google-generativeai` library, model: `gemini-1.5-flash-latest`)
* **Development Environment:** Localhost, PyCharm (IDE), Git/GitHub (Version Control)
![Third_Ear_Tech_Stack](https://github.com/user-attachments/assets/e81fb278-2e0c-462f-8849-79eae1e92dd4)


## Demo
https://github.com/user-attachments/assets/bcac6ac5-7b86-4c3f-a3cb-4829c5f56121



