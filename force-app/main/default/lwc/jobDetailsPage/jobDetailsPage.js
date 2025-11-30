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
                                cell.recordLink = `/${job.jobId}`; 
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
    
    /** * Method Name: getTimesheetDataForJobDisplay 
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
                    let value = originalValue; 
                    let isModified = false;

                    const modification = this.modifiedTimesheetEntries.get(ts.id)?.modifications;
                    if (modification && modification.hasOwnProperty(fieldName)) {
                        value = modification[fieldName];
                        isModified = true;
                    }

                    if (col.type === 'boolean') {
                        value = (value === 1 || value === '1' || value === true || value === 'true');
                    }

                    const isEditing = this.editingTimesheetCells.has(cellKey);
                    
                    let cellClass = 'center-trancate-text';
                    if (col.editable) cellClass += ' editable-cell';
                    if (isModified) cellClass += ' modified-process-cell';
                    if (isEditing) cellClass += ' editing-cell';

                    // Use formatToDatetimeLocal to extract raw ISO numbers for input
                    const datetimeValue = col.type === 'datetime' && value ? this.formatToDatetimeLocal(value) : null;
                    
                    let displayValue = String(value || '');
                    if (col.type === 'datetime') {
                        // Display uses the formatted version
                        displayValue = value ? this.formatToAMPM(value) : '--';
                    } else if (col.type === 'boolean') {
                        // Display uses Yes/No based on boolean state of the 'value'
                        displayValue = !!(value === 1 || value === '1' || value === true || value === 'true') ? 'Yes' : 'No';
                    } else if (col.type === 'number' || col.type === 'currency') {
                        // Display uses formatted number
                        displayValue = value !== null && value !== undefined && !isNaN(Number(value)) ? Number(value).toFixed(2) : '0.00';
                    }

                    let minBoundary = null;
                    let maxBoundary = null;
                    if (col.type === 'datetime') {
                        // Ensure min/max boundaries are correctly formatted for the HTML input
                        minBoundary = this.getDatetimeMinBoundary(ts, fieldName);
                        maxBoundary = this.getDatetimeMaxBoundary(ts, fieldName);
                    }

                    return {
                        key: fieldName,
                        displayValue: displayValue,
                        rawValue: value,  // rawValue holds the modified or original value (can be 0/1 for boolean)
                        datetimeValue: datetimeValue, // datetimeValue holds YYYY-MM-DDTHH:mm string for input binding
                        isEditing: this.editingTimesheetCells.has(cellKey),
                        isEditable: col.editable,
                        isModified: isModified,
                        cellClass: 'center-trancate-text' + (col.editable ? ' editable-cell' : '') + (isModified ? ' modified-process-cell' : '') + (this.editingTimesheetCells.has(cellKey) ? ' editing-cell' : ''),
                        contentClass: 'editable-content',
                        isDatetime: col.type === 'datetime',
                        isNumber: col.type === 'number',
                        isBoolean: col.type === 'boolean', 
                        isText: col.type === 'text',
                        isCurrency: col.type === 'currency',
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
        
        if (fieldName === 'clockInTime') {
            const dateKey = this.extractDateKey(jobStartReference);
            return dateKey ? `${dateKey}T00:00` : null;
        } 
        else if (fieldName === 'clockOutTime') {
            const clockIn = ts.clockInTime;
            const modifiedClockIn = this.modifiedTimesheetEntries.get(ts.id)?.modifications.clockInTime;
            const referenceTime = modifiedClockIn || clockIn;
            
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
        
        if (fieldName === 'clockInTime') {
            const dateKey = this.extractDateKey(jobEndReference);
            return dateKey ? `${dateKey}T23:59` : null;
        } 
        else if (fieldName === 'clockOutTime') {
            const dateKey = this.extractDateKey(jobEndReference);
            if (!dateKey) return null;
            
            const nextDay = this.addDaysToDateKey(dateKey, 1);
            return nextDay ? `${nextDay}T23:59` : null;
        }
        return null;
    }

    /**
     * Helper to get the field type reliably, even if the data-type attribute is missing.
     */
    getFieldType(fieldName) {
        const column = this.timesheetColumns.find(col => col.fieldName === fieldName);
        if (column && column.type) {
            return column.type;
        }
        
        // Fallback for fields we know should be certain types (critical fix)
        if (fieldName === 'perDiem' || fieldName === 'premium') {
            return 'boolean';
        }
        if (fieldName === 'clockInTime' || fieldName === 'clockOutTime') {
            return 'datetime';
        }
        if (fieldName === 'travelTime' || fieldName === 'workHours' || fieldName === 'totalTime') {
            return 'number';
        }
        return 'text';
    }

    /** * Method Name: formatToDatetimeLocal
    * @description: Extracts YYYY-MM-DDThh:mm string from ISO.
    * Does NOT use Date object to avoid browser timezone shift.
    */
    formatToDatetimeLocal(iso) {
        if (!iso) return '';
        try {
            // Example: "2025-11-26T14:30:00.000Z" -> "2025-11-26T14:30"
            return iso.substring(0, 16);
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

    /** * Method Name: formatToAMPM
    * @description: Formats ISO datetime string to 12-hour AM/PM format.
    * Uses string parsing to ensure perfect match with edit input.
    */
    formatToAMPM(iso) {
        try {
            if (!iso) return '--';
            
            // Parsing "2025-10-05T14:30:00.000Z" manually to avoid browser timezone math
            const parts = iso.split('T');
            if (parts.length < 2) return iso;
            
            const datePart = parts[0];
            const timePart = parts[1].substring(0, 5); // "14:30"
            
            const [year, month, day] = datePart.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = monthNames[parseInt(month, 10) - 1];
            
            const [hoursStr, minutesStr] = timePart.split(':');
            let hours = parseInt(hoursStr, 10);
            const minutes = minutesStr;
            
            const ampm = hours >= 12 ? 'PM' : 'AM';
            
            hours = hours % 12;
            hours = hours ? hours : 12; 
            
            const paddedHours = String(hours).padStart(2, '0');
            
            return `${monthName} ${parseInt(day, 10)}, ${year}, ${paddedHours}:${minutes} ${ampm}`;
        } catch (error) {
            console.error('Error in formatToAMPM:', error);
            return '--';
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

    validateClockInDate (clockInValue, jobStartValue, jobEndValue) {
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
            const expandedIds = new Set(this.expandedJobs);
            this.timesheetDataMap = new Map();
            this.expandedJobs = new Set();
            
            if (!this.jobDetailsRaw || this.jobDetailsRaw.length === 0) {
                return;
            }

            const loadPromises = this.jobDetailsRaw.map(job => {
                return this.loadTimesheetDataForJob(job);
            });

            await Promise.all(loadPromises);
            
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
            const jobStartDate = this.extractDateKey(job.startDate);
            const jobEndDate = this.extractDateKey(job.endDate);
            
            const data = await getTimeSheetEntryItems({ 
                jobId: jobId, 
                jobStartDate: jobStartDate, 
                jobEndDate: jobEndDate 
            });
            
            if (data && data.length > 0) {
                const formattedData = data.map((item, index) => ({
                    ...item,
                    srNo: index + 1,
                    workHours: item.workHours !== null ? Number(item.workHours) : 0.00,
                    travelTime: item.travelTime !== null ? Number(item.travelTime) : 0.00,
                    perDiem: item.perDiem !== null ? Number(item.perDiem) : 0,
                    totalTime: item.totalTime !== null ? Number(item.totalTime) + (item.travelTime !== null ? Number(item.travelTime) : 0) : 0.00
                }));
                this.timesheetDataMap.set(mobId, formattedData);
            } else {
                this.timesheetDataMap.set(mobId, []);
            }
        } catch (error) {
            console.error('Error loading timesheet data for job:', job, error);
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
                            // Default to current local time string
                            const now = new Date();
                            const offsetMs = now.getTimezoneOffset() * 60 * 1000;
                            this.defaultStartTime = (new Date(now.getTime() - offsetMs)).toISOString().slice(0, 16);
                        }
                        this.clockInTime = this.defaultStartTime;
   
                        if(result.costCodeDetails.length > 0) {
                            const costCodeMap = result.costCodeDetails[0].costCodeDetails; 
                            this.costCodeOptions = Object.keys(costCodeMap).map(key => ({
                                label: costCodeMap[key],
                                value: key
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
            this.loadTimesheetData(mobId);
        }
        this.expandedJobs = new Set(this.expandedJobs);
        this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw]; 
    }

    /**
     * Method Name: loadTimesheetData
     * @description: Refresh timesheet data for a specific job (used after CRUD operations)
     */
    async loadTimesheetData(mobId) {
        try {
            this.isLoading = true;
            
            const job = this.jobDetailsRaw?.find(j => j.mobId === mobId);
            if (job) {
                await this.loadTimesheetDataForJob(job);
                this.updateJobDetailsInUI(mobId); // Update the single job row in the UI
            }
        } catch (error) {
            console.error('Error in loadTimesheetData:', error);
        } finally {
            this.isLoading = false;
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
            this.selectedDate = new Date(); 
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
            let day = dt.getDay(); 
            this.weekStart = new Date(dt);
            this.weekStart.setDate(dt.getDate() - day); 
            this.weekEnd = new Date(this.weekStart);
            this.weekEnd.setDate(this.weekStart.getDate() + 6); 
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
            const today = new Date();
            const day = today.getDay();
            const sunday = new Date(today);
            sunday.setDate(today.getDate() - day);
            const saturday = new Date(sunday);
            saturday.setDate(sunday.getDate() + 6);
            const toISODate = date => date.toISOString().split('T')[0];
   
            this.customStartDate = toISODate(sunday);
            this.customEndDate = toISODate(saturday);
   
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
            clearTimeout(this._dateChangeTimeout); 
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

            // Pass raw local time string + seconds to Apex
            const cleanClockIn = this.clockInTime.length === 16 ? this.clockInTime + ':00' : this.clockInTime;

            const params = {
                actionType: 'clockIn',
                jobId: this.jobId,
                mobId: this.mobId,
                contactId: this.selectedContactId,
                costCodeId: this.selectedCostCodeId,
                clockInTime: cleanClockIn, 
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
                    
                    this.clockOutList = result.clockOut.map(person => ({
                        ...person,
                        clockInTime: person.clockInTime, 
                    }));
                    
                    this.clockOutOptions = this.clockOutList.map(person => ({
                        label: person.contactName,
                        value: person.contactId
                    }));

                    if (this.clockOutList.length > 0) {
                        this.defaultEndTime = result.clockOut[0].jobEndTime.slice(0, 16);
                    } else {
                        // Default to current local time string
                        const now = new Date();
                        const offsetMs = now.getTimezoneOffset() * 60 * 1000;
                        this.defaultEndTime = (new Date(now.getTime() - offsetMs)).toISOString().slice(0, 16);
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

            // Pass raw local time string + seconds to Apex
            const cleanClockOut = this.clockOutTime.length === 16 ? this.clockOutTime + ':00' : this.clockOutTime;

            const params = {
                actionType: 'clockOut',
                jobId: this.jobId,
                mobId: this.mobId,
                contactId: this.selectedContactId,
                clockInTime: selectedRecordDetails ? selectedRecordDetails?.clockInTime : this.clockInTime,
                clockOutTime: cleanClockOut,
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
                        this.isSelectedContactClockedIn = false; 
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

                        // Initialize manual timesheet with current Local Time strings
                        const now = new Date();
                        const offsetMs = now.getTimezoneOffset() * 60 * 1000;
                        const localNow = (new Date(now.getTime() - offsetMs)).toISOString().slice(0, 16);
                        
                        this.clockInTime = localNow;
                        this.clockOutTime = localNow;
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
        
        this.mobId = mobId;
        
        const timesheets = this.timesheetDataMap.get(mobId);
        if (timesheets) {
            const timesheet = timesheets.find(ts => ts.id === timesheetId);
            if (timesheet) {
                this.selectedTimesheetEntryLineId = timesheetId;
                this.editableTimesheetEntry = { 
                    ...timesheet,
                    // Use raw local string for edit inputs
                    ClockIn: this.formatToDatetimeLocal(timesheet.clockInTime), 
                    ClockOut: this.formatToDatetimeLocal(timesheet.clockOutTime)
                };
                this.editTimesheetEntry = true;
            }
        }
    }

    /**
     * Method Name: handleTimesheetDelete
     * @description: Handle delete button click from timesheet row (Deprecated in favor of inline delete from new table)
     */
    handleTimesheetDelete(event) {
        const timesheetId = event.currentTarget.dataset.id;
        const mobId = event.currentTarget.dataset.mobid;
        this.selectedTimesheetEntryLineId = timesheetId;
        this.mobId = mobId; 
        this.deleteConfirmationAction = 'singleDeleteTimesheet';
        this.deleteConfirmationTitle = 'Delete Timesheet Entry';
        this.deleteConfirmationMessage = 'Are you sure you want to delete this timesheet entry?';
        this.showDeleteConfirmModal = true;
    }

    createManualTimesheet() {
        try {
            if(!this.selectedManualPersonId || !this.selectedCostCodeId || !this.clockInTime || !this.clockOutTime) {
                this.showToast('Error', 'Please fill value in all the required fields!', 'error');
                return;
            }

            if(this.clockOutTime <= this.clockInTime) {
                this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
                return;
            }

            const jobRecord = this.getCurrentJobRecord();
            const jobStartReference = jobRecord?.startDate || this.currentJobStartDateTime;
            const jobEndReference = jobRecord?.endDate || this.currentJobEndDateTime;

            if (!this.validateClockInDate(this.clockInTime, jobStartReference)) {
                return;
            }
            if (!this.validateClockOutDate(this.clockOutTime, jobStartReference, jobEndReference)) {
                return;
            }
             
            // MODIFIED: Use `this.enteredManualPerDiem` (from checkbox state in UI, stored as 0 or 1)
            // If you decide to use a checkbox in the modal HTML, you need to adjust handleInputChange for PerDiem to store true/false
            // Assuming the number input for PerDiem is still used in the modal for simplicity, but validating it.
            if (this.enteredManualPerDiem != 0 && this.enteredManualPerDiem != 1) {
                this.showToast('Error', 'Per Diem must be either 0 or 1.', 'error');
                return;
            }

            this.isLoading = true;

            // --- TIMEZONE FIX ---
            // Pass raw local string (YYYY-MM-DDTHH:mm) + seconds.
            const cleanClockIn = this.clockInTime.length === 16 ? this.clockInTime + ':00' : this.clockInTime;
            const cleanClockOut = this.clockOutTime.length === 16 ? this.clockOutTime + ':00' : this.clockOutTime;

            const params = {
                jobId : this.jobId,
                mobId : this.mobId,
                contactId : this.selectedManualPersonId,
                costCodeId : this.selectedCostCodeId,
                clockInTime : cleanClockIn,
                clockOutTime : cleanClockOut,
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
                        
                        if (this.mobId) {
                            this.loadTimesheetData(this.mobId);
                        }
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
            
            const timesheets = this.timesheetDataMap.get(mobId);
            const record = timesheets.find(item => item.id === this.selectedTimesheetEntryLineId);
            
            if(record) {
                this.editableTimesheetEntry = {
                    Id: record.id,
                    TSEId: record.TSEId,
                    FullName: record.contactName,
                    ClockIn: this.formatToDatetimeLocal(record.clockInTime), 
                    ClockOut: this.formatToDatetimeLocal(record.clockOutTime),
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
            const field = event.target.dataset.field; 
            let value;

            if (event.target.type === 'checkbox') {
                value = event.target.checked;
            } else {
                value = event.target.value;
            }
   
            if(field && this.editableTimesheetEntry) {
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
            
            if (!entry.ClockIn || entry.ClockIn.toString().trim() === '') {
                this.showToast('Error', 'Clock In Time cannot be empty', 'error');
                return;
            }
            if (!entry.ClockOut || entry.ClockOut.toString().trim() === '') {
                this.showToast('Error', 'Clock Out Time cannot be empty', 'error');
                return;
            }
            
            let perDiemNum = entry.PerDiem === null || entry.PerDiem === undefined ? 0 : Number(entry.PerDiem);
            if (perDiemNum !== 0 && perDiemNum !== 1) {
                this.showToast('Error', 'Per Diem must be 0 or 1', 'error');
                return;
            }
            entry.PerDiem = perDiemNum;

            if(entry.ClockOut <= entry.ClockIn) {
                this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
                return;
            }

            const jobRecord = this.getCurrentJobRecord();
            const jobStartReference = jobRecord?.startDate || this.currentJobStartDateTime;
            const jobEndReference = jobRecord?.endDate || this.currentJobEndDateTime;

            if (!this.validateClockInDate(entry.ClockIn, jobStartReference)) {
                return;
            }
            if (!this.validateClockOutDate(entry.ClockOut, jobStartReference, jobEndReference)) {
                return;
            }

            this.isLoading = true;
            
            // --- TIMEZONE FIX ---
            // Send local string. Append seconds.
            const cleanClockIn = entry.ClockIn.length === 16 ? entry.ClockIn + ':00' : entry.ClockIn;
            const cleanClockOut = entry.ClockOut.length === 16 ? entry.ClockOut + ':00' : entry.ClockOut;

            const payload = [{
                Id: entry.Id, 
                TSEId: entry.TSEId, 
                clockInTime: cleanClockIn,
                clockOutTime: cleanClockOut,
                travelTime: String(entry.TravelTime || 0.00),
                perDiem: String(entry.PerDiem),
                premium: String(entry.premium || false)
            }];

            const updatedTimesheetsJson = JSON.stringify(payload);

            saveTimesheetEntryInlineEdits({ updatedTimesheetEntriesJson: updatedTimesheetsJson })
                .then((result) => {
                    if (result.startsWith('Success')) {
                        this.selectedTimesheetEntryLineId = null;
                        
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
            console.error('Error in handleSaveTSEL:', error);
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
        this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw]; 
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
        
        const column = this.timesheetColumns.find(col => col.fieldName === field);
        if (!column || !column.editable) return;

        const cellKey = `${id}-${field}`;

        if (this.editingTimesheetCells.has(cellKey)) return;

        this.editingTimesheetCells.add(cellKey);
        
        this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw]; 
        
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
     * Method Name: areValuesEqual
     * @description: Robust comparison logic for different data types.
     */
    areValuesEqual(newValue, originalValue, valueType, field) {
        // Log the comparison being attempted

        if (newValue === originalValue) {
            return true;
        }

        // --- BOOLEAN Check (For Per Diem and Premium) ---
        if (valueType === 'boolean') {
            // Normalize all possible states (true/false, 1/0, '1'/'0', null/undefined) to strict boolean values
            // Apex stores 0/1. Checkbox returns true/false.
            const b1 = (newValue === 1 || newValue === '1' || newValue === true || newValue === 'true');
            const b2 = (originalValue === 1 || originalValue === '1' || originalValue === true || originalValue === 'true');
            
            const result = b1 === b2;
            return result;
        }

        // --- DATETIME Check (For clockInTime and clockOutTime) ---
        if (valueType === 'datetime') {
            // 1. Normalize the original ISO string (with seconds) from Apex
            const normalizedOriginal = originalValue ? this.formatToDatetimeLocal(originalValue) : null;
            
            // 2. The newValue is the local datetime-local string (without seconds)
            const normalizedNew = newValue || null;
            
            const result = normalizedOriginal === normalizedNew;
            return result;
        }

        // --- NUMBER Check (Including Travel Time and Work Hours) ---
        if (valueType === 'number' || valueType === 'currency') {
            const n1 = (newValue === null || newValue === undefined || newValue === '') ? null : Number(newValue);
            const n2 = (originalValue === null || originalValue === undefined || originalValue === '') ? null : Number(originalValue);
            
            if (n1 === null && n2 === null) {
                return true;
            }
            if (isNaN(n1) && isNaN(n2)) {
                return true;
            }

            if (n1 !== null && n2 !== null && !isNaN(n1) && !isNaN(n2)) {
                const diff = Math.abs(n1 - n2);
                const result = diff < 0.005; // Tolerance for floating point math
                return result;
            }
            return false;
        }
        
        // For other types (text)
        const result = String(newValue) === String(originalValue);
        return result;
    }

    /**
     * Method Name: handleTimesheetCellInputChange
     * @description: Updates the modifiedTimesheetEntries Map on input change.
     */
    handleTimesheetCellInputChange(event) {
        const id = event.currentTarget.dataset.id;
        const field = event.currentTarget.dataset.field;
        
        // CRITICAL FIX: Use getFieldType utility to ensure we always have a valid type
        const type = this.getFieldType(field);
        
        const mobId = event.currentTarget.dataset.mobid;

        let newValue;
        const isCheckbox = event.target.type === 'checkbox' || type === 'boolean';

        if (isCheckbox) {
            newValue = event.target.checked;
            // Immediate blur equivalent for checkboxes
            this.editingTimesheetCells.delete(`${id}-${field}`); 
        } else {
            newValue = event.target.value;
        }
        
        // --- 1. New Value Normalization for Storage/Comparison ---
        if (type === 'number') {
            newValue = newValue === '' || newValue === null || newValue === undefined ? null : parseFloat(newValue);
            if (isNaN(newValue)) newValue = null;
        } else if (type === 'datetime') {
            newValue = newValue || null;
        }
        
        const originalTimesheetEntry = this.timesheetDataMap.get(mobId)?.find(ts => ts.id === id);
        let originalValue = originalTimesheetEntry ? originalTimesheetEntry[field] : null;

        // --- 2. Comparison to Original Value ---
        const valuesMatch = this.areValuesEqual(newValue, originalValue, type, field);

        if (!this.modifiedTimesheetEntries.has(id)) {
            this.modifiedTimesheetEntries.set(id, { mobId: mobId, modifications: {} });
        }

        const entry = this.modifiedTimesheetEntries.get(id);
        const modifications = entry.modifications;
        

        if (!valuesMatch) {
            if (field === 'perDiem' || field === 'premium') {
                // Store boolean as 1 or 0 in modifications map for Apex
                const valueToStore = newValue ? 1 : 0;
                modifications[field] = valueToStore;
            } else {
                // Store normalized new value
                modifications[field] = newValue;
            }
        } else {
            // Value is back to original: remove from modifications
            delete modifications[field];
            if (Object.keys(modifications).length === 0) {
                this.modifiedTimesheetEntries.delete(id);
            }
        }

        this.modifiedTimesheetEntries = new Map(this.modifiedTimesheetEntries);
        this.hasTimesheetModifications = this.modifiedTimesheetEntries.size > 0;
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
            const currentClockIn = changes.hasOwnProperty('clockInTime') ? changes.clockInTime : originalEntry.clockInTime;
            const currentClockOut = changes.hasOwnProperty('clockOutTime') ? changes.clockOutTime : originalEntry.clockOutTime;

            for (const [field, value] of Object.entries(changes)) {
                const column = this.timesheetColumns.find(col => col.fieldName === field);
                if (!column || !column.editable) continue;

                // --- 1. Required/Empty Check (Clock In/Out) ---
                if ((field === 'clockInTime' || field === 'clockOutTime') && (!value || value.toString().trim() === '')) {
                    errors.push(`${fullName}: ${column.label} cannot be empty.`);
                }

                // --- 2. Date Boundaries Check ---
                if (field === 'clockInTime' && value) {
                    if (!this.validateClockInDate(value, jobStartReference, jobRecord?.endDate)) {
                         errors.push(`${fullName}: Clock In time must be on the job start date or job end date.`);
                    }
                }
                if (field === 'clockOutTime' && value) {
                    if (!this.validateClockOutDate(value, jobStartReference, jobEndReference)) {
                        errors.push(`${fullName}: Clock Out time violates job date boundaries.`);
                    }
                }

                // --- 3. Number/Decimal Constraints Check (TravelTime only) ---
                if (column.type === 'number') {
                    const numValue = (value === null || value === '') ? 0 : Number(value);

                    if (isNaN(numValue) || numValue < column.min) {
                        errors.push(`${fullName}: ${column.label} must be a valid number, minimum ${column.min}.`);
                    } else {
                        if (column.step && column.step.toString().includes('0.01')) {
                            const valueString = numValue.toFixed(10);
                            const decimalPart = valueString.slice(valueString.indexOf('.') + 1);

                            if (decimalPart.length > 2 && decimalPart.slice(2).replace(/0+$/, '').length > 0) {
                                errors.push(`${fullName}: ${column.label} cannot have more than 2 decimal places.`);
                            }
                        }
                    }
                }
            }

            // --- 4. Cross-Field Clock In/Out Time Order Check ---
            const clockInValueNormalized = this.formatToDatetimeLocal(currentClockIn) + ':00';
            const clockOutValueNormalized = this.formatToDatetimeLocal(currentClockOut) + ':00';

            const clockInDateTime = clockInValueNormalized ? new Date(clockInValueNormalized) : null;
            const clockOutDateTime = clockOutValueNormalized ? new Date(clockOutValueNormalized) : null;

            if (clockInDateTime && clockOutDateTime && clockOutDateTime <= clockInDateTime) {
                errors.push(`${fullName}: Clock Out Time (${this.formatToAMPM(currentClockOut)}) must be greater than Clock In Time (${this.formatToAMPM(currentClockIn)}).`);
            }
        });

        return errors;
    }

    /**
     * Method Name: updateJobDetailsInUI
     * @description: Finds a job in the filtered list and replaces it with a new object 
     * to force a targeted re-render of only the updated row/nested table via jobDetails getter.
     */
    updateJobDetailsInUI(mobId) {
        if (!this.filteredJobDetailsRaw) return;

        // Find the index of the job in the filtered list
        const jobIndex = this.filteredJobDetailsRaw.findIndex(j => j.mobId === mobId);

        if (jobIndex > -1) {
            // Find the original, potentially updated job data from the master list
            const updatedJob = this.jobDetailsRaw.find(j => j.mobId === mobId);
            
            if (updatedJob) {
                // Create a new array reference to trigger UI update for the whole table (lowest overhead for this component)
                const newFilteredList = [...this.filteredJobDetailsRaw];
                
                // Replace the old job object with a shallow clone of the updated job 
                // This tells LWC that ONLY this object has changed, avoiding a full component re-render.
                newFilteredList[jobIndex] = {...updatedJob}; 
                this.filteredJobDetailsRaw = newFilteredList;
            }
        }
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
        this.isLoading = true;

        this.modifiedTimesheetEntriesForJob(mobId).forEach((entry, id) => {
            const originalTSE = this.timesheetDataMap.get(mobId).find(ts => ts.id === id);
            
            const tsUpdate = {
                Id: id, 
                TSEId: originalTSE.TSEId 
            };
            
            // Map fields (same logic as before)
            tsUpdate.clockInTime = entry.modifications.clockInTime || originalTSE.clockInTime;
            tsUpdate.clockOutTime = entry.modifications.clockOutTime || originalTSE.clockOutTime;
            const modifiedTravelTime = entry.modifications.travelTime;
            tsUpdate.travelTime = modifiedTravelTime !== undefined ? modifiedTravelTime : originalTSE.travelTime;
            
            let perDiemValue = entry.modifications.hasOwnProperty('perDiem') ? entry.modifications.perDiem : 
                (originalTSE.perDiem === 1 || originalTSE.perDiem === '1' || originalTSE.perDiem === true) ? 1 : 0;
            tsUpdate.perDiem = perDiemValue; 

            let premiumValue = entry.modifications.hasOwnProperty('premium') ? entry.modifications.premium : 
                (originalTSE.premium === 1 || originalTSE.premium === '1' || originalTSE.premium === true) ? 1 : 0;
            tsUpdate.premium = premiumValue; 
            
            updatedTimesheets.push(tsUpdate);
        });

        // Clear modifications for this job
        this.modifiedTimesheetEntriesForJob(mobId).forEach((entry, id) => {
            this.modifiedTimesheetEntries.delete(id);
        });
        this.modifiedTimesheetEntries = new Map(this.modifiedTimesheetEntries);

        const updatedTimesheetsJson = JSON.stringify(updatedTimesheets.map(
            ts => Object.fromEntries(
                Object.entries(ts).map(([key, value]) => {
                    if (key === 'premium') return [key, value === 1 ? 'true' : 'false'];
                    else if (key === 'perDiem') return [key, String(value)];
                    else return [key, String(value)];
                })
            )
        ));
        
        saveTimesheetEntryInlineEdits({ updatedTimesheetEntriesJson: updatedTimesheetsJson })
            .then(result => {
                if (result.startsWith('Success')) {
                    this.showToast('Success', 'Timesheet changes saved successfully', 'success');
                    // 1. Re-load data for this job (updates map and triggers row re-render)
                    this.loadTimesheetData(mobId); 
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to save timesheet changes', 'error');
            })
            .finally(() => {
                this.isSavingTimesheetEntries = false;
                this.hasTimesheetModifications = this.modifiedTimesheetEntries.size > 0;
                this.editingTimesheetCells.clear();
                this.isLoading = false;
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
        this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw]; 
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
        this.filteredJobDetailsRaw = [...this.filteredJobDetailsRaw]; 
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