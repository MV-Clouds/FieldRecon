import { LightningElement, track, api } from 'lwc';
import getSavedClips from '@salesforce/apex/CollectShiftRecordingsController.getSavedClips';
import saveClipToMobilization from '@salesforce/apex/CollectShiftRecordingsController.saveClipToMobilization';
import deleteClip from '@salesforce/apex/CollectShiftRecordingsController.deleteClip';

export default class CollectShiftRecordings extends LightningElement {


    @api recordId;
    @track crewLeaderId;
    @track mobilizationId;
    @track clips = [];

    connectedCallback(){
        this.overrideSLDS();
        this.fetchTodaysClips();
    }

    fetchTodaysClips(){

        let params = { 
            jobId: this.recordId, 
        }

        getSavedClips({paramString : JSON.stringify(params)})
        .then(result => {
            console.log('result : ', result);
            if(result.error){
                console.log('error : ', result.error);
                return;
            }
            this.clips = result.clips ?? [];
        })
        .catch(error => {
            console.log('error : ', error);
        })
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
            this.clips.unshift(result.newClip[0]);
        })
        .catch(error => {
            console.log('error : ', error);
        })
        
    }

    handleSaveRecoding(event){
        console.log('recording blob  : ', event.target.value);
        this.initiateSaveRecording(event.target.value, event.target.value?.type);
    }

    handleDeleteClip(event){
        let clipId = event.currentTarget.dataset.id;
        deleteClip({ cvId : clipId })
        .then(result => {
            console.log('result : ', result);
            if(result.error){
                return;
            }
            this.clips = this.clips?.filter(clip => clip.Id != clipId);
        })
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