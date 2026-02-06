import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAllBids from '@salesforce/apex/BidsListController.getAllBids';
import getStatusPicklistValues from '@salesforce/apex/BidsListController.getStatusPicklistValues';
import getProposalsForBid from '@salesforce/apex/BidsListController.getProposalsForBid';
import createProposal from '@salesforce/apex/BidsListController.createProposal';
import createBid from '@salesforce/apex/BidsListController.createBid';
import getContactInfo from '@salesforce/apex/BidProposalController.getContactInfo';
import getProposalConfig from '@salesforce/apex/BidProposalController.getProposalConfig';

export default class BidsList extends NavigationMixin(LightningElement) {
    @track isLoading = true;
    @track bidData = [];
    @track allBidData = [];
    @track paginatedBidData = [];
    
    @track searchTerm = '';
    @track selectedStatuses = [];
    @track showRecentlyViewed = true;
    
    // Status filter properties
    @track showStatusDropdown = false;
    @track statusOptions = [];
    @track filteredStatusOptions = [];
    @track statusSearchTerm = '';
    
    // Pagination properties
    @track currentPage = 1;
    @track pageSize = 50;
    @track totalPages = 1;
    
    // Proposal expansion tracking
    @track expandedBids = new Set();
    @track proposalDataMap = new Map();
    
    // Proposal creation modal
    @track showProposalModal = false;
    @track selectedBidForProposal = null;
    @track selectedBidData = null;
    @track contactId = null;
    @track contactEmail = '';
    @track contactPhone = '';
    @track ohValue = 0;
    @track warrantyValue = 0;
    @track profitValue = 0;
    @track ohDisplay = '0%';
    @track warrantyDisplay = '0%';
    @track profitDisplay = '0%';
    @track expirationDate = null;
    @track isSavingProposal = false;
    
    // Bid creation modal
    @track showBidModal = false;
    @track isSavingBid = false;
    @track defaultBidStatus = '';

    // Computed properties
    get isBidDataAvailable() {
        return this.paginatedBidData && this.paginatedBidData.length > 0;
    }
    
    get isFirstPage() {
        return this.currentPage === 1;
    }
    
    get isLastPage() {
        return this.currentPage === this.totalPages;
    }
    
    get pageNumbers() {
        const pages = [];
        const totalPages = this.totalPages;
        const currentPage = this.currentPage;
        
        pages.push({ number: 1, isEllipsis: false });
        
        if (currentPage > 3) {
            pages.push({ number: 'ellipsis1', isEllipsis: true });
        }
        
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
            pages.push({ number: i, isEllipsis: false });
        }
        
        if (currentPage < totalPages - 2) {
            pages.push({ number: 'ellipsis2', isEllipsis: true });
        }
        
        if (totalPages > 1) {
            pages.push({ number: totalPages, isEllipsis: false });
        }
        
        return pages.map(page => ({
            ...page,
            cssClass: page.isEllipsis ? 'pagination-ellipsis' :
                `pagination-button ${page.number === this.currentPage ? 'active' : ''}`
        }));
    }
    
    get selectedStatusText() {
        if (this.selectedStatuses.length === 0) {
            return 'All Statuses';
        }
        
        const allStatusValues = this.statusOptions.map(option => option.value);
        const allSelected = allStatusValues.length > 0 &&
            this.selectedStatuses.length === allStatusValues.length &&
            allStatusValues.every(status => this.selectedStatuses.includes(status));
        
        if (allSelected) {
            return 'All Statuses';
        }
        
        if (this.selectedStatuses.length === 1) {
            const selectedOption = this.statusOptions.find(
                option => option.value === this.selectedStatuses[0]
            );
            return selectedOption ? selectedOption.label : this.selectedStatuses[0];
        }
        
        return `${this.selectedStatuses.length} Statuses Selected`;
    }
    
    get recentlyViewedButtonLabel() {
        return this.showRecentlyViewed ? 'Show All Bids' : 'Show Recently Viewed';
    }

    get saveButtonLabel() {
        return this.isSavingProposal ? 'Saving...' : 'Save Proposal';
    }
    
    get saveBidButtonLabel() {
        return this.isSavingBid ? 'Saving...' : 'Save Bid';
    }
    
    connectedCallback() {
        this.loadStatusOptions();
        this.loadBidData();
        this.loadProposalConfig();
        document.addEventListener('click', this.handleOutsideClick.bind(this));
    }
    
    disconnectedCallback() {
        document.removeEventListener('click', this.handleOutsideClick.bind(this));
    }
    
    async loadStatusOptions() {
        try {
            const options = await getStatusPicklistValues();
            this.statusOptions = options.map(opt => ({
                label: opt.label,
                value: opt.value,
                selected: false
            }));
            this.filteredStatusOptions = [...this.statusOptions];
            
            // Set default bid status (first option)
            if (options.length > 0) {
                this.defaultBidStatus = options[0].value;
            }
        } catch (error) {
            console.error('Error loading status options:', error);
        }
    }
    
    async loadBidData() {
        this.isLoading = true;
        try {
            const data = await getAllBids({ filterByRecentlyViewed: this.showRecentlyViewed });
            this.allBidData = data.map(bid => ({ ...bid }));
            this.applyFilters();
        } catch (error) {
            console.error('Error loading bid data:', error);
            this.showToast('Error', 'Failed to load bid data', 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    handleOutsideClick(event) {
        const dropdown = this.template.querySelector('.custom-multiselect');
        if (dropdown && !dropdown.contains(event.target)) {
            this.showStatusDropdown = false;
        }
    }
    
    toggleStatusDropdown(event) {
        event.stopPropagation();
        this.showStatusDropdown = !this.showStatusDropdown;
    }
    
    handleDropdownClick(event) {
        event.stopPropagation();
    }
    
    handleStatusSearch(event) {
        try {
            this.statusSearchTerm = event.target.value.toLowerCase();
            this.filteredStatusOptions = this.statusOptions.filter(option =>
                option.label.toLowerCase().includes(this.statusSearchTerm)
            );
        } catch (error) {
            console.error("Error in handleStatusSearch :: ", error);
        }
    }
    
    handleStatusToggle(event) {
        try {
            event.stopPropagation();
            const value = event.currentTarget.dataset.value || event.target.dataset.value;
            
            if (!value) return;
            
            this.statusOptions = this.statusOptions.map(option => {
                if (option.value === value) {
                    return { ...option, selected: !option.selected };
                }
                return option;
            });
            
            this.filteredStatusOptions = this.statusOptions.filter(option =>
                option.label.toLowerCase().includes(this.statusSearchTerm)
            );
            
            this.selectedStatuses = this.statusOptions
                .filter(option => option.selected)
                .map(option => option.value);
            
            this.applyFilters();
        } catch (error) {
            console.error("Error in handleStatusToggle :: ", error);
        }
    }
    
    handleSearchInput(event) {
        try {
            this.searchTerm = event.target.value;
            this.applyFilters();
        } catch (error) {
            console.error("Error in handleSearchInput :: ", error);
        }
    }
    
    handleKeyPress(event) {
        if (event.key === 'Enter') {
            this.applyFilters();
        }
    }
    
    applyFilters() {
        try {
            let filteredData = [...this.allBidData];
            
            // Apply search filter
            if (this.searchTerm) {
                const searchLower = this.searchTerm.toLowerCase();
                filteredData = filteredData.filter(bid =>
                    bid.name?.toLowerCase().includes(searchLower)
                );
            }
            
            // Apply status filter
            if (this.selectedStatuses.length > 0) {
                filteredData = filteredData.filter(bid =>
                    this.selectedStatuses.includes(bid.status)
                );
            }
            
            this.bidData = filteredData;
            this.currentPage = 1;
            this.updatePaginatedData();
        } catch (error) {
            console.error("Error in applyFilters :: ", error);
        }
    }
    
    clearFilters() {
        try {
            this.searchTerm = '';
            this.selectedStatuses = [];
            this.statusOptions = this.statusOptions.map(option => ({
                ...option,
                selected: false
            }));
            this.filteredStatusOptions = [...this.statusOptions];
            this.applyFilters();
        } catch (error) {
            console.error("Error in clearFilters :: ", error);
        }
    }
    
    toggleRecentlyViewed() {
        try {
            this.showRecentlyViewed = !this.showRecentlyViewed;
            this.loadBidData();
        } catch (error) {
            console.error("Error in toggleRecentlyViewed :: ", error);
        }
    }
    
    updatePaginatedData() {
        try {
            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = startIndex + this.pageSize;
            
            this.totalPages = Math.ceil(this.bidData.length / this.pageSize);
            
            this.paginatedBidData = this.bidData
                .slice(startIndex, endIndex)
                .map((bid, index) => {
                    const isExpanded = this.expandedBids.has(bid.bidId);
                    const proposals = this.proposalDataMap.get(bid.bidId) || [];
                    
                    return {
                        ...bid,
                        srNo: startIndex + index + 1,
                        isExpanded: isExpanded,
                        proposalRowKey: `${bid.bidId}-proposals`,
                        isLoadingProposals: false,
                        hasProposals: proposals.length > 0,
                        proposals: proposals
                    };
                });
        } catch (error) {
            console.error("Error in updatePaginatedData :: ", error);
        }
    }
    
    handlePageChange(event) {
        try {
            const page = parseInt(event.target.dataset.page, 10);
            this.currentPage = page;
            this.updatePaginatedData();
        } catch (error) {
            console.error("Error in handlePageChange :: ", error);
        }
    }
    
    handlePrevious() {
        try {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.updatePaginatedData();
            }
        } catch (error) {
            console.error("Error in handlePrevious :: ", error);
        }
    }
    
    handleNext() {
        try {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.updatePaginatedData();
            }
        } catch (error) {
            console.error("Error in handleNext :: ", error);
        }
    }

    navigateToRecord(event) {
        try {
            const recordId = event.currentTarget.dataset.id;
            if (recordId) {
                this[NavigationMixin.Navigate]({
                    type: 'standard__recordPage',
                    attributes: {
                        recordId: recordId,
                        actionName: 'view'
                    }
                });
            }
        } catch (error) {
            console.error("Error in navigateToContactRecord :: ", error);
        }
    }
    
    async toggleProposalExpansion(event) {
        const bidId = event.currentTarget.dataset.bidId;
        
        if (this.expandedBids.has(bidId)) {
            // Collapse
            this.expandedBids.delete(bidId);
        } else {
            // Expand and fetch proposals if not already loaded
            this.expandedBids.add(bidId);
            
            if (!this.proposalDataMap.has(bidId)) {
                // Set loading state
                this.updateBidLoadingState(bidId, true);
                
                try {
                    const proposals = await getProposalsForBid({ bidId: bidId });
                    this.proposalDataMap.set(bidId, proposals);
                } catch (error) {
                    console.error('Error fetching proposals:', error);
                    this.showToast('Error', 'Failed to load proposals', 'error');
                    this.expandedBids.delete(bidId); // Collapse on error
                } finally {
                    this.updateBidLoadingState(bidId, false);
                }
            }
        }
        
        this.updatePaginatedData();
    }
    
    updateBidLoadingState(bidId, isLoading) {
        try {
            this.paginatedBidData = this.paginatedBidData.map(bid => {
                if (bid.bidId === bidId) {
                    return { ...bid, isLoadingProposals: isLoading };
                }
                return bid;
            });
        } catch (error) {
            console.error("Error in updateBidLoadingState :: ", error);
        }
    }
    
    // Proposal Modal Methods
    async loadProposalConfig() {
        try {
            const data = await getProposalConfig();
            if (data) {
                this.ohValue = data.wfrecon__OH__c || 0;
                this.warrantyValue = data.wfrecon__Warranty__c || 0;
                this.profitValue = data.wfrecon__Profit__c || 0;
                this.ohDisplay = `${this.ohValue}%`;
                this.warrantyDisplay = `${this.warrantyValue}%`;
                this.profitDisplay = `${this.profitValue}%`;
            }
        } catch (error) {
            console.error('Error loading Proposal Configuration:', error);
        }
    }
    
    handleOpenProposalModal(event) {
        try {
            const bidId = event.currentTarget.dataset.bidId;
            const bid = this.paginatedBidData.find(b => b.bidId === bidId);
            
            if (!bid) return;
            
            // Check if bid status is "Bidding"
            if (bid.status !== 'Bidding') {
                this.showToast('Cannot Create Proposal', 'Only Bids with status "Bidding" are allowed to create proposals.', 'error');
                return;
            }
            
            this.selectedBidForProposal = bidId;
            this.selectedBidData = {
                bidId: bid.bidId,
                accountId: bid.accountId,
                contactId: null,
                dueDate: bid.dueDate
            };
            
            // Reset form fields
            this.contactId = null;
            this.contactEmail = '';
            this.contactPhone = '';
            this.expirationDate = bid.dueDate;
            
            // Reset to default config values
            this.loadProposalConfig();
            
            this.showProposalModal = true;
        } catch (error) {
            console.error("Error in handleOpenProposalModal :: ", error);
        }
    }
    
    handleCloseProposalModal() {
        try {
            this.showProposalModal = false;
            this.selectedBidForProposal = null;
            this.selectedBidData = null;
            this.isSavingProposal = false;
        } catch (error) {
            console.error("Error in handleCloseProposalModal :: ", error);
        }
    }
    
    handleContactChange(event) {
        try {
            const newContactId = event.detail.value ? event.detail.value[0] : null;
            
            if (newContactId !== this.contactId) {
                this.contactId = newContactId;
                this.fetchContactDetails(newContactId);
            }
        } catch (error) {
            console.error("Error in handleContactChange :: ", error);
        }
    }
    
    async fetchContactDetails(contactId) {
        if (!contactId) {
            this.contactEmail = '';
            this.contactPhone = '';
            return;
        }
        
        try {
            const data = await getContactInfo({ contactId: contactId });
            this.contactEmail = data.Email || '';
            this.contactPhone = data.Phone || '';
        } catch (error) {
            console.error('Error fetching contact details:', error);
            this.contactEmail = '';
            this.contactPhone = '';
        }
    }
    
    handlePercentageInput(event) {
        try {
            const fieldName = event.target.name;
            let value = event.target.value;
            
            value = value.replace(/[^\d.]/g, '');
            
            if (fieldName === 'wfrecon__OH__c') {
                this.ohDisplay = value;
            } else if (fieldName === 'wfrecon__Warranty__c') {
                this.warrantyDisplay = value;
            } else if (fieldName === 'wfrecon__Profit__c') {
                this.profitDisplay = value;
            }
        } catch (error) {
            console.error("Error in handlePercentageInput :: ", error);
        }
    }
    
    handlePercentageBlur(event) {
        try {
            const fieldName = event.target.name;
            let value = event.target.value;
            
            value = value.replace(/[^\d.]/g, '');
            const numValue = parseFloat(value) || 0;
            
            if (fieldName === 'wfrecon__OH__c') {
                this.ohValue = numValue;
                this.ohDisplay = `${numValue}%`;
            } else if (fieldName === 'wfrecon__Warranty__c') {
                this.warrantyValue = numValue;
                this.warrantyDisplay = `${numValue}%`;
            } else if (fieldName === 'wfrecon__Profit__c') {
                this.profitValue = numValue;
                this.profitDisplay = `${numValue}%`;
            }
        } catch (error) {
            console.error("Error in handlePercentageBlur :: ", error);
        }
    }
    
    async handleSaveProposal(event) {
        try {
            event.preventDefault();
            event.stopPropagation();
            
            
            const form = this.template.querySelector('lightning-record-edit-form');
            if (!form) return;
            
            const inputFields = form.querySelectorAll('lightning-input-field');
            const customInputs = form.querySelectorAll('lightning-input');
            let isValid = true;
            
            inputFields.forEach(field => {
                if (!field.reportValidity()) {
                    isValid = false;
                }
            });
            
            customInputs.forEach(input => {
                // Skip validation for disabled fields
                if (!input.disabled && !input.reportValidity()) {
                    isValid = false;
                }
            });
            
            if (!isValid) {
                this.showToast('Validation Error', 'Please fill all required fields correctly.', 'error');
                return;
            }
            
            this.isSavingProposal = true;
            // Get field values from lightning-input-field components
            // const inputFields = form.querySelectorAll('lightning-input-field');
            let bidId, proposalType, accountId, contactId, status;
            
            inputFields.forEach(field => {
                const fieldName = field.fieldName;
                const value = field.value;
                
                if (fieldName === 'wfrecon__Bid__c') bidId = value;
                else if (fieldName === 'wfrecon__Type__c') proposalType = value;
                else if (fieldName === 'wfrecon__Account__c') accountId = value;
                else if (fieldName === 'wfrecon__Contact__c') contactId = value;
                else if (fieldName === 'wfrecon__Status__c') status = value;
            });
            
            // Get expiration date from lightning-input
            const expirationInput = form.querySelector('lightning-input[name="expirationDate"]');
            const expirationDate = expirationInput?.value;
            
            // Validate required fields
            if (!bidId || !proposalType || !accountId || !status) {
                this.showToast('Validation Error', 'Please fill all required fields.', 'error');
                this.isSavingProposal = false;
                return;
            }

            // Validate profit percentage
            const maxAllowed = 100 - this.ohValue - this.warrantyValue;
            if (this.profitValue > maxAllowed) {
                this.showToast('Validation Error', `Profit cannot exceed ${maxAllowed}%. (OH: ${this.ohValue}% + Warranty: ${this.warrantyValue}% + Profit must equal 100%)`, 'error');
                this.isSavingProposal = false;
                return;
            }
            
            // Call Apex to create proposal
            const proposalId = await createProposal({
                bidId: bidId,
                proposalType: proposalType,
                accountId: accountId,
                contactId: contactId,
                status: status,
                oh: this.ohValue,
                warranty: this.warrantyValue,
                profit: this.profitValue,
                expirationDate: expirationDate
            });
            
            this.showToast('Success', 'Proposal created successfully!', 'success');
            
            // Refresh proposals for the bid
            if (this.selectedBidForProposal) {
                // Keep the bid expanded after creation
                this.expandedBids.add(this.selectedBidForProposal);
                
                // Fetch updated proposals
                const proposals = await getProposalsForBid({ bidId: this.selectedBidForProposal });
                this.proposalDataMap.set(this.selectedBidForProposal, proposals);
                this.updatePaginatedData();
            }
            
            this.handleCloseProposalModal();
        } catch (error) {
            console.error('Error creating proposal:', error);
            this.isSavingProposal = false;
            
            let errorMessage = 'An error occurred while creating the proposal.';
            if (error.body && error.body.message) {
                errorMessage = error.body.message;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showToast('Error', errorMessage, 'error');
        }
    }
    
    // Bid Modal Methods
    handleOpenBidModal() {
        try {
            this.showBidModal = true;
        } catch (error) {
            console.error("Error in handleOpenBidModal :: ", error);
        }
    }
    
    handleCloseBidModal() {
        try {
            this.showBidModal = false;
            this.isSavingBid = false;
        } catch (error) {
            console.error("Error in handleCloseBidModal :: ", error);
        }
    }
    
    async handleSaveBid(event) {
        
        try {
            event.preventDefault();
            event.stopPropagation();
            
            const form = this.template.querySelector('lightning-record-edit-form');
            if (!form) return;
            
            const inputFields = form.querySelectorAll('lightning-input-field');
            let isValid = true;
            
            inputFields.forEach(field => {
                if (!field.reportValidity()) {
                    isValid = false;
                }
            });
            
            if (!isValid) {
                this.showToast('Validation Error', 'Please fill all required fields correctly.', 'error');
                return;
            }
            
            this.isSavingBid = true;
            // Get field values from lightning-input-field components
            let bidName, status, dueDate, accountId, contactId, description;
            
            inputFields.forEach(field => {
                const fieldName = field.fieldName;
                const value = field.value;
                
                if (fieldName === 'Name') bidName = value;
                else if (fieldName === 'wfrecon__Status__c') status = value;
                else if (fieldName === 'wfrecon__Bid_Due_Date__c') dueDate = value;
                else if (fieldName === 'wfrecon__AccountId__c') accountId = value;
                else if (fieldName === 'wfrecon__Contact__c') contactId = value;
                else if (fieldName === 'wfrecon__Description__c') description = value;
            });
            
            // Validate required fields (same pattern as proposal)
            if (!bidName || !status || !dueDate) {
                this.showToast('Validation Error', 'Please fill all required fields.', 'error');
                this.isSavingBid = false;
                return;
            }
            
            // Call Apex to create bid
            const bidId = await createBid({
                bidName: bidName,
                status: status,
                dueDate: dueDate,
                accountId: accountId,
                contactId: contactId,
                description: description
            });
            
            this.showToast('Success', 'Bid created successfully!', 'success');
            this.handleCloseBidModal();
            
            // Refresh bids list
            await this.loadBidData();
            
            // Navigate to the new bid record
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: bidId,
                    actionName: 'view'
                }
            });
            
        } catch (error) {
            console.error('Error creating bid:', error);
            this.isSavingBid = false;
            
            let errorMessage = 'An error occurred while creating the bid.';
            if (error.body && error.body.message) {
                errorMessage = error.body.message;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showToast('Error', errorMessage, 'error');
        }
    }
    
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}