import { Text_To_Speech } from './textToSpeech_module.js';
export { Text_To_Speech };

import { LightningElement, api, track } from 'lwc';
export default class Cmp_TextToSpeech extends LightningElement {

    @api value;
    @api language = 'en-US';
    @api disabled = false;

    speaker = new Text_To_Speech();
    // @track voices = this.speaker.voices;
    synth = this.speaker.synth;
    @track voices = this.speaker.getVoicesList() ?? [];
    @track selectedVoice = this.language;
    status = 'stopped'

    get controlBtnDisabled(){
        return { 
            speak : this.disabled || this.status == 'speaking',
            paused : this.disabled || this.status !== 'speaking',
            stop : this.disabled || (this.status !== 'speaking' && this.status !== 'paused'),
            voice: this.disabled || this.status !== 'stopped',
        }
    }

    get infoStatus(){
        if(this.status == 'speaking'){
            return 'Speaking'
        }else if(this.status == 'paused'){
            return 'Paused'
        }else if(this.status == 'stopped'){
            return 'Stopped';
        }
    }

    actionMethods = {
        speak : () => { this.handleRecordingStart() },
        paused : () => { this.handleRecordingPause() },
        stop : () => { this.handleRecordingStop() },
    }


    controlRecording(event){
        try {
            let action = event.currentTarget.dataset.action;
            this.actionMethods[action]();
        } catch (error) {
            console.log('error in controlRecording : ', error.stack);
        }
    }

    handleRecordingStart(){
        try {
            // Try to resume first if paused
            if (this.synth.paused) {
                this.speaker.resume();
                this.status = 'speaking'
                // this.simulateVisualizer();
                // updateIndicator(true);
                return;
            }
            // Otherwise, start a new speech
            const text = this.value;
            const voiceName = this.speaker.getVoiceByName(this.selectedVoice || this.language);

            if (text) {
                this.speaker.speak(text, {voiceName: voiceName, rate: 1});
                this.status = 'speaking'
                // this.simulateVisualizer();
                
                // updateIndicator(true);

                // Optional: Add event listener to stop indicator when speech ends
                // this.speaker.synth.onend = () => updateIndicator(false);
                // this.speaker.synth.onerror = () => updateIndicator(false);
            }
        } catch (error) {
            console.log('error in handleRecordingStart : ', error.stack);
        }
    }

    handleRecordingPause(){
        try {
            this.speaker.pause();
            this.status = 'paused';
            // this.stopVisualizer();
        } catch (error) {
            console.log('error in handleRecordingPause : ', error.stack);
        }
    }

    handleRecordingStop(){
        try {
            this.speaker.stop();
            this.status = 'stopped';
            // this.stopVisualizer();
        } catch (error) {
            console.log('error in handleRecordingStop : ', error.stack);
        }
    }

    handleVoiceChange(event){
        if(this.status !== 'stopped') return;
        this.selectedVoice = event.detail.value;
    }

    showVisualize = true;

    simulateVisualizer() {
        if (this.status !== 'speaking' || this._hideVisualizer) return;

        if (!this._canvas) this._canvas = this.template.querySelector('.visualizer');
        this._canvasCtx = this._canvas.getContext('2d');

        const WIDTH = this._canvas.width;
        const HEIGHT = this._canvas.height;

        this._animationFrame = requestAnimationFrame(() => this.simulateVisualizer());

        this._canvasCtx.fillStyle = '#eee';
        this._canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        this._canvasCtx.lineWidth = 4;
        this._canvasCtx.strokeStyle = 'rgba(87, 81, 255, 1)';
        this._canvasCtx.beginPath();

        const segments = 100;
        const sliceWidth = WIDTH / segments;
        let x = 0;

        for (let i = 0; i < segments; i++) {
            // Fake waveform animation (bouncy)
            const y = HEIGHT / 2 + Math.sin(i / 2 + performance.now() / 150) * (HEIGHT / 4);

            if (i === 0) {
                this._canvasCtx.moveTo(x, y);
            } else {
                this._canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        this._canvasCtx.stroke();
    }

    stopVisualizer() {
        this.status = 'stopped';
        this._hideVisualizer = true;
        if (this._animationFrame) cancelAnimationFrame(this._animationFrame);
    }



}