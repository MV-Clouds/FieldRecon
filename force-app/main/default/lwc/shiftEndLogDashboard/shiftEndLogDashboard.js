import { LightningElement, track } from 'lwc';
import getShiftEndLogDashboardData from '@salesforce/apex/ShiftEndLogDashboardController.getShiftEndLogDashboardData';
import getLogEntryFiles from '@salesforce/apex/ShiftEndLogDashboardController.getLogEntryFiles';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';

export default class ShiftEndLogDashboard extends NavigationMixin(LightningElement) {
    @track dashboardData = {};
    @track logEntries = [];
    @track filteredLogEntries = [];
    @track selectedLog = null;
    @track locationProcesses = [];
    @track files = [];
    
    isLoading = false;
    showFileViewer = false;
    showLocationProcessSlider = false;
    selectedDateFilter = 'last30days';
    searchTerm = '';
    selectedStatus = '';
    
    // Date filter options
    get dateFilterOptions() {
        return [
            { label: 'Last 7 Days', value: 'last7days', selected: this.selectedDateFilter === 'last7days' },
            { label: 'Last 15 Days', value: 'last15days', selected: this.selectedDateFilter === 'last15days' },
            { label: 'Last 30 Days', value: 'last30days', selected: this.selectedDateFilter === 'last30days' },
            { label: 'All Time', value: 'alltime', selected: this.selectedDateFilter === 'alltime' }
        ];
    }
    
    // Status filter options
    get statusFilterOptions() {
        return [
            { label: 'All', value: '', selected: this.selectedStatus === '' },
            { label: 'Pending', value: 'Pending', selected: this.selectedStatus === 'Pending' },
            { label: 'Approved', value: 'Approved', selected: this.selectedStatus === 'Approved' },
            { label: 'Auto-Approved', value: 'Auto-Approved', selected: this.selectedStatus === 'Auto-Approved' },
            { label: 'Rejected', value: 'Rejected', selected: this.selectedStatus === 'Rejected' }
        ];
    }
    
    // KPIs
    get totalLogs() {
        return this.dashboardData.totalLogs || 0;
    }
    
    get pendingLogs() {
        return this.dashboardData.pendingLogs || 0;
    }
    
    get approvedLogs() {
        return this.dashboardData.approvedLogs || 0;
    }
    
    get rejectedLogs() {
        return this.dashboardData.rejectedLogs || 0;
    }
    
    get autoApprovedLogs() {
        return this.dashboardData.autoApprovedLogs || 0;
    }
    
    get hasLogs() {
        return this.filteredLogEntries && this.filteredLogEntries.length > 0;
    }
    
    get hasFiles() {
        return this.files && this.files.length > 0;
    }
    
    get hasLocationProcesses() {
        return this.locationProcesses && this.locationProcesses.length > 0;
    }
    
    connectedCallback() {
        this.fetchDashboardData();
    }
    
    // Fetch dashboard data
    fetchDashboardData() {
        this.isLoading = true;
        getShiftEndLogDashboardData({ dateFilter: this.selectedDateFilter })
            .then(result => {
                this.dashboardData = result;
                this.logEntries = result.logEntries || [];
                this.applyFilters();
                this.isLoading = false;
            })
            .catch(error => {
                this.showToast('Error', this.getErrorMessage(error), 'error');
                this.isLoading = false;
            });
    }
    
    // Handle date filter change
    handleDateFilterChange(event) {
        this.selectedDateFilter = event.detail.value;
        this.fetchDashboardData();
    }
    
    // Handle status filter change
    handleStatusFilterChange(event) {
        this.selectedStatus = event.detail.value;
        this.applyFilters();
    }
    
    // Handle search
    handleSearch(event) {
        this.searchTerm = event.target.value.toLowerCase();
        this.applyFilters();
    }
    
    // Apply filters
    applyFilters() {
        let filtered = [...this.logEntries];
        
        // Apply status filter
        if (this.selectedStatus) {
            filtered = filtered.filter(log => log.status === this.selectedStatus);
        }
        
        // Apply search filter
        if (this.searchTerm) {
            filtered = filtered.filter(log => {
                return (
                    log.name.toLowerCase().includes(this.searchTerm) ||
                    log.jobName.toLowerCase().includes(this.searchTerm) ||
                    log.jobNumber.toLowerCase().includes(this.searchTerm) ||
                    log.createdBy.toLowerCase().includes(this.searchTerm) ||
                    (log.workPerformed && log.workPerformed.toLowerCase().includes(this.searchTerm)) ||
                    (log.planForTomorrow && log.planForTomorrow.toLowerCase().includes(this.searchTerm))
                );
            });
        }
        
        // Add status class to each log
        this.filteredLogEntries = filtered.map(log => ({
            ...log,
            statusClass: this.getStatusClass(log.status)
        }));
    }
    
    // Navigate to job record
    handleJobClick(event) {
        event.preventDefault();
        const jobId = event.currentTarget.dataset.jobId;
        if (jobId && jobId !== '--') {
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: jobId,
                    actionName: 'view'
                }
            });
        }
    }
    
    // Show files modal
    handleShowFiles(event) {
        const logId = event.currentTarget.dataset.logId;
        this.isLoading = true;
        
        getLogEntryFiles({ logEntryId: logId })
            .then(result => {
                this.files = result || [];
                this.showFileViewer = true;
                this.isLoading = false;
            })
            .catch(error => {
                this.showToast('Error', this.getErrorMessage(error), 'error');
                this.isLoading = false;
            });
    }
    
    // Close file viewer
    handleCloseFileViewer() {
        this.showFileViewer = false;
        this.files = [];
    }
    
    // Show location processes slider
    handleShowLocationProcesses(event) {
        const logId = event.currentTarget.dataset.logId;
        const log = this.logEntries.find(l => l.id === logId);
        
        if (log && log.approvalData) {
            try {
                const approvalData = JSON.parse(log.approvalData);
                
                if (approvalData.locationProcessChanges && approvalData.locationProcessChanges.length > 0) {
                    this.locationProcesses = approvalData.locationProcessChanges.map(lp => {
                        const oldValue = lp.oldValue || 0;
                        const newValue = lp.newValue || 0;
                        return {
                            id: lp.id,
                            name: lp.name,
                            oldValue: oldValue,
                            newValue: newValue,
                            oldProgressStyle: `width: ${oldValue}%`,
                            newProgressStyle: `width: ${newValue}%`
                        };
                    });
                    this.showLocationProcessSlider = true;
                } else {
                    this.showToast('Info', 'No location process data available for this log', 'info');
                }
            } catch (error) {
                this.showToast('Error', 'Failed to parse location process data', 'error');
            }
        } else {
            this.showToast('Info', 'No approval data available for this log', 'info');
        }
    }
    
    // Close location process slider
    handleCloseLocationProcessSlider() {
        this.showLocationProcessSlider = false;
        this.locationProcesses = [];
    }
    
    // Download file
    handleDownloadFile(event) {
        const fileUrl = event.currentTarget.dataset.url;
        window.open(fileUrl, '_blank');
    }
    
    // Stop propagation for modal
    handleStopPropagation(event) {
        event.stopPropagation();
    }
    
    // Get status badge class
    getStatusClass(status) {
        const baseClass = 'status-badge';
        switch(status) {
            case 'Approved':
            case 'Auto-Approved':
                return `${baseClass} status-approved`;
            case 'Pending':
                return `${baseClass} status-pending`;
            case 'Rejected':
                return `${baseClass} status-rejected`;
            default:
                return baseClass;
        }
    }
    
    // Get error message from error object
    getErrorMessage(error) {
        if (error && error.body && error.body.message) {
            return error.body.message;
        }
        return 'An unknown error occurred';
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