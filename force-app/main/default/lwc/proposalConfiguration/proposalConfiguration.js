// import { LightningElement, track } from 'lwc';
// import { ShowToastEvent } from 'lightning/platformShowToastEvent';
// import getProposalConfig from '@salesforce/apex/ProposalConfigController.getProposalConfig';
// import saveProposalConfig from '@salesforce/apex/ProposalConfigController.saveProposalConfig';

// export default class ProposalConfiguration extends LightningElement {
//     @track ohValue = 0;
//     @track warrantyValue = 0;
//     @track profitValue = 0;
//     @track isLoading = true;
//     @track hasChanges = false;

//     @track warrantyArea = '';
//     @track agreement = '';
//     @track limitations = '';

//     // Store original values for cancel functionality
//     originalOhValue = 0;
//     originalWarrantyValue = 0;
//     originalProfitValue = 0;
//     originalWarrantyArea = '';
//     originalAgreement = '';
//     originalLimitations = '';

//     get isButtonDisabled() {
//         return !this.hasChanges;
//     }

//     connectedCallback() {
//         this.loadConfiguration();
//     }

//     loadConfiguration() {
//         getProposalConfig()
//             .then(result => {
//                 this.ohValue = result?.wfrecon__OH__c || 0;
//                 this.warrantyValue = result?.wfrecon__Warranty__c || 0;
//                 this.profitValue = result?.wfrecon__Profit__c || 0;
//                 this.warrantyArea = result?.wfrecon__Proposal_Warranty__c || '';
//                 this.agreement = result?.wfrecon__Aggrement__c || '';
//                 this.limitations = result?.wfrecon__Limitations__c || '';

//                 // Store original values for cancel
//                 this.originalOhValue = this.ohValue;
//                 this.originalWarrantyValue = this.warrantyValue;
//                 this.originalProfitValue = this.profitValue;
//                 this.originalWarrantyArea = this.warrantyArea;
//                 this.originalAgreement = this.agreement;
//                 this.originalLimitations = this.limitations;

//                 // Reset changes flag
//                 this.hasChanges = false;
//             })
//             .catch(error => {
//                 this.showToast('Error', 'Failed to load configuration', 'error');
//             })
//             .finally(() => {
//                 this.isLoading = false;
//             });
//     }

//     handleOHChange(event) {
//         const newValue = parseFloat(event.target.value) || 0;
//         this.ohValue = newValue;
//         this.checkForChanges();
//     }

//     handleWarrantyChange(event) {
//         const newValue = parseFloat(event.target.value) || 0;
//         this.warrantyValue = newValue;
//         this.checkForChanges();
//     }

//     handleProfitChange(event) {
//         const newValue = parseFloat(event.target.value) || 0;
//         this.profitValue = newValue;
//         this.checkForChanges();
//     }

//     handleWarrantyArea(event) {
//         this.warrantyArea = event.target.value;
//         this.checkForChanges();
//     }

//     handleAgreement(event) {
//         this.agreement = event.target.value;
//         this.checkForChanges();
//     }

//     handleLimitations(event) {
//         this.limitations = event.target.value;
//         this.checkForChanges();
//     }

//     checkForChanges() {
//         // Check if any value differs from original
//         this.hasChanges =
//             this.ohValue !== this.originalOhValue ||
//             this.warrantyValue !== this.originalWarrantyValue ||
//             this.profitValue !== this.originalProfitValue || 
//             this.warrantyArea !== this.originalWarrantyArea ||
//             this.agreement !== this.originalAgreement ||
//             this.limitations !== this.originalLimitations;
//     }

//     handleCancel() {
//         this.ohValue = this.originalOhValue;
//         this.warrantyValue = this.originalWarrantyValue;
//         this.profitValue = this.originalProfitValue;
//         this.warrantyArea = this.originalWarrantyArea;
//         this.agreement = this.originalAgreement;
//         this.limitations = this.originalLimitations;
//         this.hasChanges = false;
//     }

//     handleSave() {
//         // Validate
//         if (this.ohValue < 0 || this.ohValue > 100 ||
//             this.warrantyValue < 0 || this.warrantyValue > 100 ||
//             this.profitValue < 0 || this.profitValue > 100) {
//             this.showToast('Invalid Input', 'Values must be between 0-100%', 'error');
//             return;
//         }

//         const maxAllowed = 100 - this.ohValue - this.warrantyValue;
//         if (this.profitValue > maxAllowed) {
//             this.showToast('Invalid Profit', `Profit cannot exceed ${maxAllowed}%`, 'error');
//             return;
//         }

//         this.isLoading = true;

//         saveProposalConfig({
//             ohValue: this.ohValue,
//             warrantyValue: this.warrantyValue,
//             profitValue: this.profitValue,
//             warrantyArea: this.warrantyArea,
//             agreement: this.agreement,
//             limitations: this.limitations
//         })
//             .then(() => {
//                 // Update original values after successful save
//                 this.originalOhValue = this.ohValue;
//                 this.originalWarrantyValue = this.warrantyValue;
//                 this.originalProfitValue = this.profitValue;
//                 this.originalWarrantyArea = this.warrantyArea;
//                 this.originalAgreement = this.agreement;
//                 this.originalLimitations = this.limitations;

//                 // Reset changes flag
//                 this.hasChanges = false;

//                 this.showToast('Success', 'Configuration saved successfully', 'success');
//                 this.isLoading = false;
//             })
//             .catch(error => {
//                 this.showToast('Error', 'Failed to save configuration', 'error');
//                 this.isLoading = false;
//             });
//     }

//     showToast(title, message, variant) {
//         this.dispatchEvent(new ShowToastEvent({
//             title,
//             message,
//             variant,
//             mode: 'dismissable'
//         }));
//     }
// }

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
        // Manually set textarea values after render
        // This is needed because textarea value binding doesn't work reactively in LWC
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
                // Set textarea value based on data-field attribute
                if (field === 'warrantyArea') {
                    textarea.value = this.warrantyArea;
                } else if (field === 'agreement') {
                    textarea.value = this.agreement;
                } else if (field === 'limitations') {
                    textarea.value = this.limitations;
                }
            }
        });
    }

    loadConfiguration() {
        getProposalConfig()
            .then(result => {
                if (result) {
                    const config = JSON.parse(result);

                    this.ohValue = config.ohValue || 0;
                    this.warrantyValue = config.warrantyValue || 0;
                    this.profitValue = config.profitValue || 0;
                    this.warrantyArea = config.warrantyArea || '';
                    this.agreement = config.agreement || '';
                    this.limitations = config.limitations || '';
                }

                // store originals
                this.originalOhValue = this.ohValue;
                this.originalWarrantyValue = this.warrantyValue;
                this.originalProfitValue = this.profitValue;
                this.originalWarrantyArea = this.warrantyArea;
                this.originalAgreement = this.agreement;
                this.originalLimitations = this.limitations;

                this.hasChanges = false;
                this._initialized = false; // Reset to allow renderedCallback to update textareas
            })
            .catch(() => {
                this.showToast('Error', 'Failed to load configuration', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
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
        
        // Update textarea DOM elements
        this.updateTextareaValues();
    }

    handleSave() {
        // basic validation
        if (
            this.ohValue < 0 || this.ohValue > 100 ||
            this.warrantyValue < 0 || this.warrantyValue > 100 ||
            this.profitValue < 0 || this.profitValue > 100
        ) {
            this.showToast('Invalid Input', 'Values must be between 0–100%', 'error');
            return;
        }

        const maxAllowed = 100 - this.ohValue - this.warrantyValue;
        if (this.profitValue > maxAllowed) {
            this.showToast('Invalid Profit', `Profit cannot exceed ${maxAllowed}%`, 'error');
            return;
        }

        this.isLoading = true;

        saveProposalConfig({
            ohValue: this.ohValue,
            warrantyValue: this.warrantyValue,
            profitValue: this.profitValue,
            warrantyArea: this.warrantyArea,
            agreement: this.agreement,
            limitations: this.limitations
        })
            .then(() => {
                // update originals
                this.originalOhValue = this.ohValue;
                this.originalWarrantyValue = this.warrantyValue;
                this.originalProfitValue = this.profitValue;
                this.originalWarrantyArea = this.warrantyArea;
                this.originalAgreement = this.agreement;
                this.originalLimitations = this.limitations;

                this.hasChanges = false;
                this.showToast('Success', 'Configuration saved successfully', 'success');
            })
            .catch(() => {
                this.showToast('Error', 'Failed to save configuration', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
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
