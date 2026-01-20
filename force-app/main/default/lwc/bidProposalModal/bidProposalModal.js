import { LightningElement, api, track, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getContactInfo from '@salesforce/apex/BidProposalController.getContactInfo';
import getProposalConfig from '@salesforce/apex/ProposalConfigController.getProposalConfig';

// Bid fields to fetch
const BID_FIELDS = [
    'wfrecon__Bid__c.Id',
    'wfrecon__Bid__c.wfrecon__AccountId__c',
    'wfrecon__Bid__c.wfrecon__Contact__c',
    'wfrecon__Bid__c.wfrecon__Bid_Due_Date__c',
    'wfrecon__Bid__c.wfrecon__Status__c'
];

export default class BidProposalModal extends LightningElement {
    @api recordId; // Bid Record ID from Quick Action
    @track isLoading = true;
    @track isBidValid = true;

    // Pre-populated values from Bid
    bidId;
    accountId;
    @track contactId;
    @track contactEmail = '';
    @track contactPhone = '';

    // Percentage field values
    @track ohValue = 0;
    @track warrantyValue = 0;
    @track profitValue = 0;
    @track ohDisplay = '0%';
    @track warrantyDisplay = '0%';
    @track profitDisplay = '0%';

    // Expiration Date
    @track expirationDate = null;

    // Track if we need to fetch contact
    currentContactId = null;

    // Wire to get custom setting values
    @wire(getProposalConfig)
    wiredProposalConfig({ error, data }) {
        if (data) {
            // Set default values from custom setting
            this.ohValue = data.wfrecon__OH__c || 0;
            this.warrantyValue = data.wfrecon__Warranty__c || 0;
            this.profitValue = data.wfrecon__Profit__c || 0;

            // Update display values
            this.ohDisplay = `${this.ohValue}%`;
            this.warrantyDisplay = `${this.warrantyValue}%`;
            this.profitDisplay = `${this.profitValue}%`;
        } else if (error) {
            console.error('Error loading Proposal Configuration:', error);
            // Keep default values (0) if error occurs
        }
    }

    @wire(getRecord, { recordId: '$recordId', fields: BID_FIELDS })
    wiredBid({ error, data }) {
        if (data) {
            this.isLoading = true;
            this.bidId = this.recordId;
            this.accountId = getFieldValue(data, 'wfrecon__Bid__c.wfrecon__AccountId__c');
            this.contactId = getFieldValue(data, 'wfrecon__Bid__c.wfrecon__Contact__c');
            this.currentContactId = this.contactId;

            // Get bid status and check eligibility in one step
            const bidStatus = getFieldValue(data, 'wfrecon__Bid__c.wfrecon__Status__c');
            this.isBidValid = bidStatus && bidStatus.toLowerCase() === 'bidding';


            // Autopopulate expiration date with bid due date
            const bidDueDate = getFieldValue(data, 'wfrecon__Bid__c.wfrecon__Bid_Due_Date__c');
            if (bidDueDate) {
                this.expirationDate = bidDueDate;
            }

            // Fetch contact details if contact is available
            if (this.contactId) {
                this.fetchContactDetails(this.contactId);
            }

            setTimeout(() => {
                this.isLoading = false;
            }, 1000);
        } else if (error) {
            console.error('Error loading Bid:', error);
            this.showToast('Error', 'Failed to load Bid information', 'error');
            this.isLoading = false;
        }
    }

    connectedCallback() {
        this.isLoading = true;
        this.overrideSLDS();
    }

    /** 
   * Method Name: overrideSLDS
   * @description: Overrides default SLDS styles for modal customization
   */
    overrideSLDS() {
        let style = document.createElement('style');
        style.innerText = `
                .uiModal--medium .modal-container {
                    width: 50%;
                    min-width: min(480px, calc(100% - 2rem));
                    margin-inline: auto;
                }

                .no-apply .modal-container{
                    width: 50%;
                }

                .slds-card .slds-card__header{
                display: none;
                }
                .slds-card .slds-card__body{
                margin-block-start: 0;
                margin-block-end: 0;
                }

                .slds-modal__container{
                    width: 50%;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .slds-p-around--medium {
                    padding: unset !important;
                }

                .slds-modal__header:not(.empty):not(.slds-modal__header_empty){
                    background-color: #5e5adb;
                    color: white;
                    padding: 1.25rem 1.5rem;
                    text-align: center;
                    flex-shrink: 0;
                    border-radius: 16px 16px 0 0;
                    position: sticky;
                    top: 0;
                    z-index: 100;
                }

                .slds-modal__title {
                    font-size: 1.25rem !important;
                    font-weight: 600 !important;
                    margin: 0 !important;
                }

                .slds-modal__footer {
                    display: none !important;
                }

                .cuf-content {
                    padding: unset !important;
                }

                .slds-modal__content{
                    height: unset !important;
                    // overflow: hidden !important;
                }
        `;
        this.template.host.appendChild(style);
    }

    get saveButtonLabel() {
        return 'Save';
    }

    fetchContactDetails(contactId) {
        if (!contactId) {
            this.contactEmail = '';
            this.contactPhone = '';
            return;
        }

        // Use Apex to fetch contact details
        getContactInfo({ contactId: contactId })
            .then(data => {
                this.contactEmail = data.Email || '';
                this.contactPhone = data.Phone || '';
            })
            .catch(error => {
                console.error('Error fetching contact details:', error);
                this.contactEmail = '';
                this.contactPhone = '';
            });
    }

    handleContactChange(event) {
        // Extract the value properly from the lightning-input-field
        const newContactId = event.detail.value ? event.detail.value[0] : null;
        console.log(event.detail.value, 'newContactId');

        // Only update if contact actually changed
        if (newContactId !== this.currentContactId) {
            this.contactId = newContactId;
            this.currentContactId = newContactId;

            if (newContactId) {
                this.fetchContactDetails(newContactId);
            } else {
                this.contactEmail = '';
                this.contactPhone = '';
            }
        }
    }

    handlePercentageInput(event) {
        const fieldName = event.target.name;
        let value = event.target.value;

        // Remove any non-numeric characters except decimal point
        value = value.replace(/[^\d.]/g, '');

        // Update the display value (without % during typing)
        if (fieldName === 'wfrecon__OH__c') {
            this.ohDisplay = value;
            this.ohValue = parseFloat(value) || 0;
        } else if (fieldName === 'wfrecon__Warranty__c') {
            this.warrantyDisplay = value;
            this.warrantyValue = parseFloat(value) || 0;
        } else if (fieldName === 'wfrecon__Profit__c') {
            this.profitDisplay = value;
            this.profitValue = parseFloat(value) || 0;
        }
    }

    handlePercentageBlur(event) {
        const fieldName = event.target.name;
        let value = event.target.value;

        // Remove any non-numeric characters
        value = value.replace(/[^\d.]/g, '');
        const numValue = parseFloat(value) || 0;

        // Update the values
        if (fieldName === 'wfrecon__OH__c') {
            this.ohValue = numValue;
            this.ohDisplay = numValue + '%';
        } else if (fieldName === 'wfrecon__Warranty__c') {
            this.warrantyValue = numValue;
            this.warrantyDisplay = numValue + '%';
        } else if (fieldName === 'wfrecon__Profit__c') {
            this.profitValue = numValue;
            this.profitDisplay = numValue + '%';
        }

    }

    handleCancel() {
        // Close the quick action screen
        this.dispatchEvent(new CustomEvent('close'));
    }

    async handleSave(event) {
        event.preventDefault();
        event.stopPropagation();

           // First validate profit - this is the key fix
    const maxAllowed = 100 - this.ohValue - this.warrantyValue;
    if (this.profitValue > maxAllowed) {
        this.showToast('Invalid Profit', `Profit cannot exceed ${maxAllowed}%`, 'error');
        return; // Make sure to return early
    }

        const inputFields = this.template.querySelectorAll('lightning-input-field');
        const customInputs = this.template.querySelectorAll('lightning-input');
        let isValid = true;

        // Validate all lightning-input-field
        inputFields.forEach(field => {
            if (!field.reportValidity()) {
                isValid = false;
            }
        });

        // Validate custom inputs if needed
        customInputs.forEach(input => {
            if (input.required && !input.checkValidity()) {
                input.reportValidity();
                isValid = false;
            }
        });

        if (!isValid) {
            this.showToast('Error', 'Please fix the errors in the form.', 'error');
            return;
        }

        // Update hidden percentage fields with actual values
        const hiddenFields = this.template.querySelectorAll('.hidden-percentage-field');
        hiddenFields.forEach(field => {
            if (field.fieldName === 'wfrecon__OH__c') {
                field.value = this.ohValue;
            } else if (field.fieldName === 'wfrecon__Warranty__c') {
                field.value = this.warrantyValue;
            } else if (field.fieldName === 'wfrecon__Profit__c') {
                field.value = this.profitValue;
            }
        });

        // Update expiration date field
        const expirationField = this.template.querySelector('lightning-input-field[field-name="wfrecon__Expiration_Date__c"]');
        if (expirationField) {
            expirationField.value = this.expirationDate;
        }

        // Submit the form
        this.isLoading = true;
        this.template.querySelector('lightning-record-edit-form').submit();
    }

    handleSuccess(event) {
        this.isLoading = false;
        const proposalId = event.detail.id;
        this.showToast('Success', 'Proposal created successfully', 'success');

        // Close the quick action screen and pass the created Proposal Id to parent (Aura wrapper will navigate)
        this.dispatchEvent(new CustomEvent('close', { detail: { id: proposalId } }));
    }

    handleError(event) {
        this.isLoading = false;
        let errorMessage = 'An error occurred while saving the Proposal.';

        if (event.detail && event.detail.detail) {
            errorMessage = event.detail.detail;
        } else if (event.detail && event.detail.message) {
            errorMessage = event.detail.message;
        }

        console.error('Proposal Save Error:', JSON.stringify(event.detail));
        this.showToast('Error', errorMessage, 'error');
    }

    handleLoad(event) {
        this.isLoading = false;
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title,
            message,
            variant
        });
        this.dispatchEvent(event);
    }
}