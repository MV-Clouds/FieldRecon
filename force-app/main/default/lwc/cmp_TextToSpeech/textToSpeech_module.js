/**
 * TTS_Speaker Class
 * A reusable class for Text-to-Speech using the Web Speech API.
 */
export class Text_To_Speech {

    voices = [];
    synth;

    constructor() {
        this.synth = window.speechSynthesis;
        this.voices = [];
        this.loadVoices();
    }

    /**
     * Loads the available voices from the browser.
     * It handles the asynchronous nature of voice loading in some browsers.
     */
    loadVoices() {
        const getVoices = () => {
            this.voices = this.synth.getVoices().sort((a, b) => {
                const aname = a.name.toUpperCase();
                const bname = b.name.toUpperCase();
                if (aname < bname) return -1;
                if (aname > bname) return 1;
                return 0;
            });
            console.log(`TTS_Speaker initialized with ${this.voices.length} voices.`);
        };

        // Check if voices are already loaded
        if (this.voices.length > 0) {
            return;
        }

        // Use the event listener for browsers that load voices asynchronously
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = getVoices;
        } else {
            // For browsers that load synchronously (or after a slight delay)
            getVoices();
        }
    }

    /**
     * Finds a voice by name or returns the default voice.
     * @param {string} voiceName - The name of the voice to find (e.g., 'Google US English').
     * @returns {SpeechSynthesisVoice | null} The selected voice object.
     */
    getVoiceByName(voiceName) {
        if (!this.voices.length) {
            console.warn("Voices not loaded yet. Using default.");
            return null;
        }
        return this.voices.find(v => v.name === voiceName)  || this.voices?.find(v => v.default) || this.voices?.at(0) || null;
    }

    /**
     * Speaks the given text with optional configuration.
     * @param {string} text - The text content to be spoken.
     * @param {object} [options] - Optional settings for the speech.
     * @param {string} [options.voiceName] - Name of the voice to use.
     * @param {number} [options.pitch=1] - Pitch of the voice (0 to 2).
     * @param {number} [options.rate=1] - Speed of the voice (0.1 to 10).
     */
    speak(text, options = {}) {
        if (!this.synth) {
            console.error("Web Speech API is not supported in this browser.");
            return;
        }

        if (this.synth.speaking) {
            // Cancel any currently speaking utterance before starting a new one
            this.synth.cancel();
        }

        const textToSpeak = String(text).trim();

        if (textToSpeak === '') {
            return;
        }

        const utterance = new SpeechSynthesisUtterance(textToSpeak);

        // Apply voice
        const selectedVoice = this.getVoiceByName(options.voiceName);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        // Apply options (using defaults if not provided)
        utterance.pitch = options.pitch !== undefined ? options.pitch : 1;
        utterance.rate = options.rate !== undefined ? options.rate : 1;

        // Start speaking
        this.synth.speak(utterance);
    }

    /**
     * Pauses the currently speaking utterance.
     */
    pause() {
        if (this.synth.speaking && !this.synth.paused) {
            this.synth.pause();
            console.log("Speech paused.");
            return true;
        }
        return false;
    }

    // --- NEW METHOD ---
    /**
     * Resumes a paused utterance.
     */
    resume() {
        if (this.synth.speaking && this.synth.paused) {
            this.synth.resume();
            console.log("Speech resumed.");
            return true;
        }
        return false;
    }
    
    /**
     * Stops any current speech.
     */
    stop() {
        if (this.synth.speaking) {
            this.synth.cancel();
        }
    }

    /**
     * Retrieves the list of loaded voices for UI display.
     * @returns {Array<SpeechSynthesisVoice>} The array of voice objects.
     */
    getVoicesList() {
        return this.voices;
    }
}