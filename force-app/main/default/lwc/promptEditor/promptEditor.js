import { LightningElement, track, wire, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getPrompts from '@salesforce/apex/PromptEditorController.getPrompts';
import savePrompt from '@salesforce/apex/PromptEditorController.savePrompt';
import deletePrompt from '@salesforce/apex/PromptEditorController.deletePrompt';

export default class PromptEditor extends LightningElement {
    
    @track job_summary_prompts = [];
    @track shift_end_log_summary_prompts = [];

    promptKeyByType = {
        'job_summary_prompts' : 'Job Summary',
        'shift_end_log_summary_prompts' : 'Shift End Log Summary',
    }

    prompts_backup = {
        job_summary_prompts: this.job_summary_prompts, 
        shift_end_log_summary_prompts: this.shift_end_log_summary_prompts
    };

    namespace = this.template?.host?.nodeName?.toLowerCase()?.startsWith('wfrecon-') ? 'wfrecon__' : '';
    activeSectionName = ['job_summary_prompts', 'shift_end_log_summary_prompts'];

    isNewDisabled = {
        job_summary_prompts : false,
        shift_end_log_summary_prompts : false,
    };

    @track confirmation = {};

    connectedCallback(){
        this.namespace = this.template?.host?.nodeName?.toLowerCase()?.startsWith('wfrecon-') ? 'wfrecon__' : '';
        this.overrideSLDS();
        this.fetchPrompts();
    }


    fetchPrompts(){
        try {
            getPrompts()
            .then(result => {
                console.log('result : ', result);
                if(result.success){

                    this.job_summary_prompts = result.prompts?.['Job Summary']?.map(ele => {return this.setupSinglePrompt(ele);}) ?? [];
                    this.shift_end_log_summary_prompts = result.prompts?.['Shift End Log Summary']?.map(ele => {return this.setupSinglePrompt(ele);}) ?? [];

                    this.prompts_backup = {
                        job_summary_prompts: JSON.parse(JSON.stringify(this.job_summary_prompts)),
                        shift_end_log_summary_prompts: JSON.parse(JSON.stringify(this.shift_end_log_summary_prompts)),
                    }
                    
                }
                else if(result.error){
                    this.showToast('Error', result.error, 'error')
                }
                else{
                    this.showToast('Error', 'Something went wrong!', 'error')
                }
            })
            .catch(error => {
                console.log('error in fetchPrompts : ', error.body?.message ?? error.message);
            })
        } catch (error) {
            console.log('error in fetchPrompts : ', error.message);
            
        }
    }

    setupSinglePrompt(prompt){
        try {
            prompt.prompt_name = prompt.Prompt_Name__c;
            prompt.prompt_body = prompt.Prompt_Body__c;
            prompt.CreatedByName = prompt.CreatedBy?.Name;
            prompt.LastModifiedByName = prompt.LastModifiedBy?.Name;
            prompt.isNotEdit = true;
            prompt.isEdit = false;
            prompt.isNew = false;
            return prompt;
        } catch (error) {
            console.log('error to setupSinglePrompt : ', error.message);
            return prompt;
        }
    }

    toggleEdit(event){
        try {
            let id = event.currentTarget.dataset.id;
            let type = event.currentTarget.dataset.type;
            let prompt = this[type].find(ele => ele.Id === id);
            if(!prompt) return;
    
            prompt.isEdit = !prompt.isEdit;
            prompt.isNotEdit = !prompt.isNotEdit;
    
            if(!prompt.isNotEdit && prompt.isNew) return;

            // when click to cancel edit
            this[type] = JSON.parse(JSON.stringify(this.prompts_backup[type]));

        } catch (error) {
            console.log('error toggleEdit : ', error.message);
        }
    }

    handleEdit(event){
        try {
            let id = event.currentTarget.dataset.id;
            let type = event.currentTarget.dataset.type;
            let prompt = this[type].find(ele => ele.Id === id);
            if(!prompt) return;
            let field = event.currentTarget.dataset.name;
            let value = event.target.value;
            if(field == 'prompt_name' && value?.length > 255) {
                event.target.value = value.substring(0, 255);
                return;
            };
            prompt[field] = value;

        } catch (error) {
            console.log('error handleEdit : ', error.message);
        }
    }

    handleSave(event){
        try {
            let id = event.currentTarget.dataset.id;
            let type = event.currentTarget.dataset.type;
            let prompt = this[type].find(ele => ele.Id === id);
            if(!prompt) return;

            if(!prompt.prompt_name.trim()){
                this.showToast('Error', 'Prompt name is required!', 'error');
                return;
            }
            else if(!prompt.prompt_body.trim()){
                this.showToast('Error', 'Prompt body is required!', 'error');
                return;
            }
    
            let promptRecord = {
                Id : prompt.Id,
                Prompt_Name__c : prompt.prompt_name,
                Prompt_Body__c : prompt.prompt_body,
            }

            if(prompt.isNew) {
                delete promptRecord.Id
                promptRecord.Prompt_Type__c = this.promptKeyByType[type];
            };
            
            savePrompt({prompt : promptRecord, isCreate: prompt.isNew ? true : false})
            .then(result => {
                console.log('result : ', result);
                if(result.success){ 
                    this[type] = this[type]?.map(ele => {
                        if((ele.Id === result.prompt.Id) || (prompt.isNew && ele.isNew)){
                            return this.setupSinglePrompt(result.prompt);
                        }
                        else return ele;
                    }) ?? [];
                    console.log('this[type] : ', this[type]);
                    if(prompt.isNew) this.isNewDisabled[type] = false; 
                    this.showToast('Success', 'Prompt saved successfully!', 'success');
                }
                else if(result.error){
                    this.showToast('Error', result.error, 'error')
                }
                else{
                    this.showToast('Error', 'Something went wrong!', 'error')
                }
            })
            .catch(error => {
                console.log('error in savePrompt : ', error.body?.message ?? error.message);
            })
        } catch (error) {
            console.log('error in handleSave : ', error.message);
        }
    }

    handleDeleteConfirm(event){
        let currentTarget = event.currentTarget;
        this.confirmation = {
            show: true, title : 'Delete !!!', message: 'are you sure you want to delete this prompt?',
            confirm: () => {  this.handleDelete(event, currentTarget); this.confirmation = {}; }, 
            cancel : () => { this.confirmation = {} }
        }
    }


    handleDelete(event, currentTarget){
        try {
            let _currentTarget = event.currentTarget ?? currentTarget;
            let id = _currentTarget.dataset.id;
            let type = _currentTarget.dataset.type;
            let prompt = this[type].find(ele => ele.Id === id);
            if(!prompt) return;

            if(prompt.isNew){
                // If the prompt is new, just remove it from the list
                this[type].splice(0, 1);
                this.prompts_backup[type].splice(0, 1);
                this.isNewDisabled[type] = false;
                return;
            }

            // If the prompt is exists in system, delete from the system
            deletePrompt({promptId : id})
            .then(result => {
                console.log('result : ', result);
                if(result.success){ 
                    this.showToast('Success', 'Prompt deleted successfully!', 'success');
                    this[type] = this[type].filter(ele => ele.Id !== id);
                    this.prompts_backup[type] = this.prompts_backup[type].filter(ele => ele.Id !== id);
                }
                else if(result.error){
                    this.showToast('Error', result.error, 'error')
                }
                else{
                    this.showToast('Error', 'Something went wrong!', 'error')
                }
            })
            .catch(error => {
                console.log('error in deletePrompt apex : ', error.body?.message ?? error.message);
            })
            
        } catch (error) {
            console.log('error in handleDelete : ', error.message);
        }
    }

    handleCreate(event){
        try {
            let type = event.currentTarget.dataset.type;

            if(this.isNewDisabled[type]) return;

            if(!Object.keys(this.promptKeyByType)?.includes(type)){
                this.showToast('Error', 'Please select a prompt type!', 'error');
                return;
            };
    
            let newPrompt = {
                Id : (new Date()).toISOString(),
                prompt_name : '',
                prompt_body : '',
                isNotEdit : false,
                isEdit: true, isNew: true,
                Prompt_Type__c : this.promptKeyByType[type],
            };

            this[type].unshift(newPrompt);
            this.prompts_backup[type].unshift(newPrompt);
            this.isNewDisabled[type] = true;
        } catch (error) {
            console.log('error in handleCreate : ', error.message);
        }
    }   

    handleConfirmation(event){
        let action = this.confirmation?.[event.type];
        if(action) action();
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    overrideSLDS(){
        // Create style element if it doesn't exist
        const style = document.createElement('style');
        style.textContent = `
            .accordion-container .section-control {
                background: rgba(94, 90, 219, 0.9) !important;
                color: white !important;
                margin-bottom: 4px;
                --slds-c-icon-color-foreground-default: #ffffff !important;
                font-weight: 600 !important;
                border-radius: 4px;
            }

            .accordion-container .slds-accordion__summary-content{
                font-size: medium;
            }

            .prompt-container .slds-textarea, .prompt-container .slds-input{
                border: 1px solid #5e5af9;
                padding-block: 0.25rem;
                transition: all ease 0.15s;

                &:focus-visible{
                    box-shadow: 0px 0px 0px 1px #6e6adf !important;
                }
            }

            .prompt-container .slds-textarea[disabled],  .prompt-container .slds-textarea.slds-is-disabled,
            .prompt-container .slds-input[disabled],  .prompt-container .slds-input.slds-is-disabled{
                border: 1px solid #24242400 !important;
                background: light-dark(#fff, #242424) !important;
            }
        `;
        this.template.host?.appendChild(style);
    }
}