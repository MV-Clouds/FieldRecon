import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getUnapprovedLogEntries from '@salesforce/apex/ApproveShiftEndLogsController.getUnapprovedLogEntries';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ApproveShiftEndLogs extends NavigationMixin(LightningElement) {
    @track logEntriesRaw = [];
    @track filteredLogEntriesRaw = [];
    @track isLoading = true;
    @track searchTerm = '';
    @track selectedDateFilter = 'last7days';

    @track logColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { label: 'Action', fieldName: 'actions', style: 'width: 6rem' },
        { 
            label: 'Job Number', 
            fieldName: 'jobNumber', 
            isLink: true,
            recordIdField: 'jobId',
            style: 'width: 12rem' 
        },
        { label: 'Job Name', fieldName: 'jobName',style: 'width: 15rem' },
        { label: 'Entry Number', fieldName: 'entryNumber', style: 'width: 10rem' },
        { label: 'Submitted Date', fieldName: 'submittedDate', style: 'width: 12rem' },
        { label: 'Submitted By', fieldName: 'submittedBy', style: 'width: 12rem' }
    ];

    dateFilterOptions = [
        { label: 'Last 7 Days', value: 'last7days' },
        { label: 'Last 15 Days', value: 'last15days' },
        { label: 'Last 30 Days', value: 'last30days' },
        { label: 'All Time', value: 'alltime' }
    ];

    /**
     * Method Name: logEntries
     * @description: This method processes raw log entries and formats them for display in the UI.
     */
    get logEntries() {
        return this.filteredLogEntriesRaw.map((log, index) => {
            return {
                Id: log.Id,
                key: log.Id,
                jobId: log.jobId,
                values: this.logColumns.map(col => {
                    let cell = {
                        value: '',
                        style: col.style,
                        isActions: false,
                        recordLink: null
                    };

                    if (col.fieldName === 'srNo') {
                        cell.value = index + 1;
                    } else if (col.fieldName === 'actions') {
                        cell.isActions = true;
                    } else {
                        cell.value = log[col.fieldName] || '--';
                        
                        if (col.isLink && col.recordIdField) {
                            cell.recordLink = `/${log[col.recordIdField]}`;
                        }
                    }

                    return cell;
                })
            };
        });
    }

    /**
     * Method Name: connectedCallback
     * @description: This method is called when the component is connected to the DOM.
     */
    connectedCallback() {
        this.loadLogEntries();
    }

    /**
     * Method Name: loadLogEntries
     * @description: Method is used to load log entries from the server
     */
    loadLogEntries() {
        this.isLoading = true;
        getUnapprovedLogEntries({ dateFilter: this.selectedDateFilter })
            .then(result => {
                console.log('getUnapprovedLogEntries result:', result);
                
                this.logEntriesRaw = result;
                this.filteredLogEntriesRaw = result;
                this.applyFilters();
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error loading log entries:', error);
                this.showToast('Error', 'Failed to load log entries', 'error');
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handleSearch
     * @description: Method is used to handle the search
     */
    handleSearch(event) {
        this.searchTerm = event.target.value;
        this.applyFilters();
    }

    /**
     * Method Name: handleDateFilterChange
     * @description: Method is used to handle the date filter change
     */
    handleDateFilterChange(event) {
        this.selectedDateFilter = event.target.value;
        this.loadLogEntries();
    }

    /**
     * Method Name: applyFilters
     * @description: Method is used to apply search filters
     */
    applyFilters() {
        if (!this.searchTerm) {
            this.filteredLogEntriesRaw = [...this.logEntriesRaw];
            return;
        }

        const searchLower = this.searchTerm.toLowerCase();
        this.filteredLogEntriesRaw = this.logEntriesRaw.filter(log => {
            const jobName = (log.jobName || '').toLowerCase();
            const jobNumber = (log.jobNumber || '').toLowerCase();
            return jobName.includes(searchLower) || jobNumber.includes(searchLower);
        });
    }

    /**
     * Method Name: handleActionClick
     * @description: Method is used to handle the action click (Approve)
     */
    handleActionClick(event) {
        const logId = event.currentTarget.dataset.logid;
        const action = event.currentTarget.dataset.action;
        
        if (action === 'approve') {
            // TODO: Implement approve functionality
            console.log('Approve log entry:', logId);
            this.showToast('Success', 'Approval functionality to be implemented', 'info');
        }
    }

    /**
     * Method Name: handleLinkClick
     * @description: Method is used to handle the link click for job record navigation
     */
    handleLinkClick(event) {
        try {
            const jobId = event.currentTarget.dataset.link;
            if (jobId) {
                this[NavigationMixin.Navigate]({
                    type: 'standard__recordPage',
                    attributes: {
                        recordId: jobId,
                        actionName: 'view',
                    },
                });
            }
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleLinkClick ::', error);
        }
    }

    /**
     * Method Name: showToast
     * @description: Method is used to show toast messages
     */
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }
}