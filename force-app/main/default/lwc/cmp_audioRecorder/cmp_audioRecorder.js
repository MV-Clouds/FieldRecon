import { LightningElement, track, api } from 'lwc';

export default class Cmp_audioRecorder extends LightningElement {

    @api disabled;

     // blob of the file
    _value;
    @api get value(){ return this._value};            
    set value(val){ 
        this._value = val; 
        this.prepareClip(this._value);
    }
    
    _hideSave = false;
    @api get hideSave(){ String(this._hideSave) === 'true'}
    set hideSave(val){ this._hideSave = val; }
    
    _hideUpload = false;
    @api get hideUpload(){ String(this._hideUpload) === 'true'}
    set hideUpload(val){ this._hideUpload = val; }
    
    _hideVisualizer = false;
    @api get hideVisualizer(){ String(this._hideVisualizer) === 'true'}
    set hideVisualizer(val){ this._hideVisualizer = val; }
    
    _hideClip = false;
    @api get hideClip(){ String(this._hideClip) === 'true'}
    set hideClip(val){ this._hideClip = val; }

    _hideInfoMessage = false;
    @api get hideInfoMessage(){ String(this._hideInfoMessage) === 'true'}
    set hideInfoMessage(val){ this._hideInfoMessage = val; }
    
    @track clip;
    chunks = [];
    recordState = 'inactive';
    _microphoneIssue;

    _mediaRecorder;
    _stream;
    _audioCtx;
    _analyser;
    _dataArray;
    _canvas;
    _canvasCtx;

    get controlBtnDisabled() {
        let ri = this._microphoneIssue;
        let rs = this.recordState;
        return {
            recording: rs == 'recording' || this.disabled || ri,
            paused: rs == 'paused' || rs == 'inactive' || this.disabled || ri,
            inactive: rs == 'inactive' || this.disabled || ri,
            disabled: this.disabled || ri,
        }
    }

    get recordIcon() {
        return this.recordState == 'paused' ? 'utility:play' : 'utility:record';
    }

    get isPaused(){
        return this.recordState == 'paused';
    }

    get showVisualize(){
        return this.recordState == 'recording' || this.recordState == 'paused'; 
    }

    get showClip(){
        return this.clip && !this._hideClip ;
    }

    get infoMessage(){
        if(this.hideInfoMessage) return '';
        if(this._microphoneIssue){
            return 'Microphone permission has been denied. Please allow microphone permission.';
        }
        else if(!this.clip && this.recordState == 'inactive'){
            return 'Click on Record button to start recording.';
        }
        else if(this.recordState == 'recording'){
            return 'Recording is in progress...';
        }
        else if(this.recordState == 'paused'){
            return 'Recording paused';
        }
        else if(this.recordState == 'inactive'){
            return 'Recording finished';
        }
        else return ''
    }


    async connectedCallback() {
        this.overrideSLDS();
        await this.setupAudio();
    }

    async setupAudio() {
        try {

            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
            if (permissionStatus.state === 'denied') {
                this.showToast('Error', 'Microphone permission has been denied. Please allow microphone permission.', 'error');
                this._microphoneIssue = true;
                return;
            }

            try {
                this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (error) {
                // if user denied permission or microphone not found
                if(error?.name === 'NotAllowedError'){
                    this.showToast('Error', 'Microphone permission denied.', 'error');
                }
                else if(error?.name === 'NotFoundError'){
                    this.showToast('Error', 'Microphone not found.', 'error');
                }
                this._microphoneIssue = true;
                return;
            }

            this._audioCtx = new AudioContext();
            const source = this._audioCtx.createMediaStreamSource(this._stream);

            this._analyser = this._audioCtx.createAnalyser();
            this._analyser.fftSize = 2048;

            this._dataArray = new Uint8Array(this._analyser.fftSize);

            source.connect(this._analyser);

            // Recorder
            this._mediaRecorder = new MediaRecorder(this._stream);

            
            this._mediaRecorder.onstart = () => {
                this.recordState = this._mediaRecorder.state;
                this.drawVisualizer();
                this.dispatchEvent(new CustomEvent('start'));
            }
            
            this._mediaRecorder.onpause = () => {
                this.recordState = this._mediaRecorder.state
                this.dispatchEvent(new CustomEvent('paused'));
            };
            
            this._mediaRecorder.onresume = () => {
                this.recordState = this._mediaRecorder.state;
                this.drawVisualizer();
                this.dispatchEvent(new CustomEvent('resume'));
            };
            
            this._mediaRecorder.onstop = () => {
                this.recordState = this._mediaRecorder.state;
                this.dispatchEvent(new CustomEvent('stop'));
            };
            
            this._mediaRecorder.ondataavailable = e => {
                this.chunks.push(e.data);
                this.collectClip();
            };

        } catch (e) {
            console.error('Audio init error:', e);
        }
    }

    audioActions = {
        recording: () => { this.startRecording() },
        paused: () => { this.pauseRecording() },
        inactive: () => { this.stopRecording() }
    }

    controlRecording(event) {
        try {
            if(this._microphoneIssue) return;
            let action = event.currentTarget.dataset.action;
            if (typeof this.audioActions[action] === 'function') this.audioActions[action]();
        }
        catch (error) {
            console.log('OUTPUT : ', error.stack);
        }
    }

    startRecording() {
        console.log("Start Recording");
        // if recording start from stop state not pause state
        if (!this._mediaRecorder || this._mediaRecorder.state == 'inactive') {
            this.resetRecording();
            this._mediaRecorder.start();
        }
        else if(this._mediaRecorder.state == 'paused'){
            this._mediaRecorder.resume();
        }

    }

    pauseRecording() {
        console.log("Pausing");
        console.log('state : ', this._mediaRecorder.state);
        
        // stop recording on puase
        this._mediaRecorder.pause();
    }

    stopRecording() {
        console.log("Stopping");
        this._mediaRecorder.stop();     // onstop() fires AFTER chunks are populated
    }

    collectClip(){
        try {
            if (this.chunks.length === 0) {
                console.warn("No chunks recorded — skipping clip.");
                return;
            }

            this.value = new Blob(this.chunks, { type: 'audio/webm' });
            this.prepareClip(this.value)

            this.dispatchEvent(new CustomEvent('completed', { detail: { blob : this.value, clip : this.clip} }));

        } catch (error) {
            console.log('error in collectClip : ', error.stack);
            
        }
    }

    prepareClip(blob){
        const url = URL.createObjectURL(blob);
        this.clip = { id: Date.now(), name: `Your Clip`, url, blob };
    }

    saveClip() {
        try {
            this.dispatchEvent(new CustomEvent('save', { detail: { blob : this.value, clip : this.clip} }));
        } catch (error) {
            console.log('error in ', error.stack);
        }
    }

    deleteClip() {
        this.resetRecording();
    }

    @api
    refreshRecording() {
        this.resetRecording();
        this.dispatchEvent(new CustomEvent('refresh'));
    }

    resetRecording(){
        this.clip = null;
        this.chunks = [];
        if (this.recordState == 'recording' || this.recordState == 'paused') {
            this._mediaRecorder.stop();
        }
    }

    drawVisualizer() {
        // Visualizer
        if(this.recordState !== 'recording' || this._hideVisualizer) return;
        if(!this._canvas) this._canvas = this.template.querySelector('.visualizer');
        this._canvasCtx = this._canvas.getContext('2d');

        const WIDTH = this._canvas.width;
        const HEIGHT = this._canvas.height;

        if(this.recordState == 'recording') requestAnimationFrame(() => this.drawVisualizer());

        this._analyser.getByteTimeDomainData(this._dataArray);

        this._canvasCtx.fillStyle = '#eee';
        this._canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        this._canvasCtx.lineWidth = this.recordState === 'recording' ? 8 : 6;
        this._canvasCtx.strokeStyle = this.recordState === 'recording' ? 'rgba(87, 81, 255, 1)' : '#606060ff';

        this._canvasCtx.beginPath();

        const sliceWidth = WIDTH / this._dataArray.length;
        let x = 0;

        for (let i = 0; i < this._dataArray.length; i++) {
            const v = this._dataArray[i] / 128.0;
            const y = v * HEIGHT / 2;

            if (i === 0) {
                this._canvasCtx.moveTo(x, y);
            } else {
                this._canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this._canvasCtx.lineTo(WIDTH, HEIGHT / 2);
        this._canvasCtx.stroke();
    }

    clickFileInput() {
        if(this._microphoneIssue) return;
        this.template.querySelector('[data-name="fileUploader"]')?.click();
    }

    handleFileUpload(event) {
        try {
            if(this._microphoneIssue) return;
            this.value = event.target.files[0];
            this.prepareClip(this.value);
            event.target.files = null;
            event.target.value = null;
            this.dispatchEvent(new CustomEvent('completed', { detail: { blob : this.value, clip : this.clip} }));
        } catch (error) {
            console.log('error in handleFileUpload : ', error.stack);
        }
    }

    showToast(title, message, variant){
        this.dispatchEvent( new ShowToastEvent({ title, message, variant}) );
    }
    
    overrideSLDS(){
        if(!this.template.host) return;
        let style = document.createElement('style');
        style.innerHTML = `
            .slds-override{
                .only-icon-button .slds-button__icon_left,
                .only-icon-button .slds-button__icon_right{
                    margin-inline: 0rem !important;
                }
            }
        `;
        this.template.host.classList.add('slds-override');
        this.template.host.appendChild(style);
    }    
}