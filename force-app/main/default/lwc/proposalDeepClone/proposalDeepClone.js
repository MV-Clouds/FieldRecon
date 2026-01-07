import { LightningElement, api, track } from 'lwc';
import cloneProposal from '@salesforce/apex/ProposalDeepCloneController.cloneProposal';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CloseActionScreenEvent } from 'lightning/actions';
import { NavigationMixin } from 'lightning/navigation';

export default class ProposalDeepClone extends NavigationMixin(LightningElement) {
    @api recordId;
    @track isLoading = false;

    connectedCallback(){
        this.overrideSLDS();
    }

    handleClone() {
        this.isLoading = true;
        cloneProposal({ proposalId: this.recordId })
            .then(newRecordId => {
                // Check if Apex returned a valid ID or null (due to error suppression)
                if (newRecordId) {
                    this.showToast('Success', 'Proposal cloned successfully', 'success');
                    
                    // Navigate to the new record
                    this[NavigationMixin.Navigate]({
                        type: 'standard__recordPage',
                        attributes: {
                            recordId: newRecordId,
                            objectApiName: 'wfrecon__Proposal__c',
                            actionName: 'view'
                        }
                    });
                } else {
                    // Apex returned null -> Logic error occurred and was logged
                    this.showToast('Error', 'Cloning failed. Please check the logs or contact your administrator.', 'error');
                    this.isLoading = false;
                    this.handleCancel(); // Optional: Close modal on error
                }
            })
            .catch(error => {
                // This catches network errors or unexpected system exceptions
                this.showToast('Error', 'Error in the clone process contact administrator: ' + error.body?.message||error.stack, 'error');
                this.isLoading = false;
            });
    }

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
                .slds-modal__container{
                    width: 90%;
                    max-width: 1400px;
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
                    border-radius: 16px 16px 0px 0px;
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
                    background-color: white;
                    padding: 0rem;
                    border-radius: 0rem 0rem 1rem 1rem;
                }
                .slds-rich-text-editor{
                    overflow: hidden;
                }
        `;
        this.template.host.appendChild(style);
    }

    handleCancel() {
        this.dispatchEvent(new CloseActionScreenEvent());
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        }));
    }
}