import { LightningElement, api, track } from 'lwc';
import getMobilizationsForJob from '@salesforce/apex/WholeCrewClockInOutController.getMobilizationsForJob';
import getMobilizationMembersForSelection from '@salesforce/apex/WholeCrewClockInOutController.getMobilizationMembersForSelection';
import bulkClockInOut from '@salesforce/apex/WholeCrewClockInOutController.bulkClockInOut';
import checkUserAccess from '@salesforce/apex/WholeCrewClockInOutController.checkUserAccess';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CloseActionScreenEvent } from 'lightning/actions';

export default class WholeCrewClockInOut extends LightningElement {
    @api recordId; // Job Id passed from Aura wrapper
    @api isHomePage = false; // Flag to indicate if component is on home page
    @track isLoading = false;
    @track hasAccess = false;
    @track accessErrorMessage = '';
    @track selectedMobilizationId = '';
    @track clockInMembers = [];
    @track clockOutMembers = [];
    @track costCodes = []; 
    @track selectedCostCodeId = '';
    @track hasData = false;
    @track errorMessage = '';
    @track mobilizationOptions = [];
    @track hasMobilizations = false;
    @track selectedBulkCostCodeId = '';
    @track bulkClockInTime = '';
    @track bulkClockOutTime = '';
    @track currentJobStartDateTime;
    @track currentJobEndDateTime;
    @track activeTab = 'clockin'; // Track active tab
    @track selectedMemberIds = new Set(); // Track selected member IDs

    // Getters
    get showMobilizationSelector() {
        return this.hasMobilizations && this.mobilizationOptions.length > 1;
    }

    get hasClockInMembers() {
        return this.clockInMembers && this.clockInMembers.length > 0;
    }

    get hasClockOutMembers() {
        return this.clockOutMembers && this.clockOutMembers.length > 0;
    }

    get clockInMembersCount() {
        return this.clockInMembers ? this.clockInMembers.length : 0;
    }

    get clockOutMembersCount() {
        return this.clockOutMembers ? this.clockOutMembers.length : 0;
    }

    get selectedClockInCount() {
        if (!this.isClockInActive) return 0;
        return Array.from(this.selectedMemberIds).filter(id => 
            this.clockInMembers.some(m => m.mobMemberId === id)
        ).length;
    }

    get selectedClockOutCount() {
        if (!this.isClockOutActive) return 0;
        return Array.from(this.selectedMemberIds).filter(id => 
            this.clockOutMembers.some(m => m.mobMemberId === id)
        ).length;
    }

    get hasSelectedMembers() {
        return this.selectedMemberIds.size > 0;
    }

    get costCodeOptions() {
        return this.costCodes;
    }

    // Tab management
    get isClockInActive() {
        return this.activeTab === 'clockin';
    }

    get isClockOutActive() {
        return this.activeTab === 'clockout';
    }

    get clockInTabClass() {
        return this.activeTab === 'clockin' ? 'active' : '';
    }

    get clockOutTabClass() {
        return this.activeTab === 'clockout' ? 'active' : '';
    }

    get clockInMinBoundary() {
        const reference = this.currentJobStartDateTime || this.bulkClockInTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T00:00` : null;
    }

    get clockInMaxBoundary() {
        const reference = this.currentJobStartDateTime || this.bulkClockInTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T23:59` : null;
    }

    get clockOutMinBoundary() {
        const reference = this.currentJobEndDateTime || this.bulkClockOutTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T00:00` : null;
    }

    get clockOutMaxBoundary() {
        const reference = this.currentJobEndDateTime || this.bulkClockOutTime;
        const dateKey = this.extractDateKey(reference);
        if (!dateKey) return null;
        const nextDay = this.addDaysToDateKey(dateKey, 1);
        return nextDay ? `${nextDay}T23:59` : null;
    }

    /** 
    * Method Name: connectedCallback
    * @description: Lifecycle hook called when component is inserted into the DOM. Initiates permission check first
    */
    connectedCallback() {
        try {
            this.checkUserPermissions();
            this.overrideSLDS();
        } catch (error) {
            console.error('Error in connectedCallback:', error);
        }
    }

    /** 
    * Method Name: checkUserPermissions
    * @description: Check if user has required permissions to access this component (Admin or Crew Leader)
    */
    checkUserPermissions() {
        this.isLoading = true;
        
        if (!this.recordId) {
            this.hasAccess = false;
            this.hasData = false;
            this.accessErrorMessage = 'No Job ID provided. Please use this component from a Job record page.';
            this.isLoading = false;
            return;
        }
        
        checkUserAccess({ jobId: this.recordId })
            .then(result => {
                console.log('checkAccess result ::', result);
                
                this.hasAccess = result.hasAccess || false;
                this.accessErrorMessage = result.accessErrorMessage || '';
                
                if (this.hasAccess) {
                    // Proceed with loading mobilizations
                    this.loadMobilizations();
                } else {
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

    /** 
    * Method Name: loadMobilizations
    * @description: Loads mobilization dates for the job and auto-selects the first one
    */
    async loadMobilizations() {
        this.isLoading = true;
        try {
            const result = await getMobilizationsForJob({ jobId: this.recordId });
            console.log('Mobilization result:', result);
            
            this.hasMobilizations = result.hasMobilizations || false;
            
            if (!this.hasMobilizations) {
                this.hasData = false;
                this.errorMessage = result.message || 'No mobilizations found for this job';
                return;
            }
            
            this.mobilizationOptions = result.mobilizationOptions || [];
            this.selectedMobilizationId = result.defaultMobilizationId || '';
            
            // Auto-load members for default mobilization
            if (this.selectedMobilizationId) {
                this.loadMembers();
            }
            
        } catch (error) {
            console.error('Error in loadMobilizations:', error);
            this.hasMobilizations = false;
            this.errorMessage = 'Error loading mobilizations: ' + (error.body?.message || error.message);
            this.showToast('Error', this.errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: loadMembers
    * @description: Loads crew members for the selected mobilization with crew information
    */
    async loadMembers() {
        if (!this.selectedMobilizationId) return;
        
        this.isLoading = true;
        this.hasData = false; // Reset hasData to prevent flash of "No Members Found"
        this.selectedMemberIds = new Set(); // Reset selection
        
        try {
            const result = await getMobilizationMembersForSelection({ 
                mobId: this.selectedMobilizationId,
                jobId: this.recordId
            });
            console.log('Members result:', result);
            
            if (result.hasMembers) {
                this.hasData = true;
                this.clockInMembers = (result.clockInMembers || []).map(member => {
                    // Only show recent times if both clock in and clock out exist (completed session)
                    const hasRecentTimes = member.isAgain && member.recentClockIn && member.recentClockOut;
                    return {
                        ...member,
                        isSelected: false,
                        hasRecentTimes: hasRecentTimes,
                        recentClockIn: member.recentClockIn ? this.formatToAMPM(member.recentClockIn) : null,
                        recentClockOut: member.recentClockOut ? this.formatToAMPM(member.recentClockOut) : null
                    };
                });
                
                // Format clockInTime for display in clockOutMembers with AM/PM
                this.clockOutMembers = (result.clockOutMembers || []).map(member => {
                    // Only show recent times if both clock in and clock out exist (completed session)
                    const hasRecentTimes = member.recentClockIn && member.recentClockOut;
                    return {
                        ...member,
                        formattedClockInTime: member.clockInTime ? this.formatToAMPM(member.clockInTime) : '',
                        isSelected: false,
                        isFirstTime: !member.isAgain,
                        hasRecentTimes: hasRecentTimes,
                        recentClockIn: member.recentClockIn ? this.formatToAMPM(member.recentClockIn) : null,
                        recentClockOut: member.recentClockOut ? this.formatToAMPM(member.recentClockOut) : null
                    };
                });
                
                this.costCodes = result.costCodes || [];
                this.currentJobStartDateTime = result.jobStartDateTime;
                this.currentJobEndDateTime = result.jobEndDateTime;
                this.errorMessage = '';
                
                // Set default clock in time
                if (this.currentJobStartDateTime) {
                    this.bulkClockInTime = this.parseLiteral(this.currentJobStartDateTime);
                }
                
                // Set default clock out time
                if (this.currentJobEndDateTime) {
                    this.bulkClockOutTime = this.parseLiteral(this.currentJobEndDateTime);
                }
            } else {
                this.hasData = false;
                this.errorMessage = result.message || 'No members found for selected mobilization';
            }
            
        } catch (error) {
            console.error('Error in loadMembers:', error);
            this.hasData = false;
            this.errorMessage = 'Error loading members: ' + (error.body?.message || error.message);
            this.showToast('Error', this.errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: handleMemberSelection
    * @description: Toggles selection of individual member
    */
    handleMemberSelection(event) {
        const memberId = event.currentTarget.dataset.memberId;
        const isChecked = event.target.checked;
        
        if (isChecked) {
            this.selectedMemberIds.add(memberId);
        } else {
            this.selectedMemberIds.delete(memberId);
        }
        
        // Update member's selected state
        const currentList = this.isClockInActive ? this.clockInMembers : this.clockOutMembers;
        const member = currentList.find(m => m.mobMemberId === memberId);
        if (member) {
            member.isSelected = isChecked;
        }
        
        // Force reactivity
        this.selectedMemberIds = new Set(this.selectedMemberIds);
        
        if (this.isClockInActive) {
            this.clockInMembers = [...this.clockInMembers];
        } else {
            this.clockOutMembers = [...this.clockOutMembers];
        }
    }

    /** 
    * Method Name: parseLiteral
    * @description: Parses ISO date string to "YYYY-MM-DDTHH:MM" format for datetime-local input
    */
    parseLiteral(iso) {
        try {
            return iso ? iso.substring(0, 16) : '';
        } catch (error) {
            console.error('Error in parseLiteral:', error);
            return '';
        }
    }

    /** 
    * Method Name: formatToAMPM
    * @description: Formats ISO datetime string to 12-hour AM/PM format for display
    */
    formatToAMPM(iso) {
        try {
            if (!iso) return '';
            
            const parts = iso.split('T');
            if (parts.length < 2) return iso;
            
            const datePart = parts[0];
            const timePart = parts[1].substring(0, 5);
            
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
            return iso;
        }
    }

    /** 
    * Method Name: extractDateKey
    * @description: Extracts date portion (YYYY-MM-DD) from various datetime string formats
    */
    extractDateKey(value) {
        try {
            if (!value) return null;
            if (value.length === 10) return value;
            if (value.includes('T')) return value.split('T')[0];
            if (value.includes(' ')) return value.split(' ')[0];
            return value.substring(0, 10);
        } catch (error) {
            console.error('Error in extractDateKey:', error);
            return null;
        }
    }

    /** 
    * Method Name: addDaysToDateKey
    * @description: Adds specified number of days to a date string (YYYY-MM-DD format)
    */
    addDaysToDateKey(dateKey, days) {
        try {
            if (!dateKey || dateKey.length !== 10) return null;
            const parts = dateKey.split('-');
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            d.setDate(d.getDate() + days);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dy = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dy}`;
        } catch (error) {
            console.error('Error in addDaysToDateKey:', error);
            return null;
        }
    }

    /** 
    * Method Name: validateClockInDate
    * @description: Validates that clock in date matches job start date
    */
    validateClockInDate(clockInValue, jobStartValue) {
        const clockInDate = this.extractDateKey(clockInValue);
        const jobStartDate = this.extractDateKey(jobStartValue);

        if (clockInDate && jobStartDate && clockInDate !== jobStartDate) {
            this.showToast('Error', 'Clock In time must be on the job start date', 'error');
            return false;
        }

        return true;
    }

    /** 
    * Method Name: validateClockOutDate
    * @description: Validates that clock out date is within job start date, end date, or end date + 1
    */
    validateClockOutDate(clockOutValue, jobStartValue, jobEndValue) {
        const clockOutDate = this.extractDateKey(clockOutValue);
        const jobStartDate = this.extractDateKey(jobStartValue);
        const jobEndDate = this.extractDateKey(jobEndValue);

        if (clockOutDate && jobEndDate) {
            const nextDay = this.addDaysToDateKey(jobEndDate, 1);
            if (clockOutDate !== jobStartDate && clockOutDate !== jobEndDate && clockOutDate !== nextDay) {
                this.showToast('Error', 'Clock Out time must be on the job start date, job end date, or the following day', 'error');
                return false;
            }
        }

        return true;
    }

    /** 
    * Method Name: handleMobilizationChange
    * @description: Handles mobilization selection change event
    */
    handleMobilizationChange(event) {
        try {
            this.selectedMobilizationId = event.target.value;
            this.hasData = false;
            this.clockInMembers = [];
            this.clockOutMembers = [];
            this.selectedMemberIds = new Set();
            
            if (this.selectedMobilizationId) {
                this.loadMembers();
            }
        } catch (error) {
            console.error('Error in handleMobilizationChange:', error);
        }
    }

    /** 
    * Method Name: handleBulkInputChange
    * @description: Handles input changes for bulk clock in/out form fields
    */
    handleBulkInputChange(event) {
        try {
            const field = event.target.dataset.field;
            const value = event.target.value;
            
            if (field === 'bulkCostCode') {
                this.selectedBulkCostCodeId = value;
            } else if (field === 'bulkClockInTime') {
                this.bulkClockInTime = value;
            } else if (field === 'bulkClockOutTime') {
                this.bulkClockOutTime = value;
            }
        } catch (error) {
            console.error('Error in handleBulkInputChange:', error);
        }
    }

    /** 
    * Method Name: handleConfirmBulkClockIn
    * @description: Validates and processes bulk clock in for selected members
    */
    async handleConfirmBulkClockIn() {
        this.isLoading = true;
        try {
            // Get selected clock in members
            const selectedMembers = this.clockInMembers.filter(m => m.isSelected);
            
            if (selectedMembers.length === 0) {
                this.showToast('Warning', 'Please select at least one member to clock in', 'warning');
                return;
            }

            // Validation
            if (!this.bulkClockInTime) {
                this.showToast('Error', 'Please select clock in time', 'error');
                return;
            }

            if (!this.selectedBulkCostCodeId) {
                this.showToast('Error', 'Please select a cost code', 'error');
                return;
            }

            // Validate clock in time is within job date
            const clockInDate = this.extractDateKey(this.bulkClockInTime);
            const jobStartDate = this.extractDateKey(this.currentJobStartDateTime);

            if (clockInDate !== jobStartDate) {
                this.showToast('Error', 'Clock in time must be on the mobilization date', 'error');
                return;
            }

            // Prepare members data matching jobDetailsPage format
            const clockInMembers = selectedMembers.map(member => ({
                actionType: 'clockIn',
                jobId: this.recordId,
                mobId: this.selectedMobilizationId,
                contactId: member.contactId,
                costCodeId: this.selectedBulkCostCodeId,
                clockInTime: this.bulkClockInTime,
                isTimeSheetNull: member.isTimesheetNull,
                timesheetId: member.timesheetId,
                isTimeSheetEntryNull: member.isTimesheetEntryNull,
                timesheetEntryId: member.timesheetEntryId,
                mobMemberId: member.mobMemberId
            }));

            const clockInParams = {
                action: 'clockIn',
                members: clockInMembers
            };

            console.log('Clock in params:', JSON.stringify(clockInParams));

            const clockInResult = await bulkClockInOut({ params: JSON.stringify(clockInParams) });
            
            if (clockInResult.success) {
                this.showToast('Success', 'Successfully clocked in ' + clockInMembers.length + ' member(s)', 'success');
                // Reset form
                this.selectedBulkCostCodeId = '';
                this.selectedMemberIds = new Set();
                // Reload members
                await this.loadMembers();
            } else {
                this.showToast('Error', clockInResult.message || 'Failed to clock in', 'error');
            }
        } catch (error) {
            console.error('Error in handleConfirmBulkClockIn:', error);
            this.showToast('Error', 'Error: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: handleBulkClockOut
    * @description: Validates and processes bulk clock out for selected members
    */
    async handleBulkClockOut() {
        this.isLoading = true;
        try {
            // Get selected clock out members
            const selectedMembers = this.clockOutMembers.filter(m => m.isSelected);
            
            if (selectedMembers.length === 0) {
                this.showToast('Warning', 'Please select at least one member to clock out', 'warning');
                return;
            }

            // Validation
            if (!this.bulkClockOutTime) {
                this.showToast('Error', 'Please select clock out time', 'error');
                return;
            }

            // Validate clock out time is after clock in time for all selected members
            for (const member of selectedMembers) {
                if (member.clockInTime && new Date(this.bulkClockOutTime) <= new Date(member.clockInTime.slice(0, 16))) {
                    this.showToast('Error', `Clock Out time must be after Clock In time for ${member.contactName}`, 'error');
                    this.isLoading = false;
                    return;
                }
            }

            // Validate clock out time is within job date range
            const jobStartDate = this.extractDateKey(this.currentJobStartDateTime);
            const jobEndDate = this.extractDateKey(this.currentJobEndDateTime);
            if (!this.validateClockOutDate(this.bulkClockOutTime, jobStartDate, jobEndDate)) {
                this.isLoading = false;
                return;
            }

            // Prepare members data matching jobDetailsPage format
            const members = selectedMembers.map(member => ({
                actionType: 'clockOut',
                jobId: this.recordId,
                mobId: this.selectedMobilizationId,
                contactId: member.contactId,
                clockInTime: member.clockInTime || null,
                clockOutTime: this.bulkClockOutTime,
                isTimeSheetNull: member.isTimesheetNull,
                timesheetId: member.timesheetId,
                isTimeSheetEntryNull: member.isTimesheetEntryNull,
                timesheetEntryId: member.timesheetEntryId,
                mobMemberId: member.mobMemberId
            }));

            const params = {
                action: 'clockOut',
                members: members
            };

            console.log('Clock out params:', JSON.stringify(params));

            const result = await bulkClockInOut({ params: JSON.stringify(params) });
            
            if (result.success) {
                this.showToast('Success', 'Successfully clocked out ' + members.length + ' member(s)', 'success');
                this.selectedMemberIds = new Set();
                // Reload members
                await this.loadMembers();
            } else {
                this.showToast('Error', result.message || 'Failed to clock out', 'error');
            }
        } catch (error) {
            console.error('Error in handleBulkClockOut:', error);
            this.showToast('Error', 'Error: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: handleClockInTab
    * @description: Switches to the clock in tab view
    */
    handleClockInTab() {
        try {
            this.activeTab = 'clockin';
            // Uncheck all selections when switching tabs
            this.selectedMemberIds = new Set();
            this.clockInMembers = this.clockInMembers.map(m => ({ ...m, isSelected: false }));
            this.clockOutMembers = this.clockOutMembers.map(m => ({ ...m, isSelected: false }));
        } catch (error) {
            console.error('Error in handleClockInTab:', error);
        }
    }

    /** 
    * Method Name: handleClockOutTab
    * @description: Switches to the clock out tab view
    */
    handleClockOutTab() {
        try {
            this.activeTab = 'clockout';
            // Uncheck all selections when switching tabs
            this.selectedMemberIds = new Set();
            this.clockInMembers = this.clockInMembers.map(m => ({ ...m, isSelected: false }));
            this.clockOutMembers = this.clockOutMembers.map(m => ({ ...m, isSelected: false }));
        } catch (error) {
            console.error('Error in handleClockOutTab:', error);
        }
    }

    /** 
    * Method Name: handleClose
    * @description: Closes the quick action modal screen
    */
    handleClose() {
        try {
            this.dispatchEvent(new CloseActionScreenEvent());
        } catch (error) {
            console.error('Error in handleClose:', error);
        }
    }

    /** 
    * Method Name: handleClosePopup
    * @description: Dispatches custom event to parent component to close the popup (for home page)
    */
    handleClosePopup() {
        try {
            const closeEvent = new CustomEvent('closepopup');
            this.dispatchEvent(closeEvent);
        } catch (error) {
            console.error('Error in handleClosePopup:', error);
        }
    }

    /** 
    * Method Name: showToast
    * @description: Displays a toast notification message
    */
    showToast(title, message, variant) {
        try {
            this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
        } catch (error) {
            console.error('Error in showToast:', error);
        }
    }

    overrideSLDS(){
        let style = document.createElement('style');
        style.innerText = `
                .uiModal--medium .modal-container {
                    width: 70%;
                    max-width: 840px;
                    min-width: min(480px, calc(100% - 2rem));
                    margin-inline: auto;
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
        `;
        this.template.host.appendChild(style);
    }
}