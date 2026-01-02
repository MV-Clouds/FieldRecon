import { LightningElement, api, track } from 'lwc';
import cloneProposal from '@salesforce/apex/ProposalDeepCloneController.cloneProposal';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CloseActionScreenEvent } from 'lightning/actions';
import { NavigationMixin } from 'lightning/navigation';

export default class ProposalDeepClone extends NavigationMixin(LightningElement) {
    @api recordId;
    @track isLoading = false;

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