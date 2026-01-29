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
    @api initialMobilizationId; // Optional: Mobilization Id to pre-select
    @api initialDate; // Optional: Date to fetch mobilizations for (YYYY-MM-DD)
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
    @track activeTab = 'clockin'; // Track active tab
    @track selectedMemberIds = new Set(); // Track selected member IDs
    @track currentDisplayTime;
    @track currentDateTimeForApex;
    @track timeUpdateInterval;
    
    @track mobilizationDateMap = {};
    @track selectedMobilizationDate = '';

    // Getters
    get effectiveDate() {
        return this.initialDate || this.getClientDateString();
    }

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

    get isAllClockInSelected() {
        if (!this.hasClockInMembers) return false;
        return this.clockInMembers.every(m => m.isSelected);
    }

    get isAllClockOutSelected() {
        if (!this.hasClockOutMembers) return false;
        return this.clockOutMembers.every(m => m.isSelected);
    }

    get clockInTabClass() {
        return this.activeTab === 'clockin' ? 'active' : '';
    }

    get clockOutTabClass() {
        return this.activeTab === 'clockout' ? 'active' : '';
    }

    get isDesktopDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /iphone|ipad|ipod|android|blackberry|windows phone|mobile/i.test(userAgent);
        const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);
        return !isMobile && !isTablet;
    }

    get popupCSS() {
        return this.isHomePage ? (this.isDesktopDevice ? 'slds-modal slds-fade-in-open slds-modal_medium' : 'slds-modal slds-fade-in-open slds-modal_full') : '';
    }

    get backdropCSS() {
        return this.isHomePage ? 'slds-backdrop slds-backdrop_open sub-backdrop' : '';
    }

    get containerCSS() {
        return this.isHomePage ? 'slds-modal__container' : '';
    }

    get subContainerCSS() {
        return this.isHomePage ? 'slds-modal__content wizard-content' : 'wizard-content';
    }

    /** 
    * Method Name: connectedCallback
    * @description: Lifecycle hook called when component is inserted into the DOM. Initiates permission check first
    */
    connectedCallback() {
        try {
            this.updateCurrentTime();
            this.timeUpdateInterval = setInterval(() => {
                this.updateCurrentTime();
            }, 1000);
            
            this.checkUserPermissions();
            this.overrideSLDS();
        } catch (error) {
            console.error('Error in connectedCallback:', error);
        }
    }

    /** 
    * Method Name: updateCurrentTime
    * @description: Updates the current date and time in both Apex-compatible and display formats.
    */
    updateCurrentTime() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        // Format for Apex: 2025-12-15T13:00
        this.currentDateTimeForApex = `${year}-${month}-${day}T${hours}:${minutes}`;
        
        // Format for Display: Dec 15, 2025, 01:00 PM
        this.currentDisplayTime = this.formatToAMPM(this.currentDateTimeForApex);
    }

    /**
     * Method Name: getClientDateString
     * Get the client date string in YYYY-MM-DD format
     * @returns {string} Client date string in YYYY-MM-DD format
     */
    getClientDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const clientDateString = `${year}-${month}-${day}`;
        return clientDateString;
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
        
        checkUserAccess({ jobId: this.recordId, clientDate: this.effectiveDate })
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

    /** * Method Name: getCurrentLocation 
    * @description: Gets the current geolocation with permission handling
    * @return: Promise that resolves with {latitude, longitude} or null
    */
    async getCurrentLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                console.error('Geolocation is not supported by this browser.');
                resolve(null);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                (error) => {
                    console.error('Error getting location:', error.message);
                    resolve(null);
                }
            );
        });
    }

    /** 
    * Method Name: loadMobilizations
    * @description: Loads mobilization dates for the job and auto-selects the first one
    */
    async loadMobilizations() {
        this.isLoading = true;
        try {
            const result = await getMobilizationsForJob({ 
                jobId: this.recordId,
                clientDate: this.effectiveDate 
            });

            console.log('Mobilization result:', result);
            
            this.hasMobilizations = result.hasMobilizations || false;
            
            if (!this.hasMobilizations) {
                this.hasData = false;
                this.errorMessage = result.message || 'No mobilizations found for this job';
                return;
            }
            
            this.mobilizationOptions = result.mobilizationOptions || [];
            this.mobilizationDateMap = result.mobilizationDates || {};
            
            // Prioritize initialMobilizationId if provided
            this.selectedMobilizationId = this.initialMobilizationId || result.defaultMobilizationId || '';
            
            // Auto-load members for default mobilization
            if (this.selectedMobilizationId) {
                this.updateSelectedMobilizationDate();
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
                this.errorMessage = '';

                // Auto-switch tabs based on member availability
                if (this.clockInMembers.length === 0 && this.clockOutMembers.length > 0) {
                    this.activeTab = 'clockout';
                } else if (this.clockOutMembers.length === 0 && this.clockInMembers.length > 0) {
                    this.activeTab = 'clockin';
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
    * Method Name: handleSelectAllClockIn
    * @description: Selects or deselects all clock in members
    */
    handleSelectAllClockIn(event) {
        const isChecked = event.target.checked;
        
        if (isChecked) {
            // Select all clock in members
            this.clockInMembers.forEach(member => {
                this.selectedMemberIds.add(member.mobMemberId);
                member.isSelected = true;
            });
        } else {
            // Deselect all clock in members
            this.clockInMembers.forEach(member => {
                this.selectedMemberIds.delete(member.mobMemberId);
                member.isSelected = false;
            });
        }
        
        // Force reactivity
        this.selectedMemberIds = new Set(this.selectedMemberIds);
        this.clockInMembers = [...this.clockInMembers];
    }

    /** 
    * Method Name: handleSelectAllClockOut
    * @description: Selects or deselects all clock out members
    */
    handleSelectAllClockOut(event) {
        const isChecked = event.target.checked;
        
        if (isChecked) {
            // Select all clock out members
            this.clockOutMembers.forEach(member => {
                this.selectedMemberIds.add(member.mobMemberId);
                member.isSelected = true;
            });
        } else {
            // Deselect all clock out members
            this.clockOutMembers.forEach(member => {
                this.selectedMemberIds.delete(member.mobMemberId);
                member.isSelected = false;
            });
        }
        
        // Force reactivity
        this.selectedMemberIds = new Set(this.selectedMemberIds);
        this.clockOutMembers = [...this.clockOutMembers];
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
    * Method Name: handleMobilizationChange
    * @description: Handles mobilization selection change event
    */
    handleMobilizationChange(event) {
        try {
            this.selectedMobilizationId = event.target.value;
            this.updateSelectedMobilizationDate();
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
     * Method Name: updateSelectedMobilizationDate
     * @description: Updates the displayed date based on the selected mobilization ID
     */
    updateSelectedMobilizationDate() {
        if (this.selectedMobilizationId && this.mobilizationDateMap) {
            this.selectedMobilizationDate = this.mobilizationDateMap[this.selectedMobilizationId];
        } else {
            this.selectedMobilizationDate = '';
        }
    }

    /** * Method Name: handleBulkInputChange
    * @description: Handles input changes for bulk clock in/out form fields
    */
    handleBulkInputChange(event) {
        try {
            const field = event.target.dataset.field;
            const value = event.target.value;
            
            if (field === 'bulkCostCode') {
                this.selectedBulkCostCodeId = value;
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
            const selectedMembers = this.clockInMembers.filter(m => m.isSelected);
            
            if (selectedMembers.length === 0) {
                this.showToast('Warning', 'Please select at least one member to clock in', 'warning');
                return;
            }

            if (!this.selectedBulkCostCodeId) {
                this.showToast('Error', 'Please select a cost code', 'error');
                return;
            }

            this.updateCurrentTime();

            const location = await this.getCurrentLocation();

            console.log('Current location:', location);
            

            const clockInMembers = selectedMembers.map(member => ({
                actionType: 'clockIn',
                jobId: this.recordId,
                mobId: this.selectedMobilizationId,
                contactId: member.contactId,
                costCodeId: this.selectedBulkCostCodeId,
                clockInTime: this.currentDateTimeForApex,
                isTimeSheetNull: member.isTimeSheetNull,
                timesheetId: member.timesheetId,
                isTimeSheetEntryNull: member.isTimeSheetEntryNull,
                timesheetEntryId: member.timesheetEntryId,
                mobMemberId: member.mobMemberId,
                latitude: location?.latitude || null,
                longitude: location?.longitude || null
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

            const location = await this.getCurrentLocation();
            console.log('Current location:', location);

            // Prepare members data matching jobDetailsPage format
            const members = selectedMembers.map(member => ({
                actionType: 'clockOut',
                jobId: this.recordId,
                mobId: this.selectedMobilizationId,
                contactId: member.contactId,
                clockInTime: member.clockInTime || null,
                clockOutTime: this.currentDateTimeForApex,
                isTimeSheetNull: member.isTimeSheetNull,
                timesheetId: member.timesheetId,
                isTimeSheetEntryNull: member.isTimeSheetEntryNull,
                timesheetEntryId: member.timesheetEntryId,
                mobMemberId: member.mobMemberId,
                latitude: location?.latitude || null,
                longitude: location?.longitude || null
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

    /** 
    * Method Name: overrideSLDS
    * @description: Overrides default SLDS styles for modal customization
    */
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

    /** 
    * Method Name: disconnectedCallback
    * @description: Cleans up the interval timer when the component is removed from the DOM.
    */
    disconnectedCallback() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
    }
}