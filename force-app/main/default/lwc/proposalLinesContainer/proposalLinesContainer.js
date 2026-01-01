import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getProposalLines from '@salesforce/apex/ProposalLinesContainerController.getProposalLines';

export default class ProposalLinesContainer extends LightningElement {
    @api recordId;
    @track isLoading = false;
    @track proposalLinesRaw = [];

    connectedCallback() {
        this.loadProposalLines();
    }

    // Load proposal lines data
    loadProposalLines() {
        this.isLoading = true;
        getProposalLines({ proposalId: this.recordId })
            .then(result => {
                if (result) {
                    this.proposalLinesRaw = result.map((line, index) => ({
                        ...line,
                        serialNumber: index + 1,
                        productName: line.wfrecon__Product__r?.Name || '',
                        pricebookName: line.wfrecon__Price_Book__r?.Name || ''
                    }));
                }
                this.isLoading = false;
            })
            .catch(error => {
                this.showToast('Error', 'Error loading proposal lines: ' + error.body?.message, 'error');
                this.isLoading = false;
            });
    }

    // Get formatted proposal lines
    get proposalLines() {
        return this.proposalLinesRaw;
    }

    // Handle Add Proposal Line button click
    handleAddProposalLine() {
        this.showToast('Info', 'Add Proposal Line functionality coming soon!', 'info');
    }

    // Show toast notification
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }
}