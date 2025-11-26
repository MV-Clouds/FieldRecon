import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getJobRelatedMoblizationDetails from '@salesforce/apex/JobDetailsPageController.getJobRelatedMoblizationDetails';
import getTimeSheetEntryItems from '@salesforce/apex/JobDetailsPageController.getTimeSheetEntryItems';
import getMobilizationMembersWithStatus from '@salesforce/apex/JobDetailsPageController.getMobilizationMembersWithStatus';
import createTimesheetRecords from '@salesforce/apex/JobDetailsPageController.createTimesheetRecords';
import getContactsAndCostcode from '@salesforce/apex/JobDetailsPageController.getContactsAndCostcode';
import createManualTimesheetRecords from '@salesforce/apex/JobDetailsPageController.createManualTimesheetRecords';
import deleteTimesheetEntry from '@salesforce/apex/JobDetailsPageController.deleteTimesheetEntry';
import checkPermissionSetsAssigned from '@salesforce/apex/PermissionsUtility.checkPermissionSetsAssigned';
import deleteTimesheetEntriesBulk from '@salesforce/apex/JobDetailsPageController.deleteTimesheetEntriesBulk';
import saveTimesheetEntryInlineEdits from '@salesforce/apex/JobDetailsPageController.saveTimesheetEntryInlineEdits';

export default class JobDetailsPage extends NavigationMixin(LightningElement) {
    @track jobDetailsRaw;
    @track filteredJobDetailsRaw;
    @track isLoading = true;
    @track hasAccess = false;
    @track accessErrorMessage = 'You don\'t have permission to access this.';
    @track selectedDate;
    @track viewMode = 'day';
    @track weekStart;
    @track weekEnd;
    @track searchTerm;
    @track customStartDate;
    @track customEndDate;
    @track showClockInOutModal = false;
    @track showTimesheetModal = false;
    @track jobId;
    @track mobId;
    @track activeTab = 'clockin';
    @track clockInList = [];
    @track clockOutList = [];
    @track clockInOptions = [];
    @track clockOutOptions = [];
    @track costCodeOptions = [];
    @track selectedContactId;
    @track isSelectedContactClockedIn = false;
    @track previousClockInTime;
    @track selectedCostCodeId;
    @track defaultStartTime;
    @track clockInTime;
    @track defaultEndTime;
    @track clockOutTime;
    @track manualTimesheetEntry = false;
    @track editTimesheetEntry = false;
    @track showDeleteConfirmModal = false;
    @track selectedTimesheetEntryLineId;
    @track editableTimesheetEntry = {};
    @track allContacts = [];
    @track selectedManualPersonId;
    @track enteredManualTravelTime = 0.00;
    @track enteredManualPerDiem = 0;
    defaultDate = new Date().toISOString();
    @track timesheetDetailsRaw = [];
    @track currentJobStartDateTime;
    @track currentJobEndDateTime;
    @track expandedJobs = new Set(); // Track which jobs have expanded timesheet rows
    @track timesheetDataMap = new Map(); // Map of mobId to timesheet details
    
    // New properties for inline editing and bulk delete
    @track modifiedTimesheetEntries = new Map(); // Map<id, {mobId: mobId, modifications: {key: value, ...}}>
    @track hasTimesheetModifications = false;
    @track isSavingTimesheetEntries = false;
    @track editingTimesheetCells = new Set(); // Set of "id-fieldName" strings
    @track selectedTimesheets = new Map(); // Map<mobId, Set<TSELId>>
    @track deleteConfirmationAction = '';
    @track deleteConfirmationTitle = '';
    @track deleteConfirmationMessage = '';
    @track deleteTargetMobId = '';
    
    @track jobColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { label: 'Actions', fieldName: 'actions', style: 'width: 6rem' },
        { 
            label: 'Job Number', 
            fieldName: 'jobNumber',
            isLink: true,
            recordIdField: 'jobId', 
            style: 'width: 8rem'
        },
        { label: 'Job Name', fieldName: 'jobName', style: 'width: 15rem' },
        { label: 'Start Date Time', fieldName: 'startDate', style: 'width: 12rem' },
        { label: 'End Date Time', fieldName: 'endDate', style: 'width: 12rem' },
        { label: 'Total Man Hours', fieldName: 'totalManHours', style: 'width: 10rem' },
        { label: 'Total Hours + Travel', fieldName: 'totalHoursWithTravel', style: 'width: 12rem' },
        { label: 'Job Address', fieldName: 'jobAddress', style: 'width: 15rem' },
        { label: 'Description', fieldName: 'jobDescription', style: 'width: 15rem' }
    ];

    // Timesheet columns adapted for inline editing/display
    @track timesheetColumns = [
        { label: 'Full Name', fieldName: 'contactName', type: 'text', editable: false, style: 'width: 6rem' },
        { label: 'Clock In Time', fieldName: 'clockInTime', type: 'datetime', editable: true, style: 'width: 6rem' },
        { label: 'Clock Out Time', fieldName: 'clockOutTime', type: 'datetime', editable: true, style: 'width: 6rem' },
        { label: 'Work Hours', fieldName: 'workHours', type: 'number', editable: false, style: 'width: 6rem' },
        { label: 'Travel Time', fieldName: 'travelTime', type: 'number', editable: true, min: 0.00, step: 0.01, style: 'width: 6rem' },
        { label: 'Total Time', fieldName: 'totalTime', type: 'number', editable: false, style: 'width: 6rem' },
        { label: 'Per Diem', fieldName: 'perDiem', type: 'boolean', editable: true, style: 'width: 6rem' },
        { label: 'Premium', fieldName: 'premium', type: 'boolean', editable: true, style: 'width: 6rem' },
        { label: 'Cost Code', fieldName: 'costCodeName', type: 'text', editable: false, style: 'width: 6rem' }
    ];

    // --- Utility Getters ---

    get formattedSelectedDate() {
        try {
            if (this.viewMode === 'day') {
                const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                return this.selectedDate ? this.selectedDate.toLocaleDateString('en-US', options) : '';
            } else {
                return `${this.weekStart.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })} - 
                        ${this.weekEnd.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}`;
            }
        } catch (error) {
            console.error('Error in formattedSelectedDate ::', error);
            return '';
        }
    }

    /**
     * Method Name: formattedSelectedDate
     * @description: Gets the formatted date string for the header based on view mode.
     */
    get apexFormattedDate() {
        return this.selectedDate.toISOString().split('T')[0];
    }

    /** 
    * Method Name: jobDetails 
    * @description: This method processes raw job details and formats them for display in the UI.
    */
    get jobDetails() {
        try {
            if (!this.filteredJobDetailsRaw) {
                return [];
            }

            return this.filteredJobDetailsRaw.map((job, index) => {
                const mobId = job.mobId;
                const timesheetData = this.getTimesheetDataForJobDisplay(mobId);
                const selectedCount = this.selectedTimesheets.get(mobId)?.size || 0;

                const modifications = this.modifiedTimesheetEntriesForJob(mobId);
                const modificationCount = modifications.size;
                const totalTimesheets = timesheetData.length;
                
                return {
                    key: mobId,
                    jobId: job.jobId,
                    mobId: mobId,
                    isExpanded: this.expandedJobs.has(mobId),
                    timesheetData: timesheetData,
                    selectedCount: selectedCount,
                    isSaveDisabled: !this.hasTimesheetModificationsForJob(mobId) || this.isSavingTimesheetEntries,
                    isDeleteDisabled: selectedCount === 0 || this.isSavingTimesheetEntries,
                    saveButtonLabel: this.getTimesheetSaveButtonLabel(mobId),
                    discardButtonTitle: this.getTimesheetDiscardButtonTitle(mobId),
                    isAllSelected: totalTimesheets > 0 && selectedCount === totalTimesheets,
                    values: this.jobColumns.map(col => {
                        let cell = { 
                            key: col.fieldName, 
                            value: '--', 
                            recordLink: null, 
                            isActions: false, 
                            style: col.style 
                        };

                        if (col.fieldName === 'srNo') {
                            cell.value = index + 1;
                        } else if (col.fieldName === 'actions') {
                            cell.isActions = true; 
                        } else {
                            cell.value = job[col.fieldName] || '';
                            if (col.isLink && col.recordIdField) {
                                cell.recordLink = `/${job.jobId}`; // Use jobId for link navigation
                            }
                        }

                        if (col.fieldName === 'startDate' || col.fieldName === 'endDate') {
                            cell.value = this.formatToAMPM(cell.value);
                        }

                        if (col.fieldName === 'totalManHours') {
                            cell.value = job.totalManHours?.toFixed(2) || '0.00';
                        }

                        if (col.fieldName === 'totalHoursWithTravel') {
                            cell.value = job.totalHoursWithTravel?.toFixed(2) || '0.00';
                        }

                        return cell;
                    })
                };
            });
        } catch (error) {
            console.error('Error in jobDetails ::', error);
            return [];
        }
    }
    	
    /**
     * Method Name: getTimesheetDiscardButtonTitle
     * @description: Gets the dynamic tooltip for the Discard Changes button.
     */
    getTimesheetDiscardButtonTitle(mobId) {
        const modifications = this.modifiedTimesheetEntriesForJob(mobId);
        const count = modifications.size;
        if (count === 0) {
            return 'No timesheet changes to discard';
        }
        return `Discard ${count} unsaved change${count === 1 ? '' : 's'}`;
    
    }
    
    /** 
    * Method Name: getTimesheetDataForJobDisplay 
    * @description: Processes the raw timesheet data for display in the nested table with inline edit state.
    */
    getTimesheetDataForJobDisplay(mobId) {
        const rawTimesheets = this.timesheetDataMap.get(mobId) || [];
        const selectedIds = this.selectedTimesheets.get(mobId) || new Set();
        
        return rawTimesheets.map((ts, index) => {
            const displayEntry = {
                ...ts,
                srNo: index + 1,
                isSelected: selectedIds.has(ts.id),
                displayFields: this.timesheetColumns.map(col => {
                    const fieldName = col.fieldName;
                    const cellKey = `${ts.id}-${fieldName}`;
                    
                    let originalValue = ts[fieldName];
                    let value = originalValue; // Start with original value
                    let isModified = false;

                    // Ensure original value is standardized for comparison
                    if (col.type === 'number' || col.type === 'currency') {
                        originalValue = originalValue !== null && originalValue !== undefined ? Number(originalValue) : null;
                    } else if (col.type === 'boolean') {
                        originalValue = !!originalValue;
                    }

                    // Check for modification in the Map
                    const modification = this.modifiedTimesheetEntries.get(ts.id)?.modifications;
                    if (modification && modification.hasOwnProperty(fieldName)) {
                        value = modification[fieldName];
                        isModified = true;
                    }
                    
                    const isEditing = this.editingTimesheetCells.has(cellKey);
                    
                    let cellClass = 'center-trancate-text';
                    if (col.editable) cellClass += ' editable-cell';
                    if (isModified) cellClass += ' modified-process-cell';
                    if (isEditing) cellClass += ' editing-cell';
                    
                    let displayValue = String(value || '');

                    // Formatting for display and editing inputs
                    const isDatetime = col.type === 'datetime';
                    const isNumber = col.type === 'number';
                    const isBoolean = col.type === 'boolean';
                    const isText = col.type === 'text';
                    const isCurrency = col.type === 'currency';

                    if (isDatetime) {
                        displayValue = value ? this.formatToAMPM(value) : '--';
                    } else if (isBoolean) {
                        displayValue = value ? 'Yes' : 'No';
                        value = !!value; // Ensure boolean value
                    } else if (isNumber || isCurrency) {
                        // Display value formatted to 2 decimals for raw display only (lightning-formatted-number handles this)
                        // Original value stored in rawValue
                        displayValue = value !== null && value !== undefined ? Number(value).toFixed(2) : '0.00';
                        value = value !== null && value !== undefined ? Number(value) : null; // Raw value is numerical/null
                    } else if (isText) {
                        displayValue = value || '--';
                    }

                    // For editing inputs, datetime needs ISO format (YYYY-MM-DDThh:mm)
                    const datetimeValue = isDatetime && value ? this.formatToDatetimeLocal(value) : null;
                    
                    // Boundaries for datetime fields
                    let minBoundary = null;
                    let maxBoundary = null;
                    if (isDatetime) {
                        minBoundary = this.getDatetimeMinBoundary(ts, fieldName);
                        maxBoundary = this.getDatetimeMaxBoundary(ts, fieldName);
                    }
                    
                    // Fields are editable only if the user has permission (assumed true if this component loads)
                    const isEditable = col.editable;

                    return {
                        key: fieldName,
                        displayValue: displayValue,
                        rawValue: value, // Send numerical/boolean/string value to lightning components/inputs
                        datetimeValue: datetimeValue,
                        isEditing: isEditing,
                        isEditable: isEditable,
                        isModified: isModified,
                        cellClass: cellClass,
                        contentClass: 'editable-content',
                        isDatetime: isDatetime,
                        isNumber: isNumber,
                        isBoolean: isBoolean,
                        isText: isText,
                        isCurrency: isCurrency,
                        step: col.step,
                        min: col.min,
                        max: col.max,
                        minBoundary: minBoundary,
                        maxBoundary: maxBoundary,
                    };
                })
            };
            
            return displayEntry;
        });
    }

    /** 
    * Method Name: getDatetimeMinBoundary 
    * @description: Calculates the minimum boundary for Clock In/Out date time pickers for inline editing.
    */
    getDatetimeMinBoundary(ts, fieldName) {
        const jobRecord = this.getCurrentJobRecord();
        const jobStartReference = jobRecord?.startDate || this.currentJobStartDateTime;
        
        // Clock In min boundary is job start date
        if (fieldName === 'clockInTime') {
            const dateKey = this.extractDateKey(jobStartReference);
            return dateKey ? `${dateKey}T00:00` : null;
        } 
        // Clock Out min boundary is Clock In time
        else if (fieldName === 'clockOutTime') {
            const clockIn = ts.clockInTime;
            const modifiedClockIn = this.modifiedTimesheetEntries.get(ts.id)?.modifications.clockInTime;
            const referenceTime = modifiedClockIn || clockIn;
            
            // Cannot clock out before clock in time
            return referenceTime ? this.formatToDatetimeLocal(referenceTime) : null;
        }
        return null;
    }

    /** 
    * Method Name: getDatetimeMaxBoundary 
    * @description: Calculates the maximum boundary for Clock In/Out date time pickers for inline editing.
    */
    getDatetimeMaxBoundary(ts, fieldName) {
        const jobRecord = this.getCurrentJobRecord();
        const jobEndReference = jobRecord?.endDate || this.currentJobEndDateTime;
        
        // Clock In max boundary is job end date
        if (fieldName === 'clockInTime') {
            const dateKey = this.extractDateKey(jobEndReference);
            return dateKey ? `${dateKey}T23:59` : null;
        } 
        // Clock Out max boundary is day after job end date
        else if (fieldName === 'clockOutTime') {
            const dateKey = this.extractDateKey(jobEndReference);
            if (!dateKey) return null;
            
            const nextDay = this.addDaysToDateKey(dateKey, 1);
            return nextDay ? `${nextDay}T23:59` : null;
        }
        return null;
    }

    /** 
    * Method Name: formatToDatetimeLocal
    * @description: Formats ISO datetime string to YYYY-MM-DDThh:mm format for input type="datetime-local"
    */
    formatToDatetimeLocal(iso) {
        if (!iso) return '';
        try {
            const date = new Date(iso);
            if (isNaN(date.getTime())) return '';

            // Ensure the local time offset is corrected before formatting (client-side adjustment)
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');

            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (error) {
            console.error('Error in formatToDatetimeLocal:', error);
            return iso;
        }
    }

    /** * Method Name: getTimesheetSaveButtonLabel
    * @description: Gets the dynamic label for the timesheet save button.
    */
    getTimesheetSaveButtonLabel(mobId) {
        const modifications = this.modifiedTimesheetEntriesForJob(mobId);
        if (this.isSavingTimesheetEntries) {
            return 'Saving...';
        }
        if (modifications.size > 0) {
            return `Save Changes (${modifications.size})`;
        }
        return 'Save Changes';
    }

    /**
     * Method Name: modifiedTimesheetEntriesForJob
     * @description: Filters modified entries for a specific job/mobilization.
     */
    modifiedTimesheetEntriesForJob(mobId) {
        const entries = new Map();
        this.modifiedTimesheetEntries.forEach((value, key) => {
            if (value.mobId === mobId) {
                entries.set(key, value);
            }
        });
        return entries;
    }

    /**
     * Method Name: hasTimesheetModificationsForJob
     * @description: Checks if a specific job/mobilization has any timesheet modifications.
     */
    hasTimesheetModificationsForJob(mobId) {
        return this.modifiedTimesheetEntriesForJob(mobId).size > 0;
    }

    get clockInTabClass() {
        return this.activeTab === 'clockin' ? 'active' : '';
    }
    
    get clockOutTabClass() {
        return this.activeTab === 'clockout' ? 'active' : '';
    }
    
    get isClockInActive(){
        return this.activeTab === 'clockin';
    }
    
    get isClockOutActive(){
        return this.activeTab === 'clockout';
    }

    get isCustomView() {
        return this.viewMode == 'custom';
    }

    get dayClass() {
        return this.viewMode === 'day' ? 'tab-nav-btn header-tab-nav-btn active' : 'tab-nav-btn header-tab-nav-btn';
    }

    get weekClass() {
        return this.viewMode === 'week' ? 'tab-nav-btn header-tab-nav-btn active' : 'tab-nav-btn header-tab-nav-btn border-inline-nav-btn';
    }

    get customClass() {
        return this.viewMode === 'custom' ? 'tab-nav-btn header-tab-nav-btn active' : 'tab-nav-btn header-tab-nav-btn';
    }

    // New delete confirmation properties
    get isTimesheetBulkDelete() {
        return this.deleteConfirmationAction === 'bulkDeleteTimesheets';
    }

    get clockInMinBoundary() {
        const jobRecord = this.getCurrentJobRecord();
        const reference = this.currentJobStartDateTime
            || jobRecord?.startDate
            || (this.clockInList && this.clockInList.length > 0 ? this.clockInList[0].jobStartTime : null)
            || this.defaultStartTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T00:00` : null;
    }

    get clockInMaxBoundary() {
        const jobRecord = this.getCurrentJobRecord();
        const reference = this.currentJobEndDateTime
            || jobRecord?.endDate
            || (this.clockInList && this.clockInList.length > 0 ? this.clockInList[0].jobEndTime : null)
            || this.defaultEndTime
            || this.defaultStartTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T23:59` : null;
    }

    get clockOutMinBoundary() {
        const jobRecord = this.getCurrentJobRecord();
        const reference = this.currentJobStartDateTime
            || jobRecord?.startDate
            || (this.clockOutList && this.clockOutList.length > 0 ? this.clockOutList[0].jobStartTime : null)
            || this.defaultStartTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T00:00` : null;
    }

    get clockOutMaxBoundary() {
        const jobRecord = this.getCurrentJobRecord();
        const reference = this.currentJobEndDateTime
            || jobRecord?.endDate
            || (this.clockOutList && this.clockOutList.length > 0 ? this.clockOutList[0].jobEndTime : null)
            || this.defaultEndTime
            || this.defaultStartTime;
        const dateKey = this.extractDateKey(reference);
        if (!dateKey) {
            return null;
        }
        const nextDay = this.addDaysToDateKey(dateKey, 1);
        const boundaryKey = nextDay || dateKey;
        return `${boundaryKey}T23:59`;
    }
    
    // --- Lifecycle and Initialization ---

    /** * Method Name: connectedCallback 
    * @description: This method is called when the component is connected to the DOM.
    */
    connectedCallback() {
        try {
            this.selectedDate = new Date();
            this.checkUserPermissions();
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in connectedCallback ::', error);
        }
    }

    /**
     * Method Name: checkUserPermissions
     * @description: Check user permissions based on permission sets
     */
    checkUserPermissions() {
        try {
            this.isLoading = true;
            const permissionSetsToCheck = ['FR_Admin'];
            
            checkPermissionSetsAssigned({ psNames: permissionSetsToCheck })
            .then(result => {
                if (result.error) {
                    console.error('Error checking permission sets:', result.error);
                    this.hasAccess = false;
                    this.accessErrorMessage = 'Unable to verify permissions. Please contact your system administrator.';
                    return;
                }

                console.log('Permission check result ==> ', result);
                
                const assignedMap = result.assignedMap || {};
                const isAdmin = result.isAdmin || false;
                const hasFRAdmin = assignedMap['FR_Admin'] || false;

                if (isAdmin || hasFRAdmin) {
                    this.hasAccess = true;
                    this.getJobRelatedMoblizationDetails();
                } else {
                    this.hasAccess = false;
                    this.accessErrorMessage = "You don't have permission to access this module. Please contact your system administrator to request access.";
                }
            })
            .catch(error => {
                console.error('Error in checkUserPermissions:', error);
                this.hasAccess = false;
                this.accessErrorMessage = 'Unable to verify permissions. Please contact your system administrator.';
            })
            .finally(() => {
                this.isLoading = false;
            });
        } catch (error) {
            console.error('Error in outer block:', error);
            this.hasAccess = false;
            this.accessErrorMessage = 'Unable to verify permissions. Please contact your system administrator.';
            this.isLoading = false;
        }
    }

    // --- Data Fetching and Formatting ---

    /** * Method Name: formatToAMPM
    * @description: Formats ISO datetime string to 12-hour AM/PM format for display (e.g., "Nov 12, 2025, 03:45 PM")
    */
    formatToAMPM(iso) {
        if (!iso) return '';
        try {
            const date = new Date(iso);
            if (isNaN(date.getTime())) return iso;
            
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = monthNames[date.getMonth()];
            
            let hours = date.getHours();
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            
            const paddedHours = String(hours).padStart(2, '0');
            
            return `${monthName} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}, ${paddedHours}:${minutes} ${ampm}`;
        } catch (error) {
            console.error('Error in formatToAMPM:', error);
            return iso;
        }
    }

    extractDateKey(value) {
        if (!value) {
            return null;
        }

        if (value instanceof Date) {
            return value.toISOString().slice(0, 10);
        }

        const str = value.toString().trim();
        if (!str) {
            return null;
        }

        // Handle ISO string format 'YYYY-MM-DDTHH:mm:ss.sssZ' or 'YYYY-MM-DD HH:mm:ss'
        if (str.length >= 10) {
            return str.slice(0, 10);
        }

        return null;
    }

    addDaysToDateKey(dateKey, days) {
        if (!dateKey || typeof dateKey !== 'string') {
            return null;
        }

        const [year, month, day] = dateKey.split('-').map(Number);
        if ([year, month, day].some(num => Number.isNaN(num))) {
            return null;
        }

        const utcDate = new Date(Date.UTC(year, month - 1, day));
        utcDate.setUTCDate(utcDate.getUTCDate() + days);
        
        return utcDate.toISOString().slice(0, 10);
    }

    validateClockInDate (clockInValue, jobStartValue) {
        const clockInDate = this.extractDateKey(clockInValue);
        const jobStartDate = this.extractDateKey(jobStartValue);
        const jobEndDate = this.extractDateKey(jobEndValue);

        if (clockInDate && jobStartDate && clockInDate !== jobStartDate && clockInDate !== jobEndDate) {
            this.showToast('Error', 'Clock In time must be on the job start date or job end date', 'error');
            return false;
        }

        return true;
    }

    validateClockOutDate(clockOutValue, jobStartValue, jobEndValue) {
        const clockOutDate = this.extractDateKey(clockOutValue);
        const jobStartDate = this.extractDateKey(jobStartValue);
        const jobEndDate = this.extractDateKey(jobEndValue);

        if (clockOutDate && jobEndDate) {
            const nextDay = this.addDaysToDateKey(jobEndDate, 1);
            if (clockOutDate !== jobStartDate && clockOutDate !== jobEndDate && clockOutDate !== nextDay) {
                this.showToast('Error', 'Clock Out time must be on the job start date, job end date or the following day', 'error');
                return false;
            }
        }

        return true;
    }

    getCurrentJobRecord() {
        if (!this.jobId || !this.jobDetailsRaw || !Array.isArray(this.jobDetailsRaw)) {
            return null;
        }

        return this.jobDetailsRaw.find(job => job.jobId === this.jobId || job.mobId === this.mobId);
    }

    /** * Method Name: getJobRelatedMoblizationDetails 
    * @description: Method is used to get the job related mobilization details
    */
    getJobRelatedMoblizationDetails() {
        try {
            this.isLoading = true;
            
            getJobRelatedMoblizationDetails({ filterDate: this.apexFormattedDate, mode: this.viewMode, customStartDate: this.customStartDate, customEndDate: this.customEndDate })
                .then((data) => {
                    if(data != null) {
                        this.jobDetailsRaw = data;
                        this.filteredJobDetailsRaw = data;
                        
                        // Pre-load timesheet data for all jobs
                        this.preloadTimesheetData();
                    } else {
                        this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    }
                }).catch((error) => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error in getJobRelatedMoblizationDetails apex ::' ,error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in getJobRelatedMoblizationDetails ::', error);
            this.isLoading = false;
        }
    }

    /**
     * Method Name: preloadTimesheetData
     * @description: Pre-loads timesheet data for all jobs (like sovJobLocations pre-loads process data)
     */
    async preloadTimesheetData() {
        try {
            // Clear existing timesheet data and preserve expanded state
            const expandedIds = new Set(this.expandedJobs);
            this.timesheetDataMap = new Map();
            this.expandedJobs = new Set();
            
            if (!this.jobDetailsRaw || this.jobDetailsRaw.length === 0) {
                return;
            }

            // Load timesheet data for all jobs
            const loadPromises = this.jobDetailsRaw.map(job => {
                return this.loadTimesheetDataForJob(job);
            });

            await Promise.all(loadPromises);
            
            // Restore expanded state and trigger display update
            this.expandedJobs = expandedIds;
            this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw];
            
        } catch (error) {
            console.error('Error in preloadTimesheetData:', error);
        }
    }

    /**
     * Method Name: loadTimesheetDataForJob
     * @description: Loads timesheet data for a specific job
     */
    async loadTimesheetDataForJob(job) {
        try {
            const mobId = job.mobId;
            const jobId = job.jobId;
            // Use the job's date range, not the filter range
            const jobStartDate = this.extractDateKey(job.startDate);
            const jobEndDate = this.extractDateKey(job.endDate);
            
            const data = await getTimeSheetEntryItems({ 
                jobId: jobId, 
                jobStartDate: jobStartDate, 
                jobEndDate: jobEndDate 
            });
            
            if (data && data.length > 0) {
                const formattedData = data.map((item, index) => ({
                    // Keep original TSEL fields for reference/editing
                    ...item,
                    srNo: index + 1,
                    // Ensure values are numerical for calculation consistency
                    workHours: item.workHours !== null ? Number(item.workHours) : 0.00,
                    travelTime: item.travelTime !== null ? Number(item.travelTime) : 0.00,
                    perDiem: item.perDiem !== null ? Number(item.perDiem) : 0,
                    totalTime: item.totalTime !== null ? Number(item.totalTime) + (item.travelTime !== null ? Number(item.travelTime) : 0) : 0.00
                }));
                this.timesheetDataMap.set(mobId, formattedData);
            } else {
                // Set empty array for jobs with no timesheet entries
                this.timesheetDataMap.set(mobId, []);
            }
        } catch (error) {
            console.error('Error loading timesheet data for job:', job, error);
            // Set empty array on error
            this.timesheetDataMap.set(job.mobId, []);
        }
    }

    /** * Method Name: getClockInDetails 
    * @description: Method is used to get the clock in details
    */
    getClockInDetails() {
        try {
            this.showClockInOutModal = true;
            this.isLoading = true;
            
            getMobilizationMembersWithStatus({ mobId: this.mobId})
                .then(result => {
                    if(result != null) {
                        
                        this.clockInList = result.clockIn;
    
                        this.clockInOptions = this.clockInList.map(person => ({
                            label: person.contactName,
                            value: person.contactId
                        }));
    
                        if (this.clockInList.length > 0) {
                            this.defaultStartTime = result.clockIn[0].jobStartTime.slice(0, 16);
                        } else {
                            this.defaultStartTime = new Date().toISOString().slice(0, 16);
                        }
                        this.clockInTime = this.defaultStartTime;
    
                        if(result.costCodeDetails.length > 0) {
                            const costCodeMap = result.costCodeDetails[0].costCodeDetails; // this is an object
                            this.costCodeOptions = Object.keys(costCodeMap).map(key => ({
                                label: costCodeMap[key], // the name
                                value: key               // the id
                            }));
                        }
                    } else {
                        this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    }
                })
                .catch(error => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error fetching data getMobilizationMembersWithStatus apex :: ', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in getClockInDetails ::', error);
            this.isLoading = false;
        }
    }

    /**
     * Method Name: toggleTimesheetView
     * @description: Toggle the timesheet inner table view (data is pre-loaded) and applies inline edit state.
     */
    toggleTimesheetView(mobId) {
        if (this.expandedJobs.has(mobId)) {
            this.expandedJobs.delete(mobId);
        } else {
            this.expandedJobs.add(mobId);
            // Ensure timesheet data is loaded/refreshed
            this.loadTimesheetData(mobId);
        }
        // Trigger re-render
        this.expandedJobs = new Set(this.expandedJobs);
        this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw]; // Force jobDetails getter to re-run
    }

    /**
     * Method Name: loadTimesheetData
     * @description: Refresh timesheet data for a specific job (used after CRUD operations)
     */
    async loadTimesheetData(mobId) {
        try {
            this.isLoading = true;
            
            // Find the job object from jobDetailsRaw
            const job = this.jobDetailsRaw?.find(j => j.mobId === mobId);
            if (job) {
                await this.loadTimesheetDataForJob(job);
                this.timesheetDataMap = new Map(this.timesheetDataMap);
            }
        } catch (error) {
            console.error('Error in loadTimesheetData:', error);
        } finally {
            this.isLoading = false;
            this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw]; // Final refresh
        }
    }

    /** * Method Name: handleSearch 
    * @description: Method is used to handle the search
    */
    handleSearch(event) {
        try {
            this.searchTerm = event.target.value;
            const searchKey = event.target.value.trim().toLowerCase();
    
            if (!searchKey) {
                // If input is empty, show all
                this.filteredJobDetailsRaw = this.jobDetailsRaw;
                return;
            }
    
            this.filteredJobDetailsRaw = this.jobDetailsRaw.filter(job => {
                const jobNumber = job.jobNumber
                    ? job.jobNumber.toString().toLowerCase()
                    : '';
                const jobName = job.jobName
                    ? job.jobName.toString().toLowerCase()
                    : '';
    
                return jobNumber.includes(searchKey) || jobName.includes(searchKey);
            });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleSearch ::', error);
        }
    }

    /** * Method Name: handleLinkClick 
    * @description: Method is used to handle the link click
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

    /** * Method Name: handlePreviousDate 
    * @description: Method is used to handle the previous date
    */
    handlePreviousDate() {
        try {
            if (this.viewMode === 'day') {
                let dt = new Date(this.selectedDate);
                dt.setDate(dt.getDate() - 1);
                this.selectedDate = dt;
            } else {
                // move 1 week back
                this.selectedDate.setDate(this.selectedDate.getDate() - 7);
                this.calculateWeekRange();
            }
            this.getJobRelatedMoblizationDetails();
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handlePreviousDate ::', error);
        }
    }

    /** * Method Name: handleNextDate 
    * @description: Method is used to handle the next date
    */
    handleNextDate() {
        try {
            if (this.viewMode === 'day') {
                let dt = new Date(this.selectedDate);
                dt.setDate(dt.getDate() + 1);
                this.selectedDate = dt;
            } else {
                // move 1 week forward
                this.selectedDate.setDate(this.selectedDate.getDate() + 7);
                this.calculateWeekRange();
            }
            this.getJobRelatedMoblizationDetails();
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleNextDate ::', error);
        }
    }

    /** * Method Name: switchToDayView 
    * @description: Method is used to switch to day view
    */
    switchToDayView() {
        try {
            this.viewMode = 'day';
            this.selectedDate = new Date(); // reset to today
            this.customStartDate = null;
            this.customEndDate = null;
            this.getJobRelatedMoblizationDetails();
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in switchToDayView ::', error);
        }
    }

    /** * Method Name: switchToWeekView 
    * @description: Method is used to switch to week view
    */
    switchToWeekView() {
        try {
            this.viewMode = 'week';
            this.customStartDate = null;
            this.customEndDate = null;
            this.selectedDate = new Date();
            this.calculateWeekRange();
            this.getJobRelatedMoblizationDetails();
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in switchToWeekView ::', error);
        }
    }

    /** * Method Name: calculateWeekRange 
    * @description: Method is used to calculate the week range
    */
    calculateWeekRange() {
        try {
            let dt = new Date(this.selectedDate);
            let day = dt.getDay(); // 0=Sunday, 6=Saturday
            this.weekStart = new Date(dt);
            this.weekStart.setDate(dt.getDate() - day); // move back to Sunday
            this.weekEnd = new Date(this.weekStart);
            this.weekEnd.setDate(this.weekStart.getDate() + 6); // Saturday
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in calculateWeekRange ::', error);
        }
    }

    /** * Method Name: switchToCustomView 
    * @description: Method is used to switch to custom view
    */
    switchToCustomView() {
        try {
            this.viewMode = 'custom';
    
            // Get today's date
            const today = new Date();
    
            // Get day of week (0 = Sunday, 6 = Saturday)
            const day = today.getDay();
    
            // Calculate Sunday (start of week)
            const sunday = new Date(today);
            sunday.setDate(today.getDate() - day);
    
            // Calculate Saturday (end of week)
            const saturday = new Date(sunday);
            saturday.setDate(sunday.getDate() + 6);
    
            // Convert to yyyy-MM-dd (for <input type="date">)
            const toISODate = date => date.toISOString().split('T')[0];
    
            this.customStartDate = toISODate(sunday);
            this.customEndDate = toISODate(saturday);
    
            // Optionally trigger Apex call immediately with defaults
            this.getJobRelatedMoblizationDetails();
        } catch (error) {
            console.error('Error in switchToCustomView :: ', error);
        }
    }

    /** * Method Name: handleCustomDateChange 
    * @description: handle custom date filter change and call method to filter data
    */
    handleCustomDateChange(event) {
        const field = event.target.dataset.field;
        if (field === 'filterStart') {
            this.customStartDate = event.target.value;
        } else if (field === 'filterEnd') {
            this.customEndDate = event.target.value;
        }

        if(this.customStartDate && this.customEndDate) {
            // Wait 2 seconds before fetching data
            clearTimeout(this._dateChangeTimeout); // clear previous timer if any
            this._dateChangeTimeout = setTimeout(() => {
                this.getJobRelatedMoblizationDetails();
            }, 1000);
        }
    }

    /** * Method Name: handleActionClick 
    * @description: Method is used to handle the row action click
    */
    handleActionClick(event) {
        try {
            const jobId = event.currentTarget.dataset.job;
            const mobId = event.currentTarget.dataset.mobid;
            this.jobId = jobId;
            this.mobId = mobId;

            const jobRecord = this.getCurrentJobRecord();
            if (jobRecord) {
                this.currentJobStartDateTime = jobRecord.startDate;
                this.currentJobEndDateTime = jobRecord.endDate;
            }
            
            const actionType = event.currentTarget.dataset.action;
    
            if (actionType === 'clock') {
                this.getClockInDetails();
            } else if (actionType === 'list') {
                this.toggleTimesheetView(mobId);
            }
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleActionClick ::', error);
        }
    }

    /** * Method Name: handleClockInTab 
    * @description: Method is used to handle the clock in tab
    */
    handleClockInTab(){
        this.activeTab = 'clockin';
        this.selectedContactId = null;
        this.selectedCostCodeId = null;
        this.isSelectedContactClockedIn = false;
        this.clockInTime = this.defaultStartTime;
        this.clockOutTime = this.defaultEndTime;
        this.previousClockInTime = null;
        this.getClockInDetails();
    }

    /** * Method Name: handleClockIn 
    * @description: Method is used to handle the clock in action
    */
    handleClockIn() {
        try {
            if(!this.selectedContactId || !this.clockInTime || !this.selectedCostCodeId) {
                this.showToast('Error', 'Please fill value in all required the fields!', 'error');
                console.error('No contact/cost code/time selected');
                return;
            }

            this.isLoading = true;

            const selectedRecordDetails = this.clockInList.find(
                record => record.contactId === this.selectedContactId
            );

            if (!selectedRecordDetails) {
                this.showToast('Error', 'Unable to determine job details for the selected contact', 'error');
                this.isLoading = false;
                return;
            }

            const jobStartReference = selectedRecordDetails?.jobStartTime || this.currentJobStartDateTime;
            if (!this.validateClockInDate(this.clockInTime, jobStartReference)) {
                this.isLoading = false;
                return;
            }

            const params = {
                actionType: 'clockIn',
                jobId: this.jobId,
                mobId: this.mobId,
                contactId: this.selectedContactId,
                costCodeId: this.selectedCostCodeId,
                clockInTime: this.clockInTime,
                isTimeSheetNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetNull : true,
                timesheetId: selectedRecordDetails ? selectedRecordDetails?.timesheetId : null,
                isTimeSheetEntryNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetEntryNull : true,
                timesheetEntryId: selectedRecordDetails ? selectedRecordDetails?.timesheetEntryId : null,
                mobMemberId: selectedRecordDetails ? selectedRecordDetails?.mobMemberId : null,
            };
            
            createTimesheetRecords({ params: JSON.stringify(params)})
                .then(result => {
                    if(result == true) {
                        this.selectedContactId = null;
                        this.selectedCostCodeId = null;
                        this.template.querySelector('.custom-select-costcode').value = '';
                        this.isSelectedContactClockedIn = false;
                        this.clockInTime = this.defaultStartTime;
                        this.getClockInDetails();
                        this.showToast('Success', 'User Clocked In Successfully', 'success');
                    } else {
                        this.showToast('Error', 'Failed to Clock In User', 'error');
                    }
                })
                .catch(error => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error creating timesheet records createTimesheetRecords apex :: ', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleClockIn ::', error);
            this.isLoading = false;
        }
    }
    
    /** * Method Name: handleClockOutTab 
    * @description: Method is used to handle the clock out tab
    */
    handleClockOutTab(){
        this.activeTab = 'clockout';
        this.selectedContactId = null;
        this.selectedCostCodeId = null;
        this.isSelectedContactClockedIn = false;
        this.clockInTime = this.defaultStartTime;
        this.clockOutTime = this.defaultEndTime;
        this.previousClockInTime = null;
        this.getClockOutDetails();
    }

    /** * Method Name: getClockOutDetails 
    * @description: Method is used to get the clock out details
    */
    getClockOutDetails() {
        try {
            this.showClockInOutModal = true;
            this.isLoading = true;
            
            getMobilizationMembersWithStatus({ mobId: this.mobId})
                .then(result => {
                    
                    this.clockOutList = result.clockOut;
                    
                    // Clock Out list and options
                    this.clockOutList = result.clockOut.map(person => ({
                        ...person,
                        clockInTime: person.clockInTime, // Clock In time from Apex
                    }));
                    
                    this.clockOutOptions = this.clockOutList.map(person => ({
                        label: person.contactName,
                        value: person.contactId
                    }));

                    if (this.clockOutList.length > 0) {
                        this.defaultEndTime = result.clockOut[0].jobEndTime.slice(0, 16);
                    } else {
                        this.defaultEndTime = new Date().toISOString().slice(0, 16);
                    }
                    this.clockOutTime = this.defaultEndTime;
                })
                .catch(error => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error fetching data getMobilizationMembersWithStatus apex :: ', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in getClockInDetails ::', error);
            this.isLoading = false;
        }
    }

    /** * Method Name: handleClockOut 
    * @description: Method is used to handle the clock out action
    */
    handleClockOut() {
        try {
            if(!this.selectedContactId || !this.clockOutTime) {
                this.showToast('Error', 'Please fill value in all the required fields!', 'error');
                console.error('No contact/time selected');
                return;
            }
            
            const selectedRecordDetails = this.clockOutList.find(
                record => record.contactId === this.selectedContactId
            );

            if (!selectedRecordDetails) {
                this.showToast('Error', 'Unable to determine job details for the selected contact', 'error');
                return;
            }

            if(new Date(this.clockOutTime.replace(' ', 'T')) <= new Date(selectedRecordDetails.clockInTime.slice(0, 16).replace('T', ' '))) {
                this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
                return;
            }

            const jobEndReference = selectedRecordDetails?.jobEndTime || this.currentJobEndDateTime;
            const jobStartReference = selectedRecordDetails?.jobStartTime || this.currentJobStartDateTime;

            if (!this.validateClockOutDate(this.clockOutTime, jobStartReference, jobEndReference)) {
                return;
            }
            
            this.isLoading = true;

            const params = {
                actionType: 'clockOut',
                jobId: this.jobId,
                mobId: this.mobId,
                contactId: this.selectedContactId,
                clockInTime: selectedRecordDetails ? selectedRecordDetails?.clockInTime : this.clockInTime,
                clockOutTime: this.clockOutTime,
                isTimeSheetNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetNull : true,
                timesheetId: selectedRecordDetails ? selectedRecordDetails?.timesheetId : null,
                isTimeSheetEntryNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetEntryNull : true,
                timesheetEntryId: selectedRecordDetails ? selectedRecordDetails?.timesheetEntryId : null,
                mobMemberId: selectedRecordDetails ? selectedRecordDetails?.mobMemberId : null,
            };
            
            createTimesheetRecords({ params: JSON.stringify(params)})
                .then(result => {
                    if(result == true) {
                        this.selectedContactId = null;
                        this.previousClockInTime = null;
                        this.clockOutTime = this.defaultEndTime;
                        this.getClockOutDetails();
                        this.getJobRelatedMoblizationDetails();
                        this.showToast('Success', 'User Clocked Out Successfully', 'success');
                    } else {
                        this.showToast('Error', 'Failed to Clock Out User', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error creating timesheet records createTimesheetRecords apex :: ', error);
                    this.showToast('Error', 'Something went wrong. Please contact system admin' , 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleClockIn ::', error);
            this.isLoading = false;
        }
    }

    /** * Method Name: handleInputChange 
    * @description: Method is used to handle input field changes
    */
    handleInputChange(event) {
        try {
            let dataField = event.target.dataset.field;
            let value = event.target.value;
    
            if(dataField == 'costCode') {
                this.selectedCostCodeId = value;
            } else if(dataField == 'clockIn' || dataField == 'clockOut') {
                this.selectedContactId = value;
                this.clockInTime = this.defaultStartTime;
                this.clockOutTime = this.defaultEndTime;
        
                if(dataField == 'clockIn') {
                    const selectedContact = this.clockInList.find(
                        item => item.contactId === this.selectedContactId
                    );
            
                    if (selectedContact) {
                        this.isSelectedContactClockedIn = selectedContact.isAgain;  
                    } else {
                        this.isSelectedContactClockedIn = false; // default
                    }
                }
        
                if(dataField == 'clockOut') {
                    const selectedContact = this.clockOutList.find(
                        item => item.contactId === this.selectedContactId
                    );
            
                    if (selectedContact) {
                        this.previousClockInTime = this.formatToAMPM(selectedContact.clockInTime);  
                    }
                }
            } else if(dataField == 'manualContact') {
                this.selectedManualPersonId = value;
            } else if(dataField == 'TravelTime') {
                this.enteredManualTravelTime = value;
            } else if (dataField == 'PerDiem') {
                this.enteredManualPerDiem = value;
            } else if (dataField == 'clockInDateTime') {
                this.clockInTime = value;
            } else if (dataField == 'clockOutDateTime') {
                this.clockOutTime = value;
            }
        } catch (error) {
            console.error('Error in handleInputChange :: ', error);
        }
    }

    /** * Method Name: closeClockInOutModal 
    * @description: Method is used to close the clock in/out modal
    */
    closeClockInOutModal() {
        this.activeTab = 'clockin';
        this.showClockInOutModal = false;
        this.jobId = null;
        this.mobId = null;
        this.selectedContactId = null;
        this.selectedCostCodeId = null;
        this.clockInList = [];
        this.clockOutList = [];
        this.previousClockInTime = null;
        this.isSelectedContactClockedIn = false;
    }

    /** * Method Name: getJobRelatedTimesheetDetails 
    * @description: Method is used to get the job related timesheet details
    */
    getJobRelatedTimesheetDetails() {
        try {
            this.showTimesheetModal = true;
            this.isLoading = true;

            const jobRecord = this.getCurrentJobRecord();
            if (jobRecord) {
                this.currentJobStartDateTime = jobRecord.startDate;
                this.currentJobEndDateTime = jobRecord.endDate;
            } else {
                this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                return;
            }

            getTimeSheetEntryItems({ jobId: this.jobId, jobStartDate: this.currentJobStartDateTime.split('T')[0], jobEndDate: this.currentJobEndDateTime.split('T')[0] })
                .then((data) => {
                    if(data != null) {
                        this.timesheetDetailsRaw = data.map(item => {
                            return {
                                ...item,
                                id: item?.id,
                                travelTime: item?.travelTime != null ? parseFloat(item.travelTime) : 0.00,
                                perDiem: item?.perDiem != null ? item.perDiem : 0,
                                totalTime: item?.totalTime != null ? parseFloat(item.totalTime) + (item.travelTime != null ? parseFloat(item.travelTime) : 0) : 0.00
                            };
                        });
                    } else {
                        this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    }
                }).catch((error) => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error in getJobRelatedTimesheetDetails apex ::' ,error);
                })
                .finally(() => {
                    this.isLoading = false;
                    this.manualTimesheetEntry = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in getJobRelatedTimesheetDetails ::', error);
            this.isLoading = false;
        }
    }

    /** * Method Name: handleAddTimesheet 
    * @description: Method is used to handle the add timesheet action
    */
    handleAddTimesheet(event) {
        try {
            const jobId = event.currentTarget.dataset.job;
            const mobId = event.currentTarget.dataset.mobid;
            
            if (jobId) this.jobId = jobId;
            if (mobId) this.mobId = mobId;
            
            const jobRecord = this.getCurrentJobRecord();
            if (jobRecord) {
                this.currentJobStartDateTime = jobRecord.startDate;
                this.currentJobEndDateTime = jobRecord.endDate;
            }
            
            this.manualTimesheetEntry = true;
            this.isLoading = true;
    
            getContactsAndCostcode({})
                .then((data) => {
                    if(data != null) {
                        this.allContacts = data.contacts.map(contact => ({
                            label: contact.Name,
                            value: contact.Id
                        }));
    
                        this.costCodeOptions = data.costCodes.map(costCode => ({
                            label: costCode.Name,
                            value: costCode.Id
                        }));

                        // Set current time as default for manual entry
                        this.clockInTime = new Date().toISOString().slice(0, 16);
                        this.clockOutTime = new Date().toISOString().slice(0, 16);
                    } else {
                        this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    }
                }).catch((error) => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error in getContactsAndCostcode apex ::' ,error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleAddTimesheet ::', error);
            this.isLoading = false;
        }
    }

    /** * Method Name: closeManualTimesheetModal 
    * @description: Method is used to close the manual timesheet modal
    */
    closeManualTimesheetModal() {
        this.manualTimesheetEntry = false;
        this.selectedManualPersonId = null;
        this.selectedCostCodeId = null;
        this.clockInTime = null;
        this.clockOutTime = null;
        this.enteredManualTravelTime = 0.00;
        this.enteredManualPerDiem = 0;
        this.allContacts = [];
        this.costCodeOptions = [];
    }

    /**
     * Method Name: handleTimesheetEdit
     * @description: Handle edit button click from timesheet row (Deprecated in favor of inline editing, but kept for old flows if needed)
     */
    handleTimesheetEdit(event) {
        const timesheetId = event.currentTarget.dataset.id;
        const mobId = event.currentTarget.dataset.mobid;
        
        // Store mobId for later use
        this.mobId = mobId;
        
        // Find the timesheet entry from the map
        const timesheets = this.timesheetDataMap.get(mobId);
        if (timesheets) {
            const timesheet = timesheets.find(ts => ts.id === timesheetId);
            if (timesheet) {
                this.selectedTimesheetEntryLineId = timesheetId;
                this.editableTimesheetEntry = { ...timesheet };
                this.editTimesheetEntry = true;
            }
        }
    }

    /**
     * Method Name: handleTimesheetDelete
     * @description: Handle delete button click from timesheet row (Deprecated in favor of inline delete from new table)
     */
    handleTimesheetDelete(event) {
        // This method is now effectively used for SINGLE DELETE via the edit button's context menu.
        const timesheetId = event.currentTarget.dataset.id;
        const mobId = event.currentTarget.dataset.mobid;
        this.selectedTimesheetEntryLineId = timesheetId;
        this.mobId = mobId; // Store mobId for refreshing data after delete
        this.deleteConfirmationAction = 'singleDeleteTimesheet';
        this.deleteConfirmationTitle = 'Delete Timesheet Entry';
        this.deleteConfirmationMessage = 'Are you sure you want to delete this timesheet entry?';
        this.showDeleteConfirmModal = true;
    }

    /** * Method Name: createManualTimesheet 
    * @description: Method is used to create the manual timesheet record
    */
    createManualTimesheet() {
        try {
            if(!this.selectedManualPersonId || !this.selectedCostCodeId || !this.clockInTime || !this.clockOutTime) {
                this.showToast('Error', 'Please fill value in all the required fields!', 'error');
                return;
            }

            if(new Date(this.clockOutTime.replace(' ', 'T')) <= new Date(this.clockInTime.replace(' ', 'T'))) {
                this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
                return;
            }

            const jobRecord = this.getCurrentJobRecord();
            const jobStartReference = jobRecord?.startDate || this.currentJobStartDateTime;
            const jobEndReference = jobRecord?.endDate || this.currentJobEndDateTime;

            // USE CORRECTED VALIDATION
            if (!this.validateClockInDate(this.clockInTime, jobStartReference)) {
                return;
            }

            if (!this.validateClockOutDate(this.clockOutTime, jobStartReference, jobEndReference)) {
                return;
            }
            
            if (this.enteredManualPerDiem != 0 && this.enteredManualPerDiem != 1) {
                this.showToast('Error', 'Per Diem must be either 0 or 1.', 'error');
                return;
            }

            this.isLoading = true;
    
            const params = {
                jobId : this.jobId,
                mobId : this.mobId,
                contactId : this.selectedManualPersonId,
                costCodeId : this.selectedCostCodeId,
                clockInTime : this.clockInTime,
                clockOutTime : this.clockOutTime,
                // Ensure correct date keys are passed
                jobStartDate : this.extractDateKey(jobStartReference),
                jobEndDate : this.extractDateKey(jobEndReference),
                travelTime : this.enteredManualTravelTime ? String(this.enteredManualTravelTime) : '0.00',
                perDiem : this.enteredManualPerDiem ? String(this.enteredManualPerDiem) : '0'
            }
    
            createManualTimesheetRecords({params : JSON.stringify(params)})
                .then((result) => {
                    if(result == true) {
                        this.closeManualTimesheetModal();
                        this.showToast('Success', 'Timesheet created successfully', 'success');
                        
                        // Refresh the specific job's timesheet data
                        if (this.mobId) {
                            this.loadTimesheetData(this.mobId);
                        }
                        this.getJobRelatedMoblizationDetails();
                    } else {
                        this.showToast('Error', 'Failed to create timesheet record. Please try again.', 'error');
                    }
                })
                .catch((error) => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error in createManualTimesheetRecords :: ' , error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in createManualTimesheet :: ', error);
            this.isLoading = false;
        }
    }

    /** * Method Name: handleEditTimesheetClick 
    * @description: Method is used to handle the edit timesheet action
    * NOTE: This is for the single "Edit" button that remains in the row actions (for compatibility/modal editing). 
    * Inline editing is handled by handleTimesheetCellClick.
    */
    handleEditTimesheetClick(event) {
        try {
            this.selectedTimesheetEntryLineId = event.currentTarget.dataset.id;
            const mobId = event.currentTarget.dataset.mobid;
            this.mobId = mobId;
            
            // Find the record in the timesheetDataMap
            const timesheets = this.timesheetDataMap.get(mobId);
            const record = timesheets.find(item => item.id === this.selectedTimesheetEntryLineId);
            
            if(record) {
                // Create a copy for editing, ensuring DateTimes are in YYYY-MM-DDThh:mm format for input
                this.editableTimesheetEntry = {
                    Id: record.id,
                    TSEId: record.TSEId,
                    FullName: record.contactName,
                    ClockIn: this.formatToDatetimeLocal(record.clockInTime), // Format for input
                    ClockOut: this.formatToDatetimeLocal(record.clockOutTime), // Format for input
                    TravelTime: record.travelTime || 0.00,
                    PerDiem: record.perDiem || 0,
                    premium: record.premium || false
                };
                
                this.editTimesheetEntry = true;
            }
        } catch (error) {
            console.error('Error in handleEditTimesheetClick:', error);
            this.showToast('Error', 'Failed to open edit modal.', 'error');
        }
    }

    /** * Method Name: handleEditTSELFieldChange 
    * @description: Method is used to handle the field change in edit timesheet modal
    */
    handleEditTSELFieldChange(event) {
        try {
            const field = event.target.dataset.field; // data-field attribute on input
            let value;

            // Handle checkbox separately
            if (event.target.type === 'checkbox') {
                value = event.target.checked;
            } else {
                value = event.target.value;
            }
    
            if(field && this.editableTimesheetEntry) {
                // Update variable dynamically
                this.editableTimesheetEntry[field] = value;
            }
        } catch (error) {
            console.error('Error in handleEditTSELFieldChange:', error);
        }
    }

    /** * Method Name: handleSaveTSEL 
    * @description: Method is used to save the edited timesheet entry (from modal).
    * This method packages the single entry into a list and calls the bulk-safe 
    * saveTimesheetEntryInlineEdits Apex method.
    */
    handleSaveTSEL() {
        try {
            const entry = this.editableTimesheetEntry;
            
            // --- Validation ---
            
            // Check ClockIn
            if (!entry.ClockIn || entry.ClockIn.toString().trim() === '') {
                this.showToast('Error', 'Clock In Time cannot be empty', 'error');
                return;
            }

            // Check ClockOut
            if (!entry.ClockOut || entry.ClockOut.toString().trim() === '') {
                this.showToast('Error', 'Clock Out Time cannot be empty', 'error');
                return;
            }

            // Normalize PerDiem and validate value (0 or 1)
            let perDiemNum = entry.PerDiem === null || entry.PerDiem === undefined ? 0 : Number(entry.PerDiem);
            
            if (perDiemNum !== 0 && perDiemNum !== 1) {
                this.showToast('Error', 'Per Diem must be 0 or 1', 'error');
                return;
            }
            entry.PerDiem = perDiemNum; 

            // Check Clock In/Out time order
            if(new Date(entry.ClockOut) <= new Date(entry.ClockIn)) {
                this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
                return;
            }

            const jobRecord = this.getCurrentJobRecord();
            const jobStartReference = jobRecord?.startDate || this.currentJobStartDateTime;
            const jobEndReference = jobRecord?.endDate || this.currentJobEndDateTime;

            // Check date boundaries
            if (!this.validateClockInDate(entry.ClockIn, jobStartReference)) {
                return;
            }

            if (!this.validateClockOutDate(entry.ClockOut, jobStartReference, jobEndReference)) {
                return;
            }

            this.isLoading = true;
            
            // Prepare payload for the bulk Apex method
            const payload = [{
                Id: entry.Id, // Timesheet Entry Item ID (TSELI)
                TSEId: entry.TSEId, // Parent Timesheet Entry ID (TSE)
                clockInTime: String(entry.ClockIn),
                clockOutTime: String(entry.ClockOut),
                travelTime: String(entry.TravelTime || 0.00),
                perDiem: String(entry.PerDiem),
                premium: String(entry.premium || false)
            }];

            const updatedTimesheetsJson = JSON.stringify(payload);

            // Call the bulk-safe inline edit method
            saveTimesheetEntryInlineEdits({ updatedTimesheetEntriesJson: updatedTimesheetsJson })
                .then((result) => {
                    if (result.startsWith('Success')) {
                        this.selectedTimesheetEntryLineId = null;
                        // Refresh the specific job's timesheet data
                        if (this.mobId) {
                            this.loadTimesheetData(this.mobId);
                        }
                        this.getJobRelatedMoblizationDetails();
                        this.showToast('Success', 'Timesheet entry updated successfully', 'success');
                        this.closeEditTimesheetModal();
                    } else {
                        this.showToast('Error', 'Failed to update timesheet entry: ' + result, 'error');
                    }
                })
                .catch(error => {
                    console.error('Error saving timesheet entry via modal:', error);
                    this.showToast('Error', 'Something went wrong. Please contact system admin' , 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'An unexpected error occurred during save.', 'error');
            console.error('Error in handleSaveTSEL (outer catch):', error);
            this.isLoading = false;
        }
    }

    /** * Method Name: closeEditTimesheetModal 
    * @description: Method is used to close the edit timesheet modal
    */
    closeEditTimesheetModal() {
        this.editTimesheetEntry = false;
        this.editableTimesheetEntry = {};
    }

    /** * Method Name: closeTimesheetModal 
    * @description: Method is used to close the timesheet modal
    */
    closeTimesheetModal() {
        this.showTimesheetModal = false;
        this.jobId = null;
        this.mobId = null;
        this.editTimesheetEntry = false;
        this.timesheetDetailsRaw = [];
        this.modifiedTimesheetEntries.clear();
        this.hasTimesheetModifications = false;
        this.editingTimesheetCells.clear();
        this.selectedTimesheets.clear();
        this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw]; // Final refresh to clean up UI state
    }

    /** * Method Name: showToast 
    * @description: Method is used to show toast message
    */
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title,
            message,
            variant
        });
        this.dispatchEvent(event);
    }
    
    // --- Inline Editing and Bulk Delete Logic ---

    /**
     * Method Name: handleTimesheetCellClick
     * @description: Handles the click on an individual cell to enable inline editing.
     */
    handleTimesheetCellClick(event) {
        const id = event.currentTarget.dataset.id;
        const field = event.currentTarget.dataset.field;
        const type = event.currentTarget.dataset.type;
        const mobId = event.currentTarget.dataset.mobid;
        
        // Prevent editing non-editable columns
        const column = this.timesheetColumns.find(col => col.fieldName === field);
        if (!column || !column.editable) return;

        const cellKey = `${id}-${field}`;

        // Don't open editor if already editing this cell
        if (this.editingTimesheetCells.has(cellKey)) return;

        // Set the cell to editing mode
        this.editingTimesheetCells.add(cellKey);
        
        // Trigger re-render
        this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw]; // Force jobDetails getter to re-run
        
        // Auto-focus the input after DOM update
        setTimeout(() => {
            const inputSelector = `[data-id="${id}"][data-field="${field}"]`;
            let inputElement = this.template.querySelector(inputSelector);
            
            if (inputElement && inputElement.tagName.toLowerCase() === 'td') {
                inputElement = inputElement.querySelector('input, select');
            }
            
            if (inputElement) {
                inputElement.focus();
                if (inputElement.type === 'number' || inputElement.type === 'text') {
                    inputElement.select();
                }
            }
        }, 100);
    }

    /**
     * Method Name: handleTimesheetCellInputChange
     * @description: Updates the modifiedTimesheetEntries Map on input change.
     */
    handleTimesheetCellInputChange(event) {
        const id = event.currentTarget.dataset.id;
        const field = event.currentTarget.dataset.field;
        const type = event.currentTarget.dataset.type;
        const mobId = event.currentTarget.dataset.mobid;
        
        let newValue;
        if (type === 'boolean') {
            newValue = event.target.checked;
        } else {
            newValue = event.target.value;
        }

        // --- Type Conversion ---
        if (type === 'number') {
            newValue = newValue === '' || newValue === null || newValue === undefined ? null : parseFloat(newValue);
            if (isNaN(newValue)) newValue = null;
        }
        // For datetime, newValue is the YYYY-MM-DDThh:mm string
        // For boolean, it's true/false

        // --- Get Original Value ---
        const originalTimesheetEntry = this.timesheetDataMap.get(mobId)?.find(ts => ts.id === id);
        let originalValue = originalTimesheetEntry ? originalTimesheetEntry[field] : null;

        // Standardize originalValue for comparison:
        if (type === 'number') {
            originalValue = originalValue !== null && originalValue !== undefined ? parseFloat(originalValue) : null;
        } else if (type === 'boolean') {
            originalValue = !!originalValue;
        }


        // --- Track Modifications ---
        if (!this.modifiedTimesheetEntries.has(id)) {
            this.modifiedTimesheetEntries.set(id, { mobId: mobId, modifications: {} });
        }
        
        const entry = this.modifiedTimesheetEntries.get(id);
        const modifications = entry.modifications;
        
        // Comparison logic: handles null/empty string/undefined and number/boolean comparison
        const areValuesEqual = (val1, val2, valueType) => {
            if (val1 === val2) return true;
            
            // Treat null, undefined, and empty string as equal for certain types
            if (valueType === 'number' || valueType === 'datetime') {
                const normalized1 = (val1 === null || val1 === undefined || val1 === '') ? null : val1;
                const normalized2 = (val2 === null || val2 === undefined || val2 === '') ? null : val2;
                if (normalized1 === normalized2) return true;
            }

            if (valueType === 'number' && val1 !== null && val2 !== null && !isNaN(val1) && !isNaN(val2)) {
                 // Compare floats up to 2 decimal places for robustness
                return Math.abs(parseFloat(val1) - parseFloat(val2)) < 0.005;
            }
            if (valueType === 'boolean') return !!val1 === !!val2;

            return false;
        };

        if (!areValuesEqual(newValue, originalValue, type)) {
            modifications[field] = newValue;
        } else {
            delete modifications[field];
            if (Object.keys(modifications).length === 0) {
                this.modifiedTimesheetEntries.delete(id);
            }
        }
        
        // Update flags
        this.hasTimesheetModifications = this.modifiedTimesheetEntries.size > 0;
        
        // Trigger re-render to update highlighting and button states
        this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw];
    }

    /**
     * Method Name: handleTimesheetCellInputBlur
     * @description: Removes cell from editing mode on blur.
     */
    handleTimesheetCellInputBlur(event) {
        const id = event.currentTarget.dataset.id;
        const field = event.currentTarget.dataset.field;
        const cellKey = `${id}-${field}`;

        this.editingTimesheetCells.delete(cellKey);

        // Trigger re-render
        this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw];
    }

    /**
     * Method Name: validateTimesheetChanges
     * @description: Validates timesheet modifications before saving.
     */
    validateTimesheetChanges(mobId) {
        const errors = [];
        const modifications = this.modifiedTimesheetEntriesForJob(mobId);
        const jobRecord = this.getCurrentJobRecord();
        const jobStartReference = jobRecord?.startDate;
        const jobEndReference = jobRecord?.endDate;

        modifications.forEach((entry, id) => {
            const originalEntry = this.timesheetDataMap.get(mobId)?.find(ts => ts.id === id);
            const fullName = originalEntry?.contactName || id;
            
            const changes = entry.modifications;
            
            // Get current values (modified or original) for cross-field validation
            const currentClockIn = changes.clockInTime || originalEntry.clockInTime;
            const currentClockOut = changes.clockOutTime || originalEntry.clockOutTime;
            
            for (const [field, value] of Object.entries(changes)) {
                const column = this.timesheetColumns.find(col => col.fieldName === field);
                if (!column || !column.editable) continue;

                // --- 1. Required/Empty Check (Clock In/Out) ---
                if ((field === 'clockInTime' || field === 'clockOutTime') && (!value || value.toString().trim() === '')) {
                    errors.push(`${fullName}: ${column.label} cannot be empty.`);
                }
                
                // --- 2. Date Boundaries Check ---
                if (field === 'clockInTime' && value) {
                    if (!this.validateClockInDate(value, jobStartReference)) {
                        errors.push(`${fullName}: Clock In time violates job date boundaries.`);
                    }
                }
                if (field === 'clockOutTime' && value) {
                    if (!this.validateClockOutDate(value, jobStartReference, jobEndReference)) {
                        errors.push(`${fullName}: Clock Out time violates job date boundaries.`);
                    }
                }

                // --- 3. Number/Decimal Constraints Check (TravelTime, PerDiem) ---
                if (column.type === 'number') {
                    const numValue = Number(value);
                    const isPerDiem = field === 'perDiem';

                    if (value === null || isNaN(numValue) || numValue < column.min) {
                        errors.push(`${fullName}: ${column.label} must be a valid number, minimum ${column.min}.`);
                    } else if (isPerDiem && (numValue !== 0 && numValue !== 1)) {
                        errors.push(`${fullName}: ${column.label} must be 0 or 1.`);
                    } else {
                        // Check decimal places for non-integer types (TravelTime)
                        if (column.step && column.step.toString().includes('0.01')) {
                            const decimalPart = numValue.toString().split('.')[1];
                            if (decimalPart && decimalPart.length > 2) {
                                errors.push(`${fullName}: ${column.label} cannot have more than 2 decimal places.`);
                            }
                        }
                    }
                }
            }
            
            // --- 4. Cross-Field Clock In/Out Time Order Check ---
            if (currentClockIn && currentClockOut && new Date(currentClockOut) <= new Date(currentClockIn)) {
                 errors.push(`${fullName}: Clock Out Time must be greater than Clock In Time.`);
            }
        });
        
        return errors;
    }

    /**
     * Method Name: handleSaveTimesheetChanges
     * @description: Saves all modified timesheet entries for a specific job/mobilization.
     */
    handleSaveTimesheetChanges(event) {
        const mobId = event.currentTarget.dataset.mobid;
        
        if (this.isSavingTimesheetEntries || !this.hasTimesheetModificationsForJob(mobId)) {
            return;
        }

        const validationErrors = this.validateTimesheetChanges(mobId);
        if (validationErrors.length > 0) {
            this.showToast('Validation Error', validationErrors.join('\n'), 'error');
            return;
        }

        this.isSavingTimesheetEntries = true;

        const updatedTimesheets = [];
        this.modifiedTimesheetEntriesForJob(mobId).forEach((entry, id) => {
            const originalTSE = this.timesheetDataMap.get(mobId).find(ts => ts.id === id);
            
            const tsUpdate = { 
                Id: id, // TSELI Id
                TSEId: originalTSE.TSEId // Parent TSE Id for Apex reference
            };
            
            // Map modifications to the payload
            Object.keys(entry.modifications).forEach(field => {
                tsUpdate[field] = entry.modifications[field];
            });
            
            updatedTimesheets.push(tsUpdate);
        });

        // Clear all modifications for this job immediately before the call
        // This prevents UI state errors if navigation occurs
        this.modifiedTimesheetEntriesForJob(mobId).forEach((entry, id) => {
            this.modifiedTimesheetEntries.delete(id);
        });

        // Stringify and convert all values to string for Apex consumption
        const updatedTimesheetsJson = JSON.stringify(updatedTimesheets.map(
            ts => Object.fromEntries(
                Object.entries(ts).map(([key, value]) => [key, String(value)])
            )
        ));

        saveTimesheetEntryInlineEdits({ updatedTimesheetEntriesJson: updatedTimesheetsJson })
            .then(result => {
                if (result.startsWith('Success')) {
                    this.showToast('Success', 'Timesheet changes saved successfully', 'success');
                    // Re-load data for this job to refresh calculated fields and UI
                    this.loadTimesheetData(mobId);
                    this.getJobRelatedMoblizationDetails();
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                console.error('Error saving timesheet changes:', error);
                this.showToast('Error', 'Failed to save timesheet changes', 'error');
            })
            .finally(() => {
                this.isSavingTimesheetEntries = false;
                this.hasTimesheetModifications = this.modifiedTimesheetEntries.size > 0;
                this.editingTimesheetCells.clear();
                this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw]; // Final refresh for UI state
            });
    }

    /**
     * Method Name: handleDiscardTimesheetChanges
     * @description: Discards all pending inline edits for the current job/mobilization.
     */
    handleDiscardTimesheetChanges(event) {
        const mobId = event.currentTarget.dataset.mobid;
        
        if (!this.hasTimesheetModificationsForJob(mobId)) {
            return;
        }
        
        // Clear modifications associated with this mobId
        const modifiedIds = Array.from(this.modifiedTimesheetEntries.keys());
        
        modifiedIds.forEach(id => {
            if (this.modifiedTimesheetEntries.get(id)?.mobId === mobId) {
                this.modifiedTimesheetEntries.delete(id);
                // Also clear any associated editing state
                Array.from(this.editingTimesheetCells).forEach(cellKey => {
                    if (cellKey.startsWith(id)) {
                        this.editingTimesheetCells.delete(cellKey);
                    }
                });
            }
        });
        
        // FIX: Re-instantiate the Map to force reactivity
        this.modifiedTimesheetEntries = new Map(this.modifiedTimesheetEntries);
        // Update global flag
        this.hasTimesheetModifications = this.modifiedTimesheetEntries.size > 0;
        
        // Force re-render to revert values and remove highlighting
        this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw];
        
        this.showToast('Success', 'Timesheet changes have been discarded', 'success');
    }

    /**
     * Method Name: handleTimesheetSelection
     * @description: Tracks selection of individual timesheet entries for bulk delete.
     */
    handleTimesheetSelection(event) {
        const id = event.currentTarget.dataset.id;
        const mobId = event.currentTarget.dataset.mobid;
        const isChecked = event.target.checked;
        
        if (!this.selectedTimesheets.has(mobId)) {
            this.selectedTimesheets.set(mobId, new Set());
        }

        const selectedSet = this.selectedTimesheets.get(mobId);

        if (isChecked) {
            selectedSet.add(id);
        } else {
            selectedSet.delete(id);
        }

        this.selectedTimesheets = new Map(this.selectedTimesheets);
        this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw]; // Force re-render
    }

    /**
     * Method Name: handleSelectAllTimesheets
     * @description: Selects or deselects all timesheet entries for a specific job.
     */
    handleSelectAllTimesheets(event) {
        const mobId = event.currentTarget.dataset.mobid;
        const isChecked = event.target.checked;
        const timesheets = this.timesheetDataMap.get(mobId) || [];
        const allIds = timesheets.map(ts => ts.id);

        if (!this.selectedTimesheets.has(mobId)) {
            this.selectedTimesheets.set(mobId, new Set());
        }

        const selectedSet = this.selectedTimesheets.get(mobId);

        if (isChecked) {
            allIds.forEach(id => selectedSet.add(id));
        } else {
            selectedSet.clear();
        }

        this.selectedTimesheets = new Map(this.selectedTimesheets);
        this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw]; // Force re-render
    }
    
    /**
     * Method Name: handleMassDeleteTimesheets
     * @description: Initiates the bulk delete process.
     */
    handleMassDeleteTimesheets(event) {
        const mobId = event.currentTarget.dataset.mobid;
        const selectedIds = this.selectedTimesheets.get(mobId);

        if (!selectedIds || selectedIds.size === 0) {
            this.showToast('Warning', 'Please select at least one timesheet entry to delete.', 'warning');
            return;
        }

        this.deleteConfirmationAction = 'bulkDeleteTimesheets';
        this.deleteConfirmationTitle = 'Delete Selected Timesheet Entries';
        this.deleteConfirmationMessage = `Are you sure you want to permanently delete ${selectedIds.size} timesheet entries? This action cannot be undone.`;
        this.deleteTargetMobId = mobId;
        this.showDeleteConfirmModal = true;
    }

    /**
     * Method Name: handleDeleteConfirmTSEL
     * @description: Overrides the single delete method to handle bulk delete based on state.
     */
    handleDeleteConfirmTSEL() {
        if (this.deleteConfirmationAction === 'bulkDeleteTimesheets') {
            this.proceedWithTimesheetBulkDeletion();
        } 
        // Note: The single delete modal is now typically bypassed if using the new UI.
        // If the modal is triggered by the old flow, it defaults to single deletion.
        else if (this.deleteConfirmationAction === 'singleDeleteTimesheet') {
            this.proceedWithTimesheetSingleDeletion(this.selectedTimesheetEntryLineId, this.mobId);
        } else {
            this.closeDeleteConfirmModal();
        }
    }

    /**
     * Method Name: proceedWithTimesheetSingleDeletion
     * @description: Handles the actual deletion of a single timesheet entry.
     */
    proceedWithTimesheetSingleDeletion(tselId, mobId) {
        try {
            this.isLoading = true;
            this.showDeleteConfirmModal = false; // Close modal
            
            deleteTimesheetEntry({ TSELId: tselId })
                .then((result) => {
                    if (result == true) {
                        this.showToast('Success', 'Timesheet deleted successfully', 'success');
                        this.selectedTimesheetEntryLineId = null;
                        this.resetDeleteConfirmationState();
                        
                        // Refresh the specific job's timesheet data
                        if (mobId) {
                            this.loadTimesheetData(mobId);
                        }
                        this.getJobRelatedMoblizationDetails();
                    } else {
                        this.showToast('Error', 'Failed to delete timesheet record. Please try again.', 'error');
                    }
                })
                .catch((error) => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error in deleteTimesheetEntry :: ', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in proceedWithTimesheetSingleDeletion:', error);
            this.isLoading = false;
        }
    }

    /**
     * Method Name: proceedWithTimesheetBulkDeletion
     * @description: Handles the actual deletion of selected timesheet entries.
     */
    proceedWithTimesheetBulkDeletion() {
        const mobId = this.deleteTargetMobId;
        const tselIdsToDelete = Array.from(this.selectedTimesheets.get(mobId) || []);

        this.isLoading = true;
        this.showDeleteConfirmModal = false; // Close modal
        
        deleteTimesheetEntriesBulk({ tselIds: tselIdsToDelete })
            .then(result => {
                if (result.startsWith('Success')) {
                    this.showToast('Success', `${tselIdsToDelete.length} timesheet entries deleted successfully`, 'success');
                    
                    // Clear selection and modifications for this job
                    this.selectedTimesheets.delete(mobId);
                    this.resetDeleteConfirmationState();

                    // Refresh data
                    this.loadTimesheetData(mobId);
                    this.getJobRelatedMoblizationDetails();
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to delete selected timesheet entries.', 'error');
                console.error('Error in deleteTimesheetEntriesBulk:', error);
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
    
    /**
     * Method Name: closeDeleteConfirmModal 
     * @description: Method is used to close the delete confirm modal
     */
    closeDeleteConfirmModal() {
        this.showDeleteConfirmModal = false;
        this.selectedTimesheetEntryLineId = null;
        this.resetDeleteConfirmationState();
    }

    /**
     * Method Name: resetDeleteConfirmationState
     * @description: Resets the state variables used for delete confirmation.
     */
    resetDeleteConfirmationState() {
        this.deleteConfirmationAction = '';
        this.deleteConfirmationTitle = '';
        this.deleteConfirmationMessage = '';
        this.deleteTargetMobId = '';
    }
}