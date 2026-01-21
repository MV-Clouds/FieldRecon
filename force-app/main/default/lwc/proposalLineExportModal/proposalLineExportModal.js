import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getProposalDetails from '@salesforce/apex/ProposalLineExportController.getProposalDetails';
import createJobSovLines from '@salesforce/apex/ProposalLineExportController.createJobSovLines';

export default class ProposalLineExportModal extends LightningElement {
    @api recordId;
    @track isLoading = true;
    @track isErrorState = false;
    @track errorMessage = '';
    
    @track proposalLines = [];
    @track jobId;
    @track proposalName;

    // Computed property for Select All checkbox state
    get allLinesSelected() {
        return this.proposalLines.length > 0 && this.proposalLines.every(line => line.selected);
    }

    get disableExport() {
        return !this.proposalLines.some(line => line.selected);
    }

    connectedCallback() {
        this.overrideSLDS();
        this.fetchData();
    }

    fetchData() {
        this.isLoading = true;
        getProposalDetails({ proposalId: this.recordId })
            .then(result => {
                if (result.success) {
                    const prop = result.proposal;

                    console.log('Fetched Proposal:', JSON.stringify(prop), prop);
                    
                    // 1. Check Visibility Criteria
                    const isChangeOrder = prop.wfrecon__Type__c === 'Change Order';
                    const isClosedWon = prop.wfrecon__Status__c === 'Closed Won';
                    
                    if (!isChangeOrder || !isClosedWon) {
                        this.isErrorState = true;
                        this.errorMessage = 'This action is only available for Proposals with Type "Change Order" and Status "Closed Won".';
                    } 
                    // 2. Check Job Relationship
                    else if (!result.jobId) {
                        this.isErrorState = true;
                        this.errorMessage = 'No related Job found in the Proposal Job lookup.';
                    } 
                    // 3. Load Data
                    else {
                        this.jobId = result.jobId;
                        this.proposalName = prop.Name;
                        this.proposalLines = (result.lines || []).map(line => ({
                            ...line,
                            // Ensure 0 is displayed instead of blank if null
                            wfrecon__Sales_Price__c: (line.wfrecon__Sales_Price__c === undefined || line.wfrecon__Sales_Price__c === null) ? 0 : line.wfrecon__Sales_Price__c,
                            selected: false
                        }));
                    }
                } else {
                    this.isErrorState = true;
                    this.errorMessage = result.message || 'Error loading proposal details.';
                }
            })
            .catch(error => {
                this.isErrorState = true;
                this.errorMessage = error.body ? error.body.message : error.message;
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleSelectAll(event) {
        const isChecked = event.target.checked;
        this.proposalLines = this.proposalLines.map(line => ({
            ...line,
            selected: isChecked
        }));
    }

    handleRowSelection(event) {
        const id = event.target.dataset.id;
        const isChecked = event.target.checked;
        
        const index = this.proposalLines.findIndex(l => l.Id === id);
        if (index !== -1) {
            this.proposalLines[index] = { ...this.proposalLines[index], selected: isChecked };
            this.proposalLines = [...this.proposalLines]; // Trigger reactivity
        }
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleExport() {
        try{
            const selectedLines = this.proposalLines.filter(line => line.selected);
            
            if (selectedLines.length === 0) {
                this.showToast('Warning', 'Please select at least one line to export.', 'warning');
                return;
            }
    
            this.isLoading = true;
    
            // Map data to the format expected by Apex (matching your reference logic)
            const payload = selectedLines.map(line => ({
                name: line.Name,
                description: line.wfrecon__Description__c || '',
                contractValue: line.wfrecon__Sales_Price__c || 0,
                jobId: this.jobId,
                type: 'Change Order' // Explicitly set as per requirement
            }));
    
            createJobSovLines({ scopeEntriesDataJson: JSON.stringify(payload) })
                .then(result => {
                    if (result.success) {
                        this.showToast('Success', `Successfully exported ${result.count} SOV Lines to the Job.`, 'success');
                        // Close the modal on success
                        setTimeout(() => {
                            this.dispatchEvent(new CustomEvent('close'));
                        }, 1000);
                    } else {
                        this.showToast('Error', result.message, 'error');
                        this.isLoading = false;
                    }
                })
                .catch(error => {
                    console.error(error);
                    this.showToast('Error', 'Failed to export lines: ' + (error.body?.message || error.message), 'error');
                    this.isLoading = false;
                });
        }catch(err){
            console.error(err);
            this.showToast('Error', 'Failed to export lines: ' + (err.body?.message || err.stack), 'error');
            this.isLoading = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        }));
    }

    /** * Method Name: overrideSLDS
     * @description: Overrides default SLDS styles for modal customization (Copied from reference)
     */
    overrideSLDS() {
        let style = document.createElement('style');
        style.innerText = `
            .uiModal--medium .modal-container {
                width: 50%;
                min-width: min(480px, calc(100% - 2rem));
                margin-inline: auto;
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

            .status-message-container {
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .status-icon-container {
                display: block;
            }

            .status-text-container {
                text-align: center;
                max-width: 400px;
            }

            .status-message-container .slds-align_absolute-center {
                flex-direction: column;
            }
        `;
        this.template.host.appendChild(style);
    }
}