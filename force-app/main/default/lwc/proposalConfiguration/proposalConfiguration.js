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

    // originals
    originalOhValue = 0;
    originalWarrantyValue = 0;
    originalProfitValue = 0;
    originalWarrantyArea = '';
    originalAgreement = '';
    originalLimitations = '';

    get isButtonDisabled() {
        return !this.hasChanges;
    }

    connectedCallback() {
        this.loadConfiguration();
    }

    renderedCallback() {
        if (!this._initialized && !this.isLoading) {
            this._initialized = true;
            this.updateTextareaValues();
        }
    }

    updateTextareaValues() {
        const textareas = this.template.querySelectorAll('textarea');
        textareas.forEach(textarea => {
            const field = textarea.dataset.field;
            if (field) {
                if (field === 'warrantyArea') {
                    textarea.value = this.warrantyArea || '';
                } else if (field === 'agreement') {
                    textarea.value = this.agreement || '';
                } else if (field === 'limitations') {
                    textarea.value = this.limitations || '';
                }
            }
        });
    }

    async loadConfiguration() {
        this.isLoading = true;
        try {
            const result = await getProposalConfig();
            console.log('Result from Apex:', result);
            
            // Result is already a JavaScript object (Map from Apex)
            this.ohValue = result.ohValue || 0;
            this.warrantyValue = result.warrantyValue || 0;
            this.profitValue = result.profitValue || 0;
            this.warrantyArea = result.warrantyArea || '';
            this.agreement = result.agreement || '';
            this.limitations = result.limitations || '';

            // Store originals
            this.originalOhValue = this.ohValue;
            this.originalWarrantyValue = this.warrantyValue;
            this.originalProfitValue = this.profitValue;
            this.originalWarrantyArea = this.warrantyArea;
            this.originalAgreement = this.agreement;
            this.originalLimitations = this.limitations;

            this.hasChanges = false;
            this._initialized = false;
            
        } catch (error) {
            console.error('Error loading configuration:', error);
            this.showToast('Error', 'Failed to load configuration. Using default values.', 'error');
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
        
        // Store originals
        this.originalOhValue = this.ohValue;
        this.originalWarrantyValue = this.warrantyValue;
        this.originalProfitValue = this.profitValue;
        this.originalWarrantyArea = this.warrantyArea;
        this.originalAgreement = this.agreement;
        this.originalLimitations = this.limitations;
        
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

    checkForChanges() {
        this.hasChanges =
            this.ohValue !== this.originalOhValue ||
            this.warrantyValue !== this.originalWarrantyValue ||
            this.profitValue !== this.originalProfitValue ||
            this.warrantyArea !== this.originalWarrantyArea ||
            this.agreement !== this.originalAgreement ||
            this.limitations !== this.originalLimitations;
    }

    handleCancel() {
        this.ohValue = this.originalOhValue;
        this.warrantyValue = this.originalWarrantyValue;
        this.profitValue = this.originalProfitValue;
        this.warrantyArea = this.originalWarrantyArea;
        this.agreement = this.originalAgreement;
        this.limitations = this.originalLimitations;
        this.hasChanges = false;
        
        this.updateTextareaValues();
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

        const maxAllowed = 100 - this.ohValue - this.warrantyValue - 1;
        if (this.profitValue > maxAllowed) {
            this.showToast('Invalid Profit', `Profit cannot exceed ${maxAllowed}%`, 'error');
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
                limitations: this.limitations
            });

            await saveProposalConfig({ configJson });

            // Update originals
            this.originalOhValue = this.ohValue;
            this.originalWarrantyValue = this.warrantyValue;
            this.originalProfitValue = this.profitValue;
            this.originalWarrantyArea = this.warrantyArea;
            this.originalAgreement = this.agreement;
            this.originalLimitations = this.limitations;

            this.hasChanges = false;
            this.showToast('Success', 'Configuration saved successfully', 'success');

            this.loadConfiguration();

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