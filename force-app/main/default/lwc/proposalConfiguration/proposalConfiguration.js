import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getProposalConfig from '@salesforce/apex/ProposalConfigController.getProposalConfig';
import saveProposalConfig from '@salesforce/apex/ProposalConfigController.saveProposalConfig';

export default class ProposalConfiguration extends LightningElement {
    @track ohValue = 0;
    @track warrantyValue = 0;
    @track profitValue = 0;
    @track isLoading = true;
    
    // Store original values for cancel functionality
    originalOhValue = 0;
    originalWarrantyValue = 0;
    originalProfitValue = 0;

    connectedCallback() {
        this.loadConfiguration();
    }

    loadConfiguration() {
        getProposalConfig()
            .then(result => {
                this.ohValue = result?.wfrecon__OH__c || 0;
                this.warrantyValue = result?.wfrecon__Warranty__c || 0;
                this.profitValue = result?.wfrecon__Profit__c || 0;
                
                // Store original values for cancel
                this.originalOhValue = this.ohValue;
                this.originalWarrantyValue = this.warrantyValue;
                this.originalProfitValue = this.profitValue;
            })
            .catch(error => {
                this.showToast('Error', 'Failed to load configuration', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleOHChange(event) {
        this.ohValue = parseFloat(event.target.value) || 0;
    }

    handleWarrantyChange(event) {
        this.warrantyValue = parseFloat(event.target.value) || 0;
    }

    handleProfitChange(event) {
        this.profitValue = parseFloat(event.target.value) || 0;
    }

    handleCancel() {
        this.ohValue = this.originalOhValue;
        this.warrantyValue = this.originalWarrantyValue;
        this.profitValue = this.originalProfitValue;
        
    }

    handleSave() {
        // Validate
        if (this.ohValue < 0 || this.ohValue > 100 ||
            this.warrantyValue < 0 || this.warrantyValue > 100 ||
            this.profitValue < 0 || this.profitValue > 100) {
            this.showToast('Invalid Input', 'Values must be between 0-100%', 'error');
            return;
        }

        this.isLoading = true;
        
        saveProposalConfig({
            ohValue: this.ohValue,
            warrantyValue: this.warrantyValue,
            profitValue: this.profitValue
        })
        .then(() => {
            // Update original values after successful save
            this.originalOhValue = this.ohValue;
            this.originalWarrantyValue = this.warrantyValue;
            this.originalProfitValue = this.profitValue;
            
            this.showToast('Success', 'Configuration saved successfully', 'success');
            this.isLoading = false;
        })
        .catch(error => {
            this.showToast('Error', 'Failed to save configuration', 'error');
            this.isLoading = false;
        });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title,
            message,
            variant,
            mode: 'dismissable'
        }));
    }
}