import { LightningElement, track, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import fetchShiftLogInfo from '@salesforce/apex/CollectWorkLogsController.collectShiftLogInfo';
import getShiftEndLogPrompts from '@salesforce/apex/GenerateJobSummaryController.getShiftEndLogPrompts';
import { subscribe, unsubscribe, onError, setDebugFlag, isEmpEnabled } from 'lightning/empApi';

export default class ShiftEndLogAISummary extends LightningElement {

    @api jobId;
    @api crewLeaderId;
    @api selectedMobilizationId;

    // Most outer parent component methods...
    @api handleLoading;
    @api setupStep2Data;

    isRecordingSummarized = false;
    noLogRecordings = false;

    // new variable for prompts selections
    @track prompts = [];
    selectedPrompt = '';

    get generateSummaryBtnLabel(){
        return this.isRecordingSummarized && !this.noLogRecordings ? 'Re-Generate' : 'Generate'
    }

    infoMessages = {
        ai_error : 'Something went wrong while generating the summary. Please try again.',
        ai_success : 'Summary is ready. Review it and make edits if needed.',
        is_async : 'Shift Log Info is being processed. Please wait for a few seconds.',
        no_recording: 'No recordings found. Please add recordings and try again.'
    }

    connectedCallback(){
        this.namespace = this.template?.host?.nodeName?.toLowerCase()?.startsWith('wfrecon-') ? 'wfrecon__' : '';
        this.fetchPrompts();
        this.overrideSLDS();
    }

    collectShiftLogInfo(){
        this.loading(true);
        
        let params = {
            jobId: this.jobId,
            crewLeaderId: this.crewLeaderId,
            mobilizationId: this.selectedMobilizationId,
            promptId: this.selectedPrompt
        }

        console.log('params :', params);

        fetchShiftLogInfo({paramString : JSON.stringify(params)})
        .then(result => {
            console.log('result : ', result);
            this.loading(false);
            if(result.error){
                this.showToast('Error', result.error, 'error');
                return;
            }
            if(result.ai_Response_Error__c){
                this.showToast('Error', this.infoMessages.ai_error, 'error');
            }
            else if(result.no_recording){
                this.noLogRecordings = true;
                this.showToast('Error', this.infoMessages.no_recording, 'error');
            }
            else if(result.ai_Response__c){
                // Collect AI Response and match fill to input fields
                try {
                    if(typeof this.setupStep2Data === 'function') this.setupStep2Data(JSON.parse(result.ai_Response__c) ?? {});
                } catch (error) {}
                this.isRecordingSummarized = true;
                this.showToast('Success', this.infoMessages.ai_success, 'success');
            }
            else if(result.is_async){
                this.loading(true);
                // When Total Clips Size exceed the 10MB, Recoding Process Method will move to asynchronous apex and
                // AI response will be collected using platform event
                // Subscribe to event
                this.subscribeEvent();
                this.showToast('Success', this.infoMessages.is_async, 'success');
            }
        })
        .catch(error => {
            console.log('error : ', error?.body?.message ?? error?.message);
            this.loading(false);
        })

    }

    subscribeEvent(){
        subscribe('/event/AI_Response__e', -1, (response)=>{
            console.log('Async Response: ',response);

            let ai_result = response.data.payload;

            if(ai_result.ai_Response_Error__c?.trim()){
                this.showToast('Error', this.infoMessages.ai_error, 'error');
            }
            if(ai_result.ai_Response__c?.trim()){
                try {
                    if(typeof this.setupStep2Data === 'function') this.setupStep2Data(JSON.parse(response.data.ai_Response__c) ?? {});
                    this.showToast('Success', this.infoMessages.ai_success, 'success');
                } catch (error) {}
            }

            this.isRecordingSummarized = true;
            this.loading(false);

            // Unsubscribe event once response received
            unsubscribe(this.subscription,()=>{
                console.log('Unsubscribed');
            });
        }).then((result)=>{
            this.subscription = result;
        })
        .catch(error => {
            this.showToast('Error', 'Error to process shift log recordings', 'error')
            this.loading(false);
        })
    }
    
    fetchPrompts(){
        getShiftEndLogPrompts()
        .then(result => {
            if(result.success){
                this.prompts = result.prompts?.map(ele => {
                    return {
                        value : ele.Id, label: ele[this.namespace+'Prompt_Name__c'], description: ele[this.namespace+'Prompt_Body__c']
                    }
                }) ?? [];
            }
            console.log('Prompts => ',this.prompts);
        })
        .catch(error => {
            console.log('Error fetching prompts:', error?.body?.message ?? error?.message);
        })
    }

    handleChange(event) {
        let eventName = event.target.name;
        let eventValue = event.target.value;
        this[eventName] = eventValue;
    }

    overrideSLDS(){
        let style = document.createElement('style');
        style.innerHTML =  `
            .sele-override-slds{
                .prompt-dropdown .slds-combobox__form-element{
                    --slds-s-icon-color-foreground: var(--primary-theme-color)
                }
                .prompt-dropdown .slds-combobox__input{
                    height: 41px;
                    align-items: center;
                    color: var(--primary-theme-color);
                    border-color: var(--primary-theme-color);
                }
            }
        `;
        this.template.host.classList.add('sele-override-slds');
        this.template.host.appendChild(style);

    }

    loading(isLoading){
        if(typeof this.handleLoading === 'function') this.handleLoading(isLoading);
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    // Pass message to parent always with onmessage event...
    dispatchToParent(message, data){
        this.dispatchEvent(new CustomEvent('message', { detail : {message, data} }));
    }
}