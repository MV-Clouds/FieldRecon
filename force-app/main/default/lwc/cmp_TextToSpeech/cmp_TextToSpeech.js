

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
    status = 'stop'

    get controlBtnDisabled(){
        return { 
            speak : this.disabled || this.status == 'speaking',
            paused : this.disabled || this.status !== 'speaking',
            stop : this.disabled || this.status !== 'stopped',
        }
    }

    get infoStatus(){
        if(this.status == 'speaking'){
            return 'Speaking'
        }else if(this.status == 'paused'){
            return 'Paused'
        }else if(this.status == 'stop'){
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
                // updateIndicator(true);
                return;
            }

            // Otherwise, start a new speech
            const text = this.value;
            const voiceName = this.speaker.getVoiceByName(this.selectedVoice || this.language);

            if (text) {
                this.speaker.speak(text, {voiceName: voiceName, rate: 1});
                this.status = 'speaking'
                
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
        } catch (error) {
            console.log('error in handleRecordingPause : ', error.stack);
        }
    }

    handleRecordingStop(){
        try {
            this.speaker.stop();
            this.status = 'stopped';
        } catch (error) {
            console.log('error in handleRecordingStop : ', error.stack);
        }
    }

}