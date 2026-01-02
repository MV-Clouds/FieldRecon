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
            })
            .catch(error => {
                this.showToast('Error', error.body.message, 'error');
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