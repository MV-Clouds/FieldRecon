import { LightningElement, api, track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import checkCrewLeaderAccess from '@salesforce/apex/GlobalClockInOutController.checkCrewLeaderAccess';
import getMobilizationDates from '@salesforce/apex/GlobalClockInOutController.getMobilizationDates';
import getMobilizationMembers from '@salesforce/apex/GlobalClockInOutController.getMobilizationMembers';
import bulkClockInOut from '@salesforce/apex/GlobalClockInOutController.bulkClockInOut';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CloseActionScreenEvent } from 'lightning/actions';

export default class GlobalClockInOut extends LightningElement {
    @track recordId; // Job Id from quick action context
    @track isLoading = false;
    @track selectedMobilizationId = '';
    @track clockInMembers = [];
    @track clockOutMembers = [];
    @track costCodes = []; 
    @track selectedCostCodeId = '';
    @track hasData = false;
    @track errorMessage = '';
    @track isCrewLeader = false;
    @track crewLeaderId = '';
    @track crewOptions = [];
    @track selectedCrewId = '';
    @track mobilizationOptions = [];
    @track hasMobilizations = false;
    @track selectedBulkCostCodeId = '';
    @track bulkClockInTime = '';
    @track bulkClockOutTime = '';
    @track currentJobStartDateTime;
    @track currentJobEndDateTime;
    @track activeTab = 'clockin'; // Track active tab

    // Getters
    get hasCrewOptions() {
        return this.crewOptions && this.crewOptions.length > 0;
    }

    get showCrewSelector() {
        return this.isCrewLeader && this.crewOptions.length > 1;
    }

    get hasSelectedCrew() {
        return this.selectedCrewId !== '';
    }

    get showMobilizationSelector() {
        return this.hasSelectedCrew && this.hasMobilizations;
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
    * Method Name: setCurrentPageReference
    * @description: Wire method to set the current page reference and extract recordId from page state
    */
    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        try {
            console.log(pageRef);
            this.recordId = pageRef.state.recordId;
        } catch (error) {
            console.error('Error in setCurrentPageReference:', error);
        }
    }

    /** 
    * Method Name: connectedCallback
    * @description: Lifecycle hook called when component is inserted into the DOM. Initiates access check if recordId is available
    */
    connectedCallback() {
        try {
            // recordId is automatically set from quick action context
            if (this.recordId) {
                this.checkAccess();
            } else {
                this.hasData = false;
                this.errorMessage = 'No Job ID provided. Please use this component from a Job record page.';
            }
        } catch (error) {
            console.error('Error in connectedCallback:', error);
        }
    }

    /** 
    * Method Name: checkAccess
    * @description: Checks if the current user is a crew leader and has access to the component. Sets up crew options if access is granted
    */
    async checkAccess() {
        this.isLoading = true;
        try {
            const result = await checkCrewLeaderAccess({ jobId: this.recordId });
            console.log('Access check result:', result);
            
            this.isCrewLeader = result.isCrewLeader || false;
            
            if (!this.isCrewLeader) {
                this.hasData = false;
                this.errorMessage = result.message || 'Only Crew Leaders can access this page';
                this.showToast('Access Denied', this.errorMessage, 'error');
                return;
            }
            
            // User is crew leader - setup crew options
            this.crewLeaderId = result.crewLeaderId;
            this.crewOptions = result.crewOptions || [];
            
            // Auto-select if only one crew
            if (this.crewOptions.length === 1) {
                this.selectedCrewId = this.crewOptions[0].value;
                this.loadMobilizations();
            }
            
        } catch (error) {
            console.error('Error in checkAccess:', error);
            this.hasData = false;
            this.isCrewLeader = false;
            this.errorMessage = 'Error checking access: ' + (error.body?.message || error.message);
            this.showToast('Error', this.errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: loadMobilizations
    * @description: Loads mobilization dates for the selected crew and auto-selects today's date if available
    */
    async loadMobilizations() {
        if (!this.selectedCrewId) return;
        
        this.isLoading = true;
        try {
            const result = await getMobilizationDates({ 
                jobId: this.recordId,
                crewLeaderId: this.crewLeaderId,
                crewId: this.selectedCrewId
            });
            console.log('Mobilization dates result:', result);
            
            this.hasMobilizations = result.hasMobilizations || false;
            
            if (!this.hasMobilizations) {
                this.hasData = false;
                this.errorMessage = result.message || 'No mobilizations found for selected crew';
                return;
            }
            
            this.mobilizationOptions = result.mobilizationOptions || [];
            
            // Auto-select today's date if available
            const today = new Date().toISOString().split('T')[0];
            const todayMob = this.mobilizationOptions.find(mob => mob.label.includes(today));
            if (todayMob) {
                this.selectedMobilizationId = todayMob.value;
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
    * @description: Loads crew members for the selected mobilization, formats clock in times, and sets default clock in/out times
    */
    async loadMembers() {
        if (!this.selectedMobilizationId || !this.selectedCrewId) return;
        
        this.isLoading = true;
        try {
            const result = await getMobilizationMembers({ 
                mobId: this.selectedMobilizationId,
                jobId: this.recordId,
                crewLeaderId: this.crewLeaderId,
                crewId: this.selectedCrewId
            });
            console.log('Members result:', result);
            
            if (result.hasMembers) {
                this.hasData = true;
                this.clockInMembers = result.clockInMembers || [];
                
                // Format clockInTime for display in clockOutMembers with AM/PM
                this.clockOutMembers = (result.clockOutMembers || []).map(member => ({
                    ...member,
                    formattedClockInTime: member.clockInTime ? this.formatToAMPM(member.clockInTime) : ''
                }));
                
                this.costCodes = result.costCodes || [];
                this.currentJobStartDateTime = result.jobStartDateTime;
                this.currentJobEndDateTime = result.jobEndDateTime;
                this.errorMessage = '';
                
                // Set default clock in time (already in user timezone from apex)
                if (this.currentJobStartDateTime) {
                    this.bulkClockInTime = this.parseLiteral(this.currentJobStartDateTime);
                }
                
                // Set default clock out time (already in user timezone from apex)
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
    * Method Name: parseLiteral
    * @description: Parses ISO date string to "YYYY-MM-DDTHH:MM" format for datetime-local input
    */
    parseLiteral(iso) {
        try {
            return iso ? iso.slice(0, 16) : ''; // "2025-10-05T07:00"
        } catch (error) {
            console.error('Error in parseLiteral:', error);
            return '';
        }
    }

    /** 
    * Method Name: formatToAMPM
    * @description: Formats ISO datetime string to 12-hour AM/PM format for display (e.g., "2025-10-05 2:30 PM")
    */
    formatToAMPM(iso) {
        try {
            if (!iso) return '';
            
            // Extract date and time parts from ISO string
            // Format: "2025-10-05T14:30:00.000Z" or "2025-10-05T14:30"
            const parts = iso.split('T');
            if (parts.length < 2) return iso;
            
            const datePart = parts[0]; // "2025-10-05"
            const timePart = parts[1].substring(0, 5); // "14:30"
            
            // Extract hours and minutes
            const [hoursStr, minutesStr] = timePart.split(':');
            let hours = parseInt(hoursStr, 10);
            const minutes = minutesStr;
            
            // Determine AM/PM
            const ampm = hours >= 12 ? 'PM' : 'AM';
            
            // Convert to 12-hour format
            hours = hours % 12;
            hours = hours ? hours : 12; // hour '0' should be '12'
            
            // Format: "2025-10-05 02:30 PM"
            return `${datePart} ${hours}:${minutes} ${ampm}`;
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
    * @description: Adds specified number of days to a date string (YYYY-MM-DD format) and returns the new date
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
    * Method Name: handleCrewChange
    * @description: Handles crew selection change event, resets dependent data, and loads mobilizations for selected crew
    */
    handleCrewChange(event) {
        try {
            this.selectedCrewId = event.target.value;
            this.selectedMobilizationId = '';
            this.mobilizationOptions = [];
            this.hasMobilizations = false;
            this.hasData = false;
            this.clockInMembers = [];
            this.clockOutMembers = [];
            
            if (this.selectedCrewId) {
                this.loadMobilizations();
            }
        } catch (error) {
            console.error('Error in handleCrewChange:', error);
        }
    }

    /** 
    * Method Name: handleMobilizationChange
    * @description: Handles mobilization selection change event, resets member data, and loads members for selected mobilization
    */
    handleMobilizationChange(event) {
        try {
            this.selectedMobilizationId = event.target.value;
            this.hasData = false;
            this.clockInMembers = [];
            this.clockOutMembers = [];
            
            if (this.selectedMobilizationId) {
                this.loadMembers();
            }
        } catch (error) {
            console.error('Error in handleMobilizationChange:', error);
        }
    }

    /** 
    * Method Name: handleBulkInputChange
    * @description: Handles input changes for bulk clock in/out form fields (cost code, clock in time, clock out time)
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
    * @description: Validates and processes bulk clock in for all members in the clock in list
    */
    async handleConfirmBulkClockIn() {
        this.isLoading = true;
        try {
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

            // Step 1: Clock In all members
            const clockInMembers = this.clockInMembers.map(member => ({
                actionType: 'clockIn',
                jobId: this.recordId,
                mobId: this.selectedMobilizationId,
                mobMemberId: member.mobMemberId,
                timesheetId: member.timesheetId,
                isTimesheetNull: member.isTimesheetNull,
                isTimesheetEntryNull: member.isTimesheetEntryNull,
                clockInTime: this.bulkClockInTime,
                costCodeId: this.selectedBulkCostCodeId
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
                // Reload members and switch to clock out tab
                await this.loadMembers();
                this.activeTab = 'clockout';
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
    * @description: Validates and processes bulk clock out for all members in the clock out list
    */
    async handleBulkClockOut() {
        this.isLoading = true;
        try {
            if (this.clockOutMembers.length === 0) {
                this.showToast('Warning', 'No members available to clock out', 'warning');
                return;
            }

            // Validation
            if (!this.bulkClockOutTime) {
                this.showToast('Error', 'Please select clock out time', 'error');
                return;
            }

            const members = this.clockOutMembers.map(member => ({
                actionType: 'clockOut',
                jobId: this.recordId,
                mobId: this.selectedMobilizationId,
                mobMemberId: member.mobMemberId,
                timesheetId: member.timesheetId,
                timesheetEntryId: member.timesheetEntryId,
                isTimesheetNull: member.isTimesheetNull,
                isTimesheetEntryNull: member.isTimesheetEntryNull,
                clockInTime: member.clockInTime || null,
                clockOutTime: this.bulkClockOutTime
            }));

            const params = {
                action: 'clockOut',
                members: members
            };

            console.log('Clock out params:', JSON.stringify(params));

            const result = await bulkClockInOut({ params: JSON.stringify(params) });
            
            if (result.success) {
                this.showToast('Success', 'Successfully clocked out ' + members.length + ' member(s)', 'success');
                // Reload members and switch back to clock in tab
                await this.loadMembers();
                this.activeTab = 'clockin';
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
    * Method Name: showToast
    * @description: Displays a toast notification message with specified title, message, and variant (success/error/warning)
    */
    showToast(title, message, variant) {
        try {
            this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
        } catch (error) {
            console.error('Error in showToast:', error);
        }
    }
}