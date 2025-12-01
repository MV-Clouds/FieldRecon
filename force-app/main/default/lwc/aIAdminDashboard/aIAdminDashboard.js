import { LightningElement, track, wire, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAICustomSetting from '@salesforce/apex/AIAdminDashboardController.getAICustomSetting';
import updateAICustomSetting from '@salesforce/apex/AIAdminDashboardController.updateAICustomSetting';

export default class AIAdminDashboard extends LightningElement {


    @track activeSectionName = ['Gemini_Settings'];
    namespace = this.template?.host?.nodeName?.toLowerCase()?.startsWith('wfrecon-') ? 'wfrecon__' : '';
    customSetting = {};
    customSetting_backup = {};
    @track geminiSettings = [
        { name: 'Gemini_API_Key__c', label: 'Gemini API Key', type: 'text', value: '' },
        { name: 'Gemini_Model__c', label: 'Gemini Model', type: 'text', value: '' },
        { name: 'Gemini_API_Domain__c', label: 'Gemini API Domain', type: 'text', value: '' },
        { name: 'Gemini_API_Relative_Path__c', label: 'Gemini API Relative Path', type: 'text', value: '' },
    ];

    connectedCallback(){
        this.overrideSLDS();
        this.fetchAICustomSetting()
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
        // Reset Gemini settings to backup values
        this.customSetting = JSON.parse(JSON.stringify(this.customSetting_backup));
        this.geminiSettings = this.geminiSettings.map(setting => {
            return { ...setting, value: this.customSetting[this.namespace+setting.name] || '' };
        });
        this.showToast('Info', 'Gemini Settings have been reset.', 'info');
        console.log('Gemini Settings have been reset.');
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