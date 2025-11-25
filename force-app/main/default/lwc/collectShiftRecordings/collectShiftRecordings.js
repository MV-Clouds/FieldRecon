import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getSavedClips from '@salesforce/apex/CollectShiftRecordingsController.getSavedClips';
import saveClipToMobilization from '@salesforce/apex/CollectShiftRecordingsController.saveClipToMobilization';
import deleteClip from '@salesforce/apex/CollectShiftRecordingsController.deleteClip';

export default class CollectShiftRecordings extends LightningElement {


    @api recordId;
    @track crewLeaderId;
    @track mobilizationId;
    @track clips = [];
    isLoading;
    clipsTotalSize = 0;
    clipSizeLimit = 10 * 1024 * 1024

    get limitExceeded(){
        return this.clipsTotalSize > this.clipSizeLimit;
    }

    get clipSizeLimits(){
        return this.calculateSize(this.clipsTotalSize)
    }

    connectedCallback(){
        this.fetchTodaysClips();
    }

    fetchTodaysClips(){
        try {
            this.isLoading = true;
            let params = { jobId: this.recordId }
    
            getSavedClips({paramString : JSON.stringify(params)})
            .then(result => {
                console.log('result : ', result);
                if(result.error){
                    // If Result Contains Error Then Show Toast
                    // If Result error also contains "somethingWentWrong", means you can't show the error message to user...
                    this.showToast('', result.somethingWentWrong ? 'Something went wrong!' : result.error, 'error');
                    return;
                }

                // Collect Clips, crewLeaderId and mobilizationId for further use
                this.clips = result.clips.map(ele => { 
                    return { ...ele, size_mb: this.calculateSize(ele.ContentSize)?.MB}
                }) ?? [];
                this.crewLeaderId = result.crewLeaderId;
                this.mobilizationId = result.mobilizationId;
                this.clipsTotalSize = this.clips.reduce((acc, clip) => acc + Number(clip.ContentSize), 0);
                console.log('clipsTotalSize : ', this.clipsTotalSize);
                
            })
            .catch(error => {
                console.log('error : ', error);
            })
            .finally(() => {
                this.isLoading = false;
            })
        } catch (error) {
            console.log('error in fetchTodaysClips : ', error.stack);
        }
    }

    initiateSaveRecording(blob, mimeType){
        const reader = new FileReader();
        reader.onloadend = () => {
            const clipData = reader.result;
            this.saveRecordedClip(clipData, mimeType)
        }
        reader.readAsDataURL(blob);
    }

    saveRecordedClip(clipData, mimeType){
        this.isLoading = true;
        let params = { 
            jobId: this.recordId, 
            crewLeaderId: this.crewLeaderId, 
            mobilizationId: this.mobilizationId, 
            clipData: clipData,
            clipExtension: mimeType
        }

        saveClipToMobilization({paramString : JSON.stringify(params)})
        .then(result => {
            console.log('result : ', result);
            if(result.error){
                console.log('error : ', result.error);
                return;
            }

            let newClip = result.newClip[0];
            this.clips.unshift({...newClip, size_mb: this.calculateSize(newClip.ContentSize)?.MB});
            this.clipsTotalSize = this.clips.reduce((acc, clip) => acc + Number(clip.ContentSize), 0);
            console.log('clipsTotalSize : ', this.clipsTotalSize);
            this.showToast('', 'Clip Saved successfully', 'success');
            this.refreshRecording();
        })
        .catch(error => {
            console.log('error : ', error.stack);
        })
        .finally(() => {
            this.isLoading = false;
        })
        
    }

    handleSaveRecoding(event){
        console.log('recording blob  : ', event.target.value);
        console.log('clipsTotalSize : ', this.clipsTotalSize + Number(event.target.value.size));
        if(this.clipsTotalSize + Number(event.target.value.size) > this.clipSizeLimit ){
            this.showToast('Limit Exceeded', 'Your Today\'s Shift Logs Recoding Limit is exceeding. Please try to capture small recording!', 'error')
            return;
        }
        this.initiateSaveRecording(event.target.value, event.target.value?.type);
    }

    refreshRecording(){
        this.template.querySelector('c-cmp_audio-recorder')?.refreshRecording();
    }

    handleDeleteClip(event){
        this.isLoading = true;
        let clipId = event.currentTarget.dataset.id;
        deleteClip({ cvId : clipId })
        .then(result => {
            console.log('result : ', result);
            if(result.error){
                return;
            }
            this.clips = this.clips?.filter(clip => clip.Id != clipId);
            this.clipsTotalSize = this.clips.reduce((acc, clip) => acc + clip.ContentSize, 0);
            console.log('clipsTotalSize : ', this.clipsTotalSize);
            this.showToast('', 'Clip deleted successfully', 'success');
        })
        .finally(() => {
            this.isLoading = false;
        })
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    calculateSize(inByte = 0){
        return {
            Byte: inByte,
            KB: (inByte/(1024)).toFixed(2),
            MB: (inByte/(1024*1024)).toFixed(2),
            GB: (inByte/(1024*1024*1024)).toFixed(2),
        }
    }
}