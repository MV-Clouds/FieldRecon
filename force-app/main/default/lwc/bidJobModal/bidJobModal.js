import { LightningElement, api, track, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { updateRecord } from 'lightning/uiRecordApi';

// Bid fields to fetch
const BID_FIELDS = [
    'wfrecon__Bid__c.Id',
    'wfrecon__Bid__c.Name',
    'wfrecon__Bid__c.wfrecon__AccountId__c',
    'wfrecon__Bid__c.wfrecon__Amount__c',
    'wfrecon__Bid__c.wfrecon__Description__c'
];

export default class BidJobModal extends LightningElement {
    @api recordId; // Bid Record ID from Quick Action
    @track isLoading = false;

    // Pre-populated values from Bid
    bidId;
    bidName = '';
    accountId;
    defaultJobName = '';
    defaultAmount;
    defaultDescription = '';

    // Tab selection
    @track activeTab = 'createNew';

    // Selected job for linking
    @track selectedJobId;

    @wire(getRecord, { recordId: '$recordId', fields: BID_FIELDS })
    wiredBid({ error, data }) {
        this.isLoading = true;
        if (data) {
            this.bidId = this.recordId;
            this.bidName = getFieldValue(data, 'wfrecon__Bid__c.Name') || this.recordId;
            this.accountId = getFieldValue(data, 'wfrecon__Bid__c.wfrecon__AccountId__c');
            this.defaultJobName = this.bidName;
            this.defaultAmount = getFieldValue(data, 'wfrecon__Bid__c.wfrecon__Amount__c');
            this.defaultDescription = getFieldValue(data, 'wfrecon__Bid__c.wfrecon__Description__c') || '';
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
                    padding: 0;
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
                }
        `;
        this.template.host.appendChild(style);
    }

    get createNewTabClass() {
        return this.activeTab === 'createNew' ? 'tab-button active' : 'tab-button';
    }

    get linkExistingTabClass() {
        return this.activeTab === 'linkExisting' ? 'tab-button active' : 'tab-button';
    }

    get isCreateNew() {
        return this.activeTab === 'createNew';
    }

    get isLinkExisting() {
        return this.activeTab === 'linkExisting';
    }

    get saveButtonLabel() {
        if (this.activeTab === 'createNew') {
            return 'Create Job';
        } else if (this.activeTab === 'linkExisting') {
            return 'Link Job';
        }
        return 'Save';
    }

    get isSaveDisabled() {
        if (this.activeTab === 'linkExisting' && !this.selectedJobId) {
            return true;
        }
        return false;
    }

    handleCreateNewTab() {
        this.activeTab = 'createNew';
        this.selectedJobId = null;
    }

    handleLinkExistingTab() {
        this.activeTab = 'linkExisting';
    }

    handleJobSelection(event) {
        this.selectedJobId = event.detail.recordId;
    }

    handleCancel() {
        // Close the quick action screen
        this.dispatchEvent(new CustomEvent('close'));
    }

    /**
     * Method Name: handleLinkJob
     * @description: Handles linking an existing job to the bid
     */
    async handleLinkJob(event) {
        event.preventDefault();

        if (!this.selectedJobId) {
            this.showToast('Error', 'Please select a job to link', 'error');
            return;
        }

        this.isLoading = true;

        try {
            // Update the Bid with the Job reference
            await this.updateBidWithJob(this.selectedJobId);

            this.isLoading = false;
            this.showToast('Success', 'Job linked successfully', 'success');

            // Close modal without navigation
            this.dispatchEvent(new CustomEvent('close'));
        } catch (error) {
            this.isLoading = false;
            console.error('Error linking job:', error);
            this.showToast('Error', error.body?.message || 'Failed to link job', 'error');
        }
    }

    /**
     * Method Name: handleSave
     * @description: Handles creating a new job
     */
    async handleSave(event) {
        event.preventDefault();

        // Validate form fields
        const inputFields = this.template.querySelectorAll('lightning-input-field');
        let isValid = true;

        inputFields.forEach(field => {
            if (!field.reportValidity()) {
                isValid = false;
            }
        });

        if (!isValid) {
            this.showToast('Error', 'Please fix the errors in the form.', 'error');
            return;
        }

        // Submit the form for creating new job
        this.isLoading = true;
        this.template.querySelector('lightning-record-edit-form').submit();
    }

    async handleSuccess(event) {
        const jobId = event.detail.id;

        try {
            // Update the Bid with the newly created Job reference
            await this.updateBidWithJob(jobId);

            this.isLoading = false;
            this.showToast('Success', 'Job created successfully', 'success');

            // Close modal without navigation
            this.dispatchEvent(new CustomEvent('close'));
        } catch (error) {
            this.isLoading = false;
            console.error('Error updating Bid with Job:', error);
            this.showToast('Warning', 'Job created but failed to update Bid reference', 'warning');
            this.dispatchEvent(new CustomEvent('close'));
        }
    }

    async updateBidWithJob(jobId) {
        const fields = {};
        fields['Id'] = this.bidId;
        fields['wfrecon__Job__c'] = jobId;

        const recordInput = { fields };

        return updateRecord(recordInput);
    }

    handleError(event) {
        this.isLoading = false;
        let errorMessage = 'An error occurred while processing the Job.';

        if (event.detail && event.detail.detail) {
            errorMessage = event.detail.detail;
        } else if (event.detail && event.detail.message) {
            errorMessage = event.detail.message;
        }

        console.error('Job Save Error:', JSON.stringify(event.detail));
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