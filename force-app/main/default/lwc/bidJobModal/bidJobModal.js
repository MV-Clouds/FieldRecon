import { LightningElement, api, track, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { updateRecord } from 'lightning/uiRecordApi';
import getBidsWithProposals from '@salesforce/apex/SovJobScopeController.getBidsWithProposals';
import createScopeEntriesFromProposalLines from '@salesforce/apex/SovJobScopeController.createScopeEntriesFromProposalLines';
import { NavigationMixin } from 'lightning/navigation';

// Bid fields to fetch
const BID_FIELDS = [
    'wfrecon__Bid__c.Id',
    'wfrecon__Bid__c.Name',
    'wfrecon__Bid__c.wfrecon__AccountId__c',
    'wfrecon__Bid__c.wfrecon__Amount__c',
    'wfrecon__Bid__c.wfrecon__Description__c',
    'wfrecon__Bid__c.wfrecon__Status__c',
    'wfrecon__Bid__c.wfrecon__Job__c'
];

export default class BidJobModal extends NavigationMixin(LightningElement) {
    @api recordId; // Bid Record ID from Quick Action
    @track isClosedWonBid = false;
    @track isLoading = false;

    // Pre-populated values from Bid
    bidId;
    bidName = '';
    accountId;
    jobStatus = 'Active';
    defaultJobName = '';
    defaultAmount;
    defaultDescription = '';
    defaultBudgetedPerDiemCost;
    defaultBudgetedMileageCost;
    defaultBudgetedMaterialCost;
    defaultBudgetedLabourCost;
    defaultBudgetedHotelCost;

    // Page navigation
    @track currentPage = 'createLink'; // 'createLink' or 'proposals'
    @track createLinkMode = 'create'; // 'create' or 'link'

    // Selected job for linking
    @track selectedJobId = '';
    defaultjobId = '';

    // Bid/Proposal/Proposal Line properties
    @track displayedProposals = [];
    @track originalProposals = [];
    @track selectedProposalLines = new Map(); // Selected proposal lines
    @track isImportingProposalLines = false;
    @track isLoadingBidData = false;
    @track hasBidError = false;
    @track bidErrorMessage = '';

    displayInfo = {
        primaryField: 'Name',
        additionalFields: ['wfrecon__Job_Name__c']
    };

    matchingInfo = {
        primaryField: { fieldPath: 'Name' },
        additionalFields: [{ fieldPath: 'wfrecon__Job_Name__c' }]
    };


    @wire(getRecord, { recordId: '$recordId', fields: BID_FIELDS })
    wiredBid({ error, data }) {
        this.isLoading = true;
        if (data) {
            this.bidId = this.recordId;
            this.bidName = getFieldValue(data, 'wfrecon__Bid__c.Name') || this.recordId;
            this.accountId = getFieldValue(data, 'wfrecon__Bid__c.wfrecon__AccountId__c');
            this.defaultJobName = this.bidName;

            const job = getFieldValue(data, 'wfrecon__Bid__c.wfrecon__Job__c');
            this.selectedJobId = job;
            this.defaultjobId = job;
            this.defaultAmount = getFieldValue(data, 'wfrecon__Bid__c.wfrecon__Amount__c');
            this.defaultDescription = getFieldValue(data, 'wfrecon__Bid__c.wfrecon__Description__c') || '';

            console.log('bidjobname ', this.selectedJobId);

            const bidStatus = getFieldValue(data, 'wfrecon__Bid__c.wfrecon__Status__c');
            this.isClosedWonBid = bidStatus && bidStatus.toLowerCase() === 'closed won';

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
        this.loadBids();
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

    // Page navigation getters
    get isCreateLinkPage() {
        return this.currentPage === 'createLink';
    }

    get isProposalsPage() {
        return this.currentPage === 'proposals';
    }

    // Getters
    get isCreateMode() {
        return this.createLinkMode === 'create';
    }

    get isLinkMode() {
        return this.createLinkMode === 'link';
    }

    get createNewTabClass() {
        return this.createLinkMode === 'create' ? 'tab-button active' : 'tab-button';
    }

    get linkExistingTabClass() {
        return this.createLinkMode === 'link' ? 'tab-button active' : 'tab-button';
    }

    get hasSelectedProposalLines() {
        let totalSelectedCount = 0;
        this.selectedProposalLines.forEach((lineSet) => {
            totalSelectedCount += lineSet.size;
        });
        return totalSelectedCount > 0;
    }

    get saveButtonLabel() {
        if (this.createLinkMode === 'create') {
            return 'Create Job';
        } else if (this.createLinkMode === 'link') {
            return 'Link Job';
        }
        return 'Save';
    }

    get isSaveDisabled() {
        if (this.createLinkMode === 'link' && !this.selectedJobId) {
            return true;
        }
        return false;
    }

    handleCreateNewJob() {
        // Clear any existing validation
        const recordPicker = this.template.querySelector('lightning-record-picker');
        if (recordPicker) {
            recordPicker.setCustomValidity('');
            recordPicker.reportValidity();
        }

        // Set mode for create new job
        this.createLinkMode = 'create';
         this.selectedJobId = '';
    }

    handleLinkExistingJob() {
        // Clear any existing validation
        const recordPicker = this.template.querySelector('lightning-record-picker');
        if (recordPicker) {
            recordPicker.setCustomValidity('');
            recordPicker.reportValidity();
        }
        // Set mode for link existing job
        this.createLinkMode = 'link';
        this.selectedJobId = this.defaultjobId;
    }

    handleJobSelection(event) {
        const recordPicker = this.template.querySelector('lightning-record-picker');
        this.selectedJobId = event.detail.recordId;
        if (this.selectedJobId) {
             if (recordPicker) {
                recordPicker.setCustomValidity('');
                recordPicker.reportValidity();
            }
        } 
    }

    /**
     * Method Name: loadBids
     * @description: Load bids with proposals for the current bid
     */
    async loadBids() {
        this.isLoadingBidData = true;
        this.hasBidError = false;
        try {
            // Pass bidId to get proposals for this specific bid
            const result = await getBidsWithProposals({ jobId: null, bidId: this.recordId });

            if (result.success && result.bids) {
                // Since we're querying by bidId, we should get the current bid directly
                const currentBid = result.bids.length > 0 ? result.bids[0] : null;

                if (currentBid && currentBid.proposals) {
                    // Store proposals for table with expandable rows
                    this.originalProposals = (currentBid.proposals || []).map(proposal => ({
                        Id: proposal.Id,
                        Name: proposal.Name,
                        Type__c: proposal.Type__c,
                        Sales_Price__c: proposal.Sales_Price__c,
                        Status__c: proposal.Status__c,
                        wfrecon__Budgeted_Per_Diem_Cost__c: proposal.wfrecon__Budgeted_Per_Diem_Cost__c,
                        wfrecon__Budgeted_Mileage_Cost__c: proposal.wfrecon__Budgeted_Mileage_Cost__c,
                        wfrecon__Budgeted_Material_Cost__c: proposal.wfrecon__Budgeted_Material_Cost__c,
                        wfrecon__Budgeted_Labour_Cost__c: proposal.wfrecon__Budgeted_Labour_Cost__c,
                        wfrecon__Budgeted_Hotel_Cost__c: proposal.wfrecon__Budgeted_Hotel_Cost__c,
                        recordUrl: proposal.recordUrl,
                        showLines: false,
                        isLoadingLines: false,
                        isAllLinesSelected: false,
                        proposalLines: (proposal.proposalLines || []).map(line => ({
                            Id: line.Id,
                            Name: line.Name,
                            Sales_Price__c: line.Sales_Price__c || 0,
                            Description__c: line.Description__c || '--',
                            recordUrl: line.recordUrl,
                            isSelected: false
                        }))
                    }));

                    this.displayedProposals = [...this.originalProposals];
                    if (this.originalProposals.length > 0 && this.originalProposals[0]) {
                        const firstProposal = this.originalProposals[0];
                        this.defaultBudgetedPerDiemCost = firstProposal.wfrecon__Budgeted_Per_Diem_Cost__c;
                        this.defaultBudgetedMileageCost = firstProposal.wfrecon__Budgeted_Mileage_Cost__c;
                        this.defaultBudgetedMaterialCost = firstProposal.wfrecon__Budgeted_Material_Cost__c;
                        this.defaultBudgetedLabourCost = firstProposal.wfrecon__Budgeted_Labour_Cost__c;
                        this.defaultBudgetedHotelCost = firstProposal.wfrecon__Budgeted_Hotel_Cost__c;
                    } else {
                        // Set default values if no proposals found
                        this.defaultBudgetedPerDiemCost = null;
                        this.defaultBudgetedMileageCost = null;
                        this.defaultBudgetedMaterialCost = null;
                        this.defaultBudgetedLabourCost = null;
                        this.defaultBudgetedHotelCost = null;
                    }

                    // Initialize proposal line selections
                    this.selectedProposalLines.clear();
                } else {
                    this.displayedProposals = [];
                    this.originalProposals = [];
                }
            } else {
                this.hasBidError = true;
                this.bidErrorMessage = result.error || 'Failed to load proposals';
            }
        } catch (error) {
            this.hasBidError = true;
            this.bidErrorMessage = error.body?.message || error.message || 'Failed to load proposals';
            console.error('Error loading bids:', error);
        } finally {
            this.isLoadingBidData = false;
        }
    }

    /**
     * Method Name: handleNextToProposals
     * @description: Navigate to proposals page after configuring create/link job
     */
    handleNextToProposals() {
        let inputFields = [];

        // Get input fields if they exist (only in create mode)
        if (this.createLinkMode === 'create') {
            inputFields = this.template.querySelectorAll('lightning-input-field');
        }

        // If in create mode, validate form and sync values before navigating
        if (this.createLinkMode === 'create') {
            let isValid = true;

            // Validate input fields
            inputFields.forEach(field => {
                if (!field.reportValidity()) {
                    isValid = false;
                }
            });

            if (!isValid) {
                this.showToast('Error', 'Please fix the errors in the form before proceeding.', 'error');
                return;
            }
        }
        // If in link mode, validate job selection
        else if (this.createLinkMode === 'link') {
            const recordPicker = this.template.querySelector('lightning-record-picker');

            // First check if selectedJobId is set
            if (!this.selectedJobId) {
                if (recordPicker) {
                    recordPicker.setCustomValidity('Please select a Job');
                    recordPicker.reportValidity();
                }
                this.showToast('Error', 'Please select a Job before proceeding.', 'error');
                return;
            }

            // Also validate the picker itself
            if (recordPicker && !recordPicker.value) {
                recordPicker.setCustomValidity('Please select a Job');
                recordPicker.reportValidity();
                this.showToast('Error', 'Please select a Job before proceeding.', 'error');
                return;
            } else if (recordPicker) {
                recordPicker.setCustomValidity('');
            }
        }

        // Sync form field values to reactive properties for the hidden form on proposals page
        // Only do this in create mode
        if (this.createLinkMode === 'create' && inputFields.length > 0) {
            inputFields.forEach(field => {
                const fieldName = field.fieldName;
                const value = field.value;

                if (fieldName === 'wfrecon__Job_Name__c') {
                    this.defaultJobName = value;
                } else if (fieldName === 'wfrecon__Total_Contract_Price__c') {
                    this.defaultAmount = value;
                } else if (fieldName === 'wfrecon__Description__c') {
                    this.defaultDescription = value;
                } else if (fieldName === 'wfrecon__Account__c') {
                    this.accountId = value;
                } else if (fieldName === 'wfrecon__Status__c') {
                    this.jobStatus = value;
                } else if (fieldName === 'wfrecon__Budgeted_Labour_Cost__c') {
                    this.defaultBudgetedLabourCost = value;
                } else if (fieldName === 'wfrecon__Budgeted_Hotel_Cost__c') {
                    this.defaultBudgetedHotelCost = value;
                } else if (fieldName === 'wfrecon__Budgeted_Material_Cost__c') {
                    this.defaultBudgetedMaterialCost = value;
                } else if (fieldName === 'wfrecon__Budgeted_Mileage_Cost__c') {
                    this.defaultBudgetedMileageCost = value;
                } else if (fieldName === 'wfrecon__Budgeted_Per_Diem_Cost__c') {
                    this.defaultBudgetedPerDiemCost = value;
                }
            });
        }

        // Move to proposals page
        this.currentPage = 'proposals';
    }

    /**
     * Method Name: handleBackToCreateLink
     * @description: Navigate back to create/link job page
     */
    handleBackToCreateLink() {
        // Go back to create/link job page
        this.currentPage = 'createLink';
    }

    /**
     * Method Name: handleToggleProposalLines
     * @description: Toggle proposal lines visibility
     */
    handleToggleProposalLines(event) {
        const proposalId = event.currentTarget.dataset.proposalId;

        // Update the proposal's showLines state
        this.displayedProposals = this.displayedProposals.map(proposal => {
            if (proposal.Id === proposalId) {
                const showLines = !proposal.showLines;
                return {
                    ...proposal,
                    showLines: showLines,
                    isLoadingLines: showLines && !proposal.proposalLines
                };
            }
            return proposal;
        });
    }

    /**
     * Method Name: handleProposalLineSelection
     * @description: Handle individual proposal line selection on page 2
     */
    handleProposalLineSelection(event) {
        const proposalId = event.target.dataset.proposalId;
        const lineId = event.target.dataset.lineId;
        const isChecked = event.target.checked;

        // Initialize the proposal entry if it doesn't exist
        if (!this.selectedProposalLines.has(proposalId)) {
            this.selectedProposalLines.set(proposalId, new Set());
        }

        const selectedLines = this.selectedProposalLines.get(proposalId);

        if (isChecked) {
            selectedLines.add(lineId);
        } else {
            selectedLines.delete(lineId);
        }

        // Update the line's selected state in the displayed data
        this.updateProposalLineSelection(proposalId, lineId, isChecked);

        // Update "Select All" checkbox state for this proposal
        this.updateSelectAllState(proposalId);

        // Create a new Map to trigger reactivity
        this.selectedProposalLines = new Map(this.selectedProposalLines);
    }

    /**
     * Method Name: handleSelectAllProposalLines
     * @description: Handle "Select All" for proposal lines
     */
    handleSelectAllProposalLines(event) {
        const proposalId = event.target.dataset.proposalId;
        const isChecked = event.target.checked;

        // Find the proposal
        const targetProposal = this.displayedProposals.find(p => p.Id === proposalId);

        if (!targetProposal || !targetProposal.proposalLines) return;

        // Initialize the proposal entry if it doesn't exist
        if (!this.selectedProposalLines.has(proposalId)) {
            this.selectedProposalLines.set(proposalId, new Set());
        }

        const selectedLines = this.selectedProposalLines.get(proposalId);

        if (isChecked) {
            // Add all line IDs
            targetProposal.proposalLines.forEach(line => {
                selectedLines.add(line.Id);
            });
        } else {
            // Remove all line IDs
            targetProposal.proposalLines.forEach(line => {
                selectedLines.delete(line.Id);
            });
            // Remove empty entry from map
            if (selectedLines.size === 0) {
                this.selectedProposalLines.delete(proposalId);
            }
        }

        // Update the displayed data
        this.displayedProposals = this.displayedProposals.map(proposal => {
            if (proposal.Id === proposalId) {
                return {
                    ...proposal,
                    isAllLinesSelected: isChecked,
                    proposalLines: proposal.proposalLines.map(line => ({
                        ...line,
                        isSelected: isChecked
                    }))
                };
            }
            return proposal;
        });

        // Create a new Map to trigger reactivity
        this.selectedProposalLines = new Map(this.selectedProposalLines);
    }

    /**
     * Method Name: updateProposalLineSelection
     * @description: Helper method to update individual line selection
     */
    updateProposalLineSelection(proposalId, lineId, isSelected) {
        this.displayedProposals = this.displayedProposals.map(proposal => {
            if (proposal.Id === proposalId) {
                const updatedLines = proposal.proposalLines.map(line => {
                    if (line.Id === lineId) {
                        return {
                            ...line,
                            isSelected: isSelected
                        };
                    }
                    return line;
                });

                return {
                    ...proposal,
                    proposalLines: updatedLines
                };
            }
            return proposal;
        });
    }

    /**
     * Method Name: updateSelectAllState
     * @description: Helper method to update "Select All" checkbox state
     */
    updateSelectAllState(proposalId) {
        // Find the proposal
        const targetProposal = this.displayedProposals.find(p => p.Id === proposalId);

        if (!targetProposal || !targetProposal.proposalLines) return;

        const selectedLines = this.selectedProposalLines.get(proposalId) || new Set();
        const isAllSelected = targetProposal.proposalLines.length > 0 &&
            selectedLines.size === targetProposal.proposalLines.length;

        // Update the displayed data
        this.displayedProposals = this.displayedProposals.map(proposal => {
            if (proposal.Id === proposalId) {
                return {
                    ...proposal,
                    isAllLinesSelected: isAllSelected
                };
            }
            return proposal;
        });
    }

    /**
     * Method Name: handleImportProposalLine
     * @description: Import selected proposal lines (will be called after job is created/linked)
     */
    async handleImportProposalLine() {
        // Prevent double-click
        if (this.isImportingProposalLines) {
            return;
        }

        // Collect all selected proposal lines across all bids
        const selectedLinesData = [];

        // First, check if any lines are selected
        let totalSelectedCount = 0;
        this.selectedProposalLines.forEach((lineSet) => {
            totalSelectedCount += lineSet.size;
        });

        if (totalSelectedCount === 0) {
            this.showToast('Warning', 'Please select at least one proposal line to import', 'warning');
            return;
        }

        // Collect data for all selected lines
        for (const proposal of this.displayedProposals) {
            const selectedLineIds = this.selectedProposalLines.get(proposal.Id);

            if (selectedLineIds && selectedLineIds.size > 0) {
                // Get the lines that are selected
                const selectedLines = proposal.proposalLines.filter(line =>
                    selectedLineIds.has(line.Id)
                );

                // Add each selected line to the data collection
                selectedLines.forEach(line => {
                    const lineData = {
                        proposalId: proposal.Id,
                        proposalName: proposal.Name,
                        proposalType: proposal.Type__c,
                        lineId: line.Id,
                        lineName: line.Name,
                        description: line.Description__c,
                        salesPrice: line.Sales_Price__c
                    };

                    selectedLinesData.push(lineData);
                });
            }
        }

        // This will be called after job is created/linked
        return selectedLinesData;
    }

    /**
     * Method Name: proceedWithProposalLinesImport
     * @description: Proceed with importing proposal lines to job
     */
    async proceedWithProposalLinesImport(selectedLinesData, jobId) {
        this.isImportingProposalLines = true;

        try {
            // Check if we have data
            if (!selectedLinesData || selectedLinesData.length === 0) {
                this.showToast('Error', 'No proposal lines selected for import', 'error');
                this.isImportingProposalLines = false;
                return false;
            }

            if (!jobId) {
                throw new Error('Job ID is required for importing proposal lines');
            }

            // Prepare scope entry data for each selected line
            const scopeEntriesData = selectedLinesData.map(lineData => {
                // Use the original proposal type from the line data
                const scopeEntryType = lineData.proposalType || 'Contract';

                // Ensure all required fields have values
                const entryData = {
                    name: lineData.lineName || `Imported from ${lineData.proposalName}`,
                    contractValue: lineData.salesPrice || 0,
                    description: lineData.description || '',
                    jobId: jobId,
                    type: scopeEntryType
                };

                return entryData;
            });

            // Stringify the data
            const scopeEntriesDataJson = JSON.stringify(scopeEntriesData);

            // Call Apex method to create scope entries
            const result = await createScopeEntriesFromProposalLines({
                scopeEntriesDataJson: scopeEntriesDataJson
            });

            if (result && result.success) {
                const createdCount = result.createdEntries || selectedLinesData.length;
                this.showToast('Success', `Successfully imported ${createdCount} proposal line${createdCount > 1 ? 's' : ''} as scope entries`, 'success');
                return true;
            } else {
                const errorMsg = result?.error || 'Failed to import proposal lines';
                this.showToast('Error', errorMsg, 'error');
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error('Error in proceedWithProposalLinesImport:', error);
            const errorMessage = error.body?.message || error.message || error.toString() || 'Failed to import proposal lines';
            this.showToast('Error', 'Failed to import proposal lines: ' + errorMessage, 'error');
            throw error; // Re-throw to be caught by handleSuccess
        } finally {
            this.isImportingProposalLines = false;
        }
    }

    handleCancel() {
        // Close the quick action screen
        this.dispatchEvent(new CustomEvent('close'));
    }

    /**
     * Method Name: handleLinkJob
     * @description: Handles linking an existing job to the bid and importing proposal lines
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

            // Import proposal lines if any are selected
            if (this.hasSelectedProposalLines) {
                const selectedLinesData = await this.handleImportProposalLine();
                if (selectedLinesData && selectedLinesData.length > 0) {
                    await this.proceedWithProposalLinesImport(selectedLinesData, this.selectedJobId);
                }
            }

            this.showToast('Success', 'Job linked successfully', 'success');

            // Close modal after a short delay
            setTimeout(() => {
                this.dispatchEvent(new CustomEvent('close'));
            }, 1000);

        } catch (error) {
            console.error('Error linking job:', error);
            const errorMessage = error.body?.message || error.message || error.toString() || 'Failed to link job';
            this.showToast('Error', 'Failed to link job: ' + errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Method Name: handleSave
     * @description: Handles creating a new job
     */
    async handleSave(event) {
        event.preventDefault();

        try {
            // Find the form - it could be on the createLink page or hidden on the proposals page
            let form = null;

            // Query all forms (including hidden ones)
            const allForms = this.template.querySelectorAll('lightning-record-edit-form');
            if (allForms && allForms.length > 0) {
                form = allForms[0];
            }

            if (!form) {
                throw new Error('Form not found. Please go back to the previous page and try again.');
            }

            // Get all input fields from the form (including hidden ones)
            const inputFields = form.querySelectorAll('lightning-input-field');

            // Validate form fields
            let isValid = true;
            const invalidFields = [];

            inputFields.forEach(field => {
                if (!field.reportValidity()) {
                    isValid = false;
                    invalidFields.push(field.fieldName || 'field');
                }
            });

            if (!isValid) {
                this.showToast('Error', 'Please fix the errors in the form before creating the job.', 'error');
                // If on proposals page, suggest going back
                if (this.currentPage === 'proposals') {
                    console.warn('Form validation failed. Invalid fields:', invalidFields);
                }
                return;
            }

            // Submit the form for creating new job
            this.isLoading = true;
            form.submit();
        } catch (error) {
            console.error('Error in handleSave:', error);
            this.isLoading = false;
            this.showToast('Error', 'Failed to submit form: ' + (error.message || error.toString()), 'error');
        }
    }

    async handleSuccess(event) {
        const jobId = event.detail?.id;

        if (!jobId) {
            console.error('No job ID in success event:', event);
            this.isLoading = false;
            this.showToast('Error', 'Job was created but no ID was returned', 'error');
            return;
        }

        this.isLoading = true; // Ensure loading state is set

        try {
            // Update the Bid with the newly created Job reference
            await this.updateBidWithJob(jobId);

            // Import proposal lines if any are selected
            if (this.hasSelectedProposalLines) {
                const selectedLinesData = await this.handleImportProposalLine();
                if (selectedLinesData && selectedLinesData.length > 0) {
                    await this.proceedWithProposalLinesImport(selectedLinesData, jobId);
                }
            }

            this.showToast('Success', 'Job created successfully', 'success');

            // Close modal after a short delay to show toast
            setTimeout(() => {
                this.dispatchEvent(new CustomEvent('close'));
            }, 1000);

            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: jobId,
                    actionName: 'view',
                },
            });

        } catch (error) {
            console.error('Error in handleSuccess:', error);
            const errorMessage = error.body?.message || error.message || error.toString() || 'Unknown error';
            this.showToast('Warning', 'Job created but failed to update Bid reference. ' + errorMessage, 'warning');

            // Still close the modal even if there's an error
            setTimeout(() => {
                this.dispatchEvent(new CustomEvent('close'));
            }, 2000);
        } finally {
            this.isLoading = false;
        }
    }

    async updateBidWithJob(jobId) {
        try {
            if (!this.bidId) {
                throw new Error('Bid ID is not available');
            }

            if (!jobId) {
                throw new Error('Job ID is not available');
            }

            const fields = {};
            fields['Id'] = this.bidId;
            fields['wfrecon__Job__c'] = jobId;

            const recordInput = {
                fields: fields
            };

            await updateRecord(recordInput);
        } catch (error) {
            console.error('Error updating Bid with Job:', error);
            const errorMessage = error.body?.message || error.message || error.toString() || 'Failed to update Bid';
            throw new Error(errorMessage);
        }
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