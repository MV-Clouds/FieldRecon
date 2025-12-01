import { LightningElement, track } from 'lwc';
import getShiftEndLogDashboardData from '@salesforce/apex/ShiftEndLogDashboardController.getShiftEndLogDashboardData';
import getLogEntryFiles from '@salesforce/apex/ShiftEndLogDashboardController.getLogEntryFiles';
import checkPermissionSetsAssigned from '@salesforce/apex/PermissionsUtility.checkPermissionSetsAssigned';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';

export default class ShiftEndLogDashboard extends NavigationMixin(LightningElement) {
    @track dashboardData = {};
    @track logEntries = [];
    @track filteredLogEntries = [];
    @track shownLogEntries = [];
    @track selectedLog = null;
    @track locationProcesses = [];
    @track files = [];
    @track hasAccess = false;
    @track accessErrorMessage = '';
    @track currentPage = 1;
    @track pageSize = 20;
    @track visiblePages = 5;

    isLoading = true;
    showFileViewer = false;
    showLocationProcessSlider = false;
    selectedDateFilter = 'last30days';
    searchTerm = '';
    selectedStatus = '';
    allLogEntries = []; // Store all logs for filtering

    // Date filter options
    get dateFilterOptions() {
        return [
            { label: 'Last 7 Days', value: 'last7days' },
            { label: 'Last 15 Days', value: 'last15days' },
            { label: 'Last 30 Days', value: 'last30days' },
            { label: 'All Time', value: 'alltime' }
        ];
    }

    // Status filter options
    get statusFilterOptions() {
        return [
            { label: 'All', value: '' },
            { label: 'Pending', value: 'Pending' },
            { label: 'Approved', value: 'Approved' },
            { label: 'Auto-Approved', value: 'Auto-Approved' },
            { label: 'Rejected', value: 'Rejected' }
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
        return this.shownLogEntries && this.shownLogEntries.length > 0;
    }

    get totalItems() {
        return this.filteredLogEntries ? this.filteredLogEntries.length : 0;
    }

    get totalPages() {
        return Math.ceil(this.totalItems / this.pageSize);
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

        if (totalPages <= this.visiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push({
                    number: i,
                    isActive: i === this.currentPage,
                    isEllipsis: false,
                    cssClass: i === this.currentPage ? 'pagination-button active' : 'pagination-button'
                });
            }
        } else {
            const startPage = Math.max(1, this.currentPage - Math.floor(this.visiblePages / 2));
            const endPage = Math.min(totalPages, startPage + this.visiblePages - 1);

            if (startPage > 1) {
                pages.push({
                    number: 1,
                    isActive: false,
                    isEllipsis: false,
                    cssClass: 'pagination-button'
                });

                if (startPage > 2) {
                    pages.push({
                        number: '...',
                        isActive: false,
                        isEllipsis: true,
                        cssClass: ''
                    });
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                pages.push({
                    number: i,
                    isActive: i === this.currentPage,
                    isEllipsis: false,
                    cssClass: i === this.currentPage ? 'pagination-button active' : 'pagination-button'
                });
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    pages.push({
                        number: '...',
                        isActive: false,
                        isEllipsis: true,
                        cssClass: ''
                    });
                }

                pages.push({
                    number: totalPages,
                    isActive: false,
                    isEllipsis: false,
                    cssClass: 'pagination-button'
                });
            }
        }

        return pages;
    }

    get hasFiles() {
        return this.files && this.files.length > 0;
    }

    get hasLocationProcesses() {
        return this.locationProcesses && this.locationProcesses.length > 0;
    }

    connectedCallback() {
        this.checkUserPermissions();
    }

    // Check user permissions
    async checkUserPermissions() {
        const permissionSetsToCheck = ['FR_Admin'];
                
        checkPermissionSetsAssigned({ psNames: permissionSetsToCheck })
            .then(result => {
                const assignedMap = result.assignedMap || {};
                const isAdmin = result.isAdmin || false;
                
                const hasFRAdmin = assignedMap['FR_Admin'] || false;
                
                if (isAdmin || hasFRAdmin) {
                    this.hasAccess = true;
                    this.fetchDashboardData();
                } else {
                    this.hasAccess = false;
                    this.accessErrorMessage = "You don't have permission to access this page. Please contact your system administrator to request the FR Admin permission set.";
                    this.isLoading = false;
                }
            })
            .catch(error => {
                this.hasAccess = false;
                this.accessErrorMessage = 'An error occurred while checking permissions. Please try again or contact your system administrator.';
                console.error('Error checking permissions:', error);
                this.isLoading = false;
            });
    }

    // Fetch dashboard data
    fetchDashboardData() {
        if (!this.hasAccess) {
            return;
        }
        this.isLoading = true;
        getShiftEndLogDashboardData()
            .then(result => {
                // Format dates on initial load - prefer ISO timestamp if provided by Apex
                const entriesWithFormattedDates = (result.logEntries || []).map(log => ({
                    ...log,
                    createdDateRaw: log.createdDateISO || log.createdDate, // raw ISO string for filtering
                    createdDate: log.createdDateISO ? this.formatToAMPM(log.createdDateISO) : (log.createdDate ? this.formatToAMPM(log.createdDate) : '--'),
                    approvedDate: log.approvedDateISO ? this.formatToAMPM(log.approvedDateISO) : (log.approvedDate ? this.formatToAMPM(log.approvedDate) : null)
                }));
                this.allLogEntries = entriesWithFormattedDates;
                this.logEntries = [...this.allLogEntries];
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
        this.applyFilters();
    }

    // Handle status filter change
    handleStatusFilterChange(event) {
        this.selectedStatus = event.detail.value;
        this.applyFilters();
    }

    // Handle search
    handleSearch(event) {
        this.searchTerm = event.target.value ? event.target.value.trim().toLowerCase() : '';
        this.applyFilters();
    }

    // Apply filters
    applyFilters() {
        let filtered = [...this.allLogEntries];

        // Apply date filter
        if (this.selectedDateFilter !== 'alltime') {
            const today = new Date();
            let daysToSubtract = 30; // default

            if (this.selectedDateFilter === 'last7days') {
                daysToSubtract = 7;
            } else if (this.selectedDateFilter === 'last15days') {
                daysToSubtract = 15;
            } else if (this.selectedDateFilter === 'last30days') {
                daysToSubtract = 30;
            }

            const filterDate = new Date(today.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));

            filtered = filtered.filter(log => {
                // Use raw ISO date for comparison
                if (log.createdDateRaw) {
                    const logDate = new Date(log.createdDateRaw);
                    return logDate >= filterDate;
                }
                return true;
            });
        }

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

        // Add status class to each log (dates already formatted in fetchDashboardData)
        this.filteredLogEntries = filtered.map((log) => ({
            ...log,
            statusClass: this.getStatusClass(log.status)
        }));

        // Reset to first page when filters change
        this.currentPage = 1;

        // Update shown data for current page
        this.updateShownData();

        // Update KPIs based on filtered data
        this.updateKPIs(this.filteredLogEntries);
    }

    // Parse created date string to Date object
    parseCreatedDate(dateString) {
        // Format: "MMM dd, yyyy HH:mm" (e.g., "Nov 25, 2025 14:30")
        try {
            const parts = dateString.split(' ');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = monthNames.indexOf(parts[0]);
            const day = parseInt(parts[1].replace(',', ''));
            const year = parseInt(parts[2]);
            const timeParts = parts[3].split(':');
            const hours = parseInt(timeParts[0]);
            const minutes = parseInt(timeParts[1]);

            return new Date(year, month, day, hours, minutes);
        } catch (e) {
            return new Date();
        }
    }

    /**
     * Method Name: formatToAMPM
     * @description: Formats ISO datetime string to 12-hour AM/PM format in user's local timezone
     * Automatically converts from UTC (Salesforce storage) to browser's local timezone
     * @param iso: ISO datetime string from Salesforce (in UTC)
     * @return: Formatted string like "Nov 26, 2025, 11:51 AM" in user's local timezone
     */
    formatToAMPM(iso) {
        try {
            if (!iso) return '--';

            // Create Date object from ISO string - this automatically converts UTC to local timezone
            const date = new Date(iso);

            // Check if date is valid
            if (isNaN(date.getTime())) {
                console.error('formatToAMPM: Invalid date string:', iso);
                return '--';
            }

            // Get date components in user's local timezone
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = monthNames[date.getMonth()];
            const day = date.getDate();
            const year = date.getFullYear();

            // Get time components in user's local timezone
            let hours = date.getHours();
            const minutes = String(date.getMinutes()).padStart(2, '0');

            // Determine AM/PM
            const ampm = hours >= 12 ? 'PM' : 'AM';

            // Convert to 12-hour format
            hours = hours % 12;
            hours = hours ? hours : 12; // hour '0' should be '12'

            // Pad hours with leading zero if needed
            const paddedHours = String(hours).padStart(2, '0');

            // Format: "Nov 26, 2025, 11:51 AM" (in user's local timezone)
            return `${monthName} ${day}, ${year}, ${paddedHours}:${minutes} ${ampm}`;
        } catch (error) {
            console.error('Error in formatToAMPM:', error, 'Input:', iso);
            return '--';
        }
    }

    // Update KPIs based on filtered entries
    updateKPIs(entries) {
        this.dashboardData = {
            totalLogs: entries.length,
            pendingLogs: entries.filter(log => log.status === 'Pending').length,
            approvedLogs: entries.filter(log => log.status === 'Approved').length,
            autoApprovedLogs: entries.filter(log => log.status === 'Auto-Approved').length,
            rejectedLogs: entries.filter(log => log.status === 'Rejected').length
        };
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
                        const oldValue = parseFloat(lp.oldValue || 0);
                        const newValue = parseFloat(lp.newValue || 0);
                        const todayProgress = Math.max(0, newValue - oldValue);
                        const remainingProgress = Math.max(0, 100 - newValue);

                        return {
                            id: lp.id,
                            name: lp.name,
                            oldValue: oldValue.toFixed(1),
                            newValue: newValue.toFixed(1),
                            todayProgress: todayProgress.toFixed(1),
                            remainingProgress: remainingProgress.toFixed(1),
                            completedStyle: `width: ${oldValue}%`,
                            todayStyle: `width: ${todayProgress}%`,
                            remainingStyle: `width: ${remainingProgress}%`
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
        switch (status) {
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

    /**
     * Method Name: updateShownData
     * @description: Update shownLogEntries for current page
     */
    updateShownData() {
        try {
            if (!this.filteredLogEntries || this.filteredLogEntries.length === 0) {
                this.shownLogEntries = [];
                return;
            }

            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = startIndex + this.pageSize;
            const pageData = this.filteredLogEntries.slice(startIndex, endIndex);

            // Add serial numbers based on current page
            this.shownLogEntries = pageData.map((log, index) => ({
                ...log,
                serialNumber: startIndex + index + 1
            }));
        } catch (error) {
            console.error('Error updating shown data:', error);
        }
    }

    /**
     * Method Name: handlePrevious
     * @description: Navigate to previous page
     */
    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage -= 1;
            this.updateShownData();
        }
    }

    /**
     * Method Name: handleNext
     * @description: Navigate to next page
     */
    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage += 1;
            this.updateShownData();
        }
    }

    /**
     * Method Name: handlePageChange
     * @description: Navigate to selected page number
     */
    handlePageChange(event) {
        const selectedPage = parseInt(event.target.dataset.page, 10);
        if (selectedPage && selectedPage !== this.currentPage) {
            this.currentPage = selectedPage;
            this.updateShownData();
        }
    }
}