Product Requirements Document (PRD)
1. Document Information

Title: Browser-Based Real-Time Mouth Animator (Live Avatar Lip Sync App)
Version: 1.0
Date: February 12, 2026
Author: Grok (xAI)
Status: Draft
Purpose: This PRD defines the requirements and technical specifications for a pure browser-based application that performs real-time mouth animation on a user-provided 2D character (or 2D-rendered 3D stills) using live audio input and synchronized text input. The app is designed for integration as a browser source in streaming software (e.g., OBS Studio, Streamlabs) to enable live-talking avatars, with a primary use case of visualizing AI responses (e.g., Grok) with accurate lip sync.

2. Introduction
2.1 Overview
The application emulates core functionality of Adobe Character Animator but in a lightweight, browser-native form focused on mouth animation (lip sync). It supports:

Real-time animation driven by live audio (microphone or routed system audio).
Enhanced accuracy using pre-provided text transcripts streamed in real-time.
User-uploaded character assets (base face + mouth shapes/visemes).
Transparent background for seamless overlay in streaming tools.

The app avoids speech-to-text processing by leveraging provided text (e.g., from AI response streaming), while using audio for precise timing and energy-based blending. This hybrid approach ensures low latency and natural rhythm without relying on heavy ML models unless optionally added.
2.2 Objectives

Achieve sub-100ms end-to-end latency from audio input to visual mouth movement.
Support simple character rigs (8–12 viseme shapes) for easy setup.
Run entirely in the browser (no backend, no native dependencies).
Be compatible with OBS browser sources (transparent canvas, fullscreen capable).
Provide smooth interpolation between viseme frames for natural appearance.
Handle silence, noise, and variable speech rates gracefully.

2.3 Target Users

Live streamers (e.g., VTubers, AI interaction broadcasters).
Users visualizing AI conversations (e.g., Grok avatar in streams).
Developers integrating custom avatars.

2.4 Scope

In Scope: Audio capture, text input, viseme mapping, canvas rendering, character asset upload/parsing, real-time sync.
Out of Scope: Full body rigging, eye/blink animation, advanced 3D (beyond 2D-rendered stills), backend hosting, mobile optimization (desktop-first).

3. Functional Requirements





















































IDRequirementDescriptionPriorityFR-01Audio CaptureCapture live audio via navigator.mediaDevices.getUserMedia. Support microphone input (or virtual audio routing for clean AI voice).HighFR-02Text InputAccept real-time text chunks (e.g., via DOM text area update, EventEmitter, or WebSocket for advanced integration). Text arrives synchronized with audio (e.g., streamed as AI generates).HighFR-03Character SetupUpload base face image (PNG with transparent mouth region) + viseme mouth images (individual PNGs or sprite sheet). Optional PSD parsing for layered import.HighFR-04Viseme AnimationMap processed input to viseme sequence and render mouth shapes with smooth blending at ≥60 FPS.HighFR-05ControlsStart/Stop button, mic permission handling, preview mode, opacity/scale adjustments.MediumFR-06TransparencyCanvas with transparent background (alpha channel) for OBS overlay.HighFR-07Fallback ModeAudio-only mode (volume-based openness) if text unavailable.Medium
4. Non-Functional Requirements









































IDRequirementDetailsMetricNFR-01PerformanceReal-time processing with low CPU/GPU usage.<100ms latency, 60 FPS on mid-range hardware (e.g., 2020+ laptop)NFR-02CompatibilityChrome, Edge, Firefox (latest). No Safari (Web Audio limitations).Tested on Chromium-based browsersNFR-03SecurityMic access only on user consent; no data storage/transmission.Local-only processingNFR-04UsabilitySingle-page app; intuitive drag-and-drop setup.<5 minutes to configure characterNFR-05ReliabilityGraceful handling of audio drops, silence (default to neutral viseme). Noise filtering via basic thresholding.No crashes on variable input
5. Technical Specifications
5.1 Architecture Overview

Frontend-Only: Single HTML/JS page.
Modules:
AudioProcessor (Web Audio API + AudioWorklet for low-latency buffering).
TextProcessor (phoneme/viseme mapping from text).
SyncEngine (align text-derived visemes with audio energy peaks).
Renderer (HTML Canvas + requestAnimationFrame loop).
AssetManager (image loading, optional PSD parsing via psd.js).

Data Flow:
Audio → Buffer (30ms chunks) → Energy analysis.
Text → Phoneme sequence → Viseme queue.
Sync → Timed viseme events → Render mouth overlay.


5.2 Tech Stack

Core APIs: Web Audio API, Canvas API, MediaStream API.
Libraries (lightweight, bundleable):
psd.js or upng-js for asset parsing (optional).
No heavy frameworks (vanilla JS preferred; optional Fabric.js for canvas utilities).
No external ML (keep <500KB bundle); optional TensorFlow.js for advanced audio viseme detection.

Viseme Set: 9 standard shapes (inspired by Rhubarb Lip Sync for broad compatibility):












































































Viseme IDNameDescriptionExample Phonemes (ARPABET approx.)Mouth Appearance0XRest/NeutralSilence, pausesClosed, relaxed1AOpen (wide)AA, AE, AHWide open (e.g., "cat")2BRoundedAO, OWRounded (e.g., "boat")3CWide smileIY, IHTeeth visible, wide (e.g., "see")4DPursedUW, UHLips pursed (e.g., "you")5EConsonant closureP, B, MLips closed (e.g., "map")6FLower lip inF, VLower teeth on lip (e.g., "fish")7GTongue outTH, DHTongue between teeth (e.g., "the")8HTeeth/lipS, Z, CH, JH, SH, ZHNarrow with teeth (e.g., "see")
5.3 Key Components (Detailed Implementation Notes)
5.3.1 Audio Processing

Use AudioContext with MediaStreamAudioSourceNode.
Process in AudioWorklet (preferred) or ScriptProcessorNode (fallback) with 512–1024 sample buffers.
Compute RMS volume per buffer: sqrt(sum(samples^2) / length).
Detect peaks: Threshold >0.1 normalized; use for syllable timing and openness intensity (0–1 scale for blending).
Smoothing: Exponential moving average (alpha 0.7) for natural decay.

5.3.2 Text Processing & Viseme Mapping

Input: Text chunks (strings) with approximate timestamps (performance.now() on receipt).
Step 1: Normalize text (lowercase, remove punctuation).
Step 2: Rule-based phoneme approximation (lightweight, no dictionary needed):
Use a simple regex/state machine mapper (e.g., scan for vowels/consonants).
Example mapping logic:
Vowels: 'a/e/ae/ah' → Viseme 1; 'o' → 2; 'ee' → 3; etc.
Consonants: 'm/b/p' → 5; 'f/v' → 6; 'th' → 7.


Step 3: Generate viseme sequence with estimated durations (e.g., 80–150ms per phoneme, adjustable).
For streamed text: Queue incoming chunks; process incrementally.

5.3.3 Synchronization Engine

Hybrid timing:
Primary: Audio energy peaks trigger viseme transitions (e.g., peak → open viseme).
Secondary: Stretch/shift text-derived viseme timings to align with detected syllable peaks.
Buffer: 200–500ms lookahead queue for predictive blending.
Interpolation: Linear lerp opacity/position between current/next viseme (e.g., 50ms transitions).

Silence handling: Fade to Viseme 0 after 300ms no energy.

5.3.4 Rendering

Canvas (1920x1080 default, resizable).
Layers:
Base face (static image).
Mouth overlay (dynamic viseme PNG, positioned via user calibration or auto-center).

Loop: requestAnimationFrame at 60 FPS.
Draw base.
Compute current viseme + blend factor.
Draw blended mouth(s) with opacity.

Transparency: canvas.style.background = 'transparent'.

5.3.5 Asset Management

Drag-and-drop upload.
Base: PNG/JPG with alpha.
Visemes: Folder zip or individual (named viseme0.png ... viseme8.png).
Calibration: Click-to-position mouth overlay.

5.4 User Interface

Single page layout:
Header: Controls (Mic grant, Start/Stop, Upload button).
Center: Live canvas preview.
Sidebar: Asset uploader, viseme tester, text input field (for manual or scripted text).

Minimalist, dark mode default.

5.5 Edge Cases & Mitigations

High noise: RMS threshold tuning.
Delayed text: Fall back to audio energy for openness.
Browser permissions: Polite prompts with explanations.
Performance drops: Reduce FPS to 30, disable blending.

5.6 Future Enhancements

WebSocket for external text/audio streaming.
ML-based viseme detection (e.g., integrate lightweight ONNX model).
More visemes (ARKit 52 blendshapes via multiple overlays).