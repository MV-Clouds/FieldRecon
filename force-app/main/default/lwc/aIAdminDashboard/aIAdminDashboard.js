import { LightningElement, track, wire, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAICustomSetting from '@salesforce/apex/AIAdminDashboardController.getAICustomSetting';
import updateAICustomSetting from '@salesforce/apex/AIAdminDashboardController.updateAICustomSetting';
import getAIPrompts from '@salesforce/apex/AIAdminDashboardController.getAIPrompts';
import updateAIPrompts from '@salesforce/apex/AIAdminDashboardController.updateAIPrompts';

export default class AIAdminDashboard extends LightningElement {

    shiftEndLogV2Props = {
        recordId : 'a0KC300000DBu7UMAT',
    }


    @track activeSectionName = ['Gemini_Settings', 'Prompt_Editor'];
    namespace = this.template?.host?.nodeName?.toLowerCase()?.startsWith('wfrecon-') ? 'wfrecon__' : '';
    customSetting = {};
    customSetting_backup = {};
    @track geminiSettings = [
        { name: 'Gemini_API_Key__c', label: 'Gemini API Key', type: 'text', value: '' },
        { name: 'Gemini_Model__c', label: 'Gemini Model', type: 'text', value: '' },
        { name: 'Gemini_API_Domain__c', label: 'Gemini API Domain', type: 'text', value: '', disabled: true, },
        { name: 'Gemini_API_Relative_Path__c', label: 'Gemini API Relative Path', type: 'text', value: '', disabled: true, },
    ];

    @track prompts = {
        'Job_Summary' : {},
        'Log_Summary' : {},
    }

    prompts_backup = {};

    get disableSaveButton(){
        return {
            cs : JSON.stringify(this.customSetting) === JSON.stringify(this.customSetting_backup),
            prompt : JSON.stringify(this.prompts) === JSON.stringify(this.prompts_backup),
        }
    }

    connectedCallback(){
        this.namespace = this.template?.host?.nodeName?.toLowerCase()?.startsWith('wfrecon-') ? 'wfrecon__' : '';
        this.overrideSLDS();
        this.fetchAICustomSetting();
        this.fetchAIPrompts();
    }

    fetchAICustomSetting(){
        try {
            getAICustomSetting()
            .then((data) => {
                console.log('data : ', data);
                this.customSetting = JSON.parse(JSON.stringify(data.customSetting));
                // Populate geminiSettings values from the retrieved data
                this.geminiSettings = this.geminiSettings.map(setting => {
                    return { ...setting, value: this.customSetting[this.namespace+setting.name] || '' };
                });
                this.customSetting_backup = JSON.parse(JSON.stringify(this.customSetting));
            })
            .catch((error) => {
                console.log('Error retrieving AI Custom Setting:', error);
            });
        } catch (error) {
            console.log('Error in fetchAICustomSetting:', error.message);
        }
    }

    fetchAIPrompts(){
        try {
            getAIPrompts()
            .then((data) => {
                console.log('AIPrompts data : ', data);
                if(data.prompts){
                    this.organizePrompts(data.prompts);
                }
                else{
                    console.log('No prompts data found.');
                    this.showToast('Error', 'Failed to retrieve AI Prompts.', 'error');
                }
            })
            .catch((error) => {
                console.log('Error retrieving AI Prompts:', error);
            });
        } catch (error) {
            console.log('Error in fetchAIPrompts :', error.message);
            
        }
    }


    handleGeminiSettingUpdate(event){
        try{
            // Handle Gemini setting updates here
            const fieldName = event.target.name;
            const fieldValue = event.target.value;
            
            const setting = this.geminiSettings?.find(item => item.name === fieldName);
            if (setting) {
                setting.value = fieldValue;
            }
            this.customSetting[this.namespace + fieldName] = fieldValue;
        }
        catch(error){
            console.log('Error in handleGeminiSettingUpdate:', error.message);
        }

    }

    saveGeminiSettings(){
        try {
            if(this.disableSaveButton.cs) return;
            // Implement save logic here
            console.log('Saving Gemini Settings:', this.customSetting);
            updateAICustomSetting({ ai_settings: this.customSetting })
            .then((result) => {
                console.log('updateAICustomSetting result : ', result);
                if(result.success) {
                    this.showToast('Success', 'Gemini Settings saved successfully.', 'success');
                    this.customSetting = JSON.parse(JSON.stringify(result.customSetting));
                    this.customSetting_backup = JSON.parse(JSON.stringify(this.customSetting));
                }
                else{
                    this.showToast('Error', 'Failed to save Gemini Settings.', 'error');
                }
            })
            .catch((error) => {
                console.error('Error saving Gemini Settings:', error);
            });
            
        } catch (error) {
            logError('Error in saveGeminiSettings:', error.message);
        }
        
    }

    resetGeminiSettings(){
        try {
            if(this.disableSaveButton.cs) return;
            // Reset Gemini settings to backup values
            this.customSetting = JSON.parse(JSON.stringify(this.customSetting_backup));
            this.geminiSettings = this.geminiSettings.map(setting => {
                return { ...setting, value: this.customSetting[this.namespace+setting.name] || '' };
            });
            this.showToast('Info', 'Gemini Settings have been reset.', 'info');
            console.log('Gemini Settings have been reset.');
        } catch (error) {
            console.log('error in resetGeminiSettings : ', error.message);
            
        }
    }

    handlePromptChange(event){
        try {
            const promptType = event.target.dataset.name;
            const fieldValue = event.target.value;
            
            if(this.prompts[promptType]){
                let prompt = this.prompts[promptType];
                if(prompt) {
                    prompt.value = fieldValue;
                }
            }

            console.log('fieldValue : ', fieldValue);

        } catch (error) {
            console.log('Error in handlePromptChange : ', error.message);
        }
    }

    savePrompt(){
        try {
            if(this.disableSaveButton.prompt) return;
            // Implement save logic here
            console.log('Saving Prompts:', this.prompts);
            
            updateAIPrompts({ ai_prompts: this.prompts })
            .then((result) => {
                console.log('updateAIPrompts result : ', result);
                if(result.success) {
                    this.showToast('Success', 'Prompts saved successfully.', 'success');
                    this.organizePrompts(result.prompts);
                }
                else{
                    this.showToast('Error', 'Failed to save Prompts.', 'error');
                }
            })
            .catch((error) => {
                console.error('Error saving Prompts:', error);
            });
        }
        catch (error) {
            console.log('Error in savePrompts : ', error.message);
        }
    }

    organizePrompts(promptRecords){
        if(this.promptRecords?.length()) return;
        let Job_Summary = promptRecords.find(item => item[this.namespace+'Prompt_Type__c'] === 'Job Summary');
        let Log_Summary = promptRecords.find(item => item[this.namespace+'Prompt_Type__c'] === 'Shift Log Recording Summary');
        this.prompts.Job_Summary = {Id: Job_Summary?.Id, value : Job_Summary?.[this.namespace+'Prompt_Body__c'] ?? '', type: Job_Summary?.[this.namespace+'Prompt_Type__c'] ?? 'Job Summary'}
        this.prompts.Log_Summary = {Id: Log_Summary?.Id, value : Log_Summary?.[this.namespace+'Prompt_Body__c'] ?? '', type: Log_Summary?.[this.namespace+'Prompt_Type__c'] ?? 'Shift Log Recording Summary'}
        console.log('this.prompts : ', this.prompts);
        this.prompts_backup = JSON.parse(JSON.stringify(this.prompts));
    }

    resetPrompts(){
        try {
            if(this.disableSaveButton.prompt) return;
            // Reset prompts to backup values
            this.prompts = JSON.parse(JSON.stringify(this.prompts_backup));
            this.showToast('Info', 'Prompts have been reset.', 'info');
            console.log('Prompts have been reset.');
        }
        catch (error) {
            console.log('Error in resetPrompts : ', error.message);
        }
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
        `;
        this.template.host?.appendChild(style);
    }
}