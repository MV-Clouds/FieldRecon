import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getProposalConfig from '@salesforce/apex/ProposalConfigController.getProposalConfig';
import saveProposalConfig from '@salesforce/apex/ProposalConfigController.saveProposalConfig';

export default class ProposalConfiguration extends LightningElement {
    @track ohValue = 0;
    @track warrantyValue = 0;
    @track profitValue = 0;
    @track isLoading = true;
    @track hasChanges = false;
    @track _initialized = false;

    @track warrantyArea = '';
    @track agreement = '';
    @track limitations = '';
     @track footerContent = '';

    // originals
    originalOhValue = 0;
    originalWarrantyValue = 0;
    originalProfitValue = 0;
    originalWarrantyArea = '';
    originalAgreement = '';
    originalLimitations = '';
    originalFooterContent = '';

    get isButtonDisabled() {
        return !this.hasChanges;
    }

    connectedCallback() {
        this.loadConfiguration();
    }

    async loadConfiguration() {
        this.isLoading = true;
        try {
            const data = await getProposalConfig();
            console.log('Result from Apex:', data);
            
            let result = {};
            if (data && data.configJson) {
                try {
                    result = JSON.parse(data.configJson);
                } catch (e) {
                    console.error('JSON Parse Error:', data.configJson);
                    // It might be corrupted JSON due to truncation
                    this.showToast('Error', 'Something went wrong while loading configuration', 'error');
                }
            }
            
            this.ohValue = result.ohValue || 0;
            this.warrantyValue = result.warrantyValue || 0;
            this.profitValue = result.profitValue || 0;
            this.warrantyArea = result.warrantyArea || '';
            this.agreement = result.agreement || '';
            this.limitations = result.limitations || '';
            this.footerContent = result.footerContent || '';

            // Store originals
            this.originalOhValue = this.ohValue;
            this.originalWarrantyValue = this.warrantyValue;
            this.originalProfitValue = this.profitValue;
            this.originalWarrantyArea = this.warrantyArea;
            this.originalAgreement = this.agreement;
            this.originalLimitations = this.limitations;
            this.originalFooterContent = this.footerContent;

            this.hasChanges = false;
            this._initialized = true;
            
        } catch (error) {
            console.error('Error loading configuration:', error);
            this.showToast('Error', 'Failed to load configuration.', 'error');
            this.setDefaultValues();
        } finally {
            this.isLoading = false;
        }
    }

    setDefaultValues() {
        this.ohValue = 0;
        this.warrantyValue = 0;
        this.profitValue = 0;
        this.warrantyArea = '';
        this.agreement = '';
        this.limitations = '';
        this.footerContent = '';
        
        // Store originals
        this.originalOhValue = this.ohValue;
        this.originalWarrantyValue = this.warrantyValue;
        this.originalProfitValue = this.profitValue;
        this.originalWarrantyArea = this.warrantyArea;
        this.originalAgreement = this.agreement;
        this.originalLimitations = this.limitations;
        this.originalFooterContent = this.footerContent;
        
        this.hasChanges = false;
        this._initialized = false;
    }

    handleOHChange(event) {
        this.ohValue = parseFloat(event.target.value) || 0;
        this.checkForChanges();
    }

    handleWarrantyChange(event) {
        this.warrantyValue = parseFloat(event.target.value) || 0;
        this.checkForChanges();
    }

    handleProfitChange(event) {
        this.profitValue = parseFloat(event.target.value) || 0;
        this.checkForChanges();
    }

    handleWarrantyArea(event) {
        this.warrantyArea = event.target.value;
        this.checkForChanges();
    }

    handleAgreement(event) {
        this.agreement = event.target.value;
        this.checkForChanges();
    }

    handleLimitations(event) {
        this.limitations = event.target.value;
        this.checkForChanges();
    }

     handleFooterContent(event) {
        this.footerContent = event.target.value;
        this.checkForChanges();
    }
    
    checkForChanges() {
        this.hasChanges =
            this.ohValue !== this.originalOhValue ||
            this.warrantyValue !== this.originalWarrantyValue ||
            this.profitValue !== this.originalProfitValue ||
            this.warrantyArea !== this.originalWarrantyArea ||
            this.agreement !== this.originalAgreement ||
            this.limitations !== this.originalLimitations ||
            this.footerContent !== this.originalFooterContent;
    }

    handleCancel() {
        this.ohValue = this.originalOhValue;
        this.warrantyValue = this.originalWarrantyValue;
        this.profitValue = this.originalProfitValue;
        this.warrantyArea = this.originalWarrantyArea;
        this.agreement = this.originalAgreement;
        this.limitations = this.originalLimitations;
        this.footerContent = this.originalFooterContent;
        this.hasChanges = false;
    }

    async handleSave() {
        if (
            this.ohValue < 0 || this.ohValue > 100 ||
            this.warrantyValue < 0 || this.warrantyValue > 100 ||
            this.profitValue < 0 || this.profitValue > 100
        ) {
            this.showToast('Invalid Input', 'Values must be between 0–100%', 'error');
            return;
        }

        if(this.ohValue + this.warrantyValue + this.profitValue >= 100) {
            this.showToast('Invalid Input', 'Sum of OH, Warranty and Profit should be less than 100%', 'error');
            return;
        }
        this.isLoading = true;

        try {
            const configJson = JSON.stringify({
                ohValue: this.ohValue,
                warrantyValue: this.warrantyValue,
                profitValue: this.profitValue,
                warrantyArea: this.warrantyArea,
                agreement: this.agreement,
                limitations: this.limitations,
                footerContent: this.footerContent,
            });

            // Log size for debugging
            console.log('Saving JSON length:', configJson.length, 'JSON:', configJson);

            await saveProposalConfig({ configJson });

            // Update originals
            this.originalOhValue = this.ohValue;
            this.originalWarrantyValue = this.warrantyValue;
            this.originalProfitValue = this.profitValue;
            this.originalWarrantyArea = this.warrantyArea;
            this.originalAgreement = this.agreement;
            this.originalLimitations = this.limitations;
            this.originalFooterContent = this.footerContent;


            this.hasChanges = false;
            this.showToast('Success', 'Configuration saved successfully', 'success');

        } catch (error) {
            console.error('Save error:', error);
            this.showToast(
                'Error',
                'Failed to save configuration: ' +
                (error.body?.message || error.message),
                'error'
            );
        } finally {
            this.isLoading = false;
        }
    }


    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant,
                mode: 'dismissable'
            })
        );
    }
}