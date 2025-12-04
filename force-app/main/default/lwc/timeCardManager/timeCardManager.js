import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAllContactsWithDetails from '@salesforce/apex/TimeCardManagerController.getAllContactsWithDetails';
import checkPermissionSetsAssigned from '@salesforce/apex/PermissionsUtility.checkPermissionSetsAssigned';

export default class TimeCardManager extends NavigationMixin(LightningElement) {
    @track isLoading = true;
    @track hasAccess = false;
    @track accessErrorMessage = 'You don\'t have permission to access this.';
    @track contactDetails = [];
    @track filteredContactDetails = [];
    @track searchTerm = '';
    @track customStartDate = this.getDefaultStartDate();
    @track customEndDate = this.getDefaultEndDate();

    // Table column configuration
    @track contactColumns = [
        { label: 'S.No.', fieldName: 'serialNumber' },
        { label: 'Actions', fieldName: 'actions'},
        { label: 'Contact Name', fieldName: 'contactName', recordLink: false },
        { label: 'Email', fieldName: 'email' },
        { label: 'Phone', fieldName: 'phone' },
        { label: 'Total Man Hours', fieldName: 'totalManHours' },
        { label: 'Total Man Hours + Travel Time', fieldName: 'totalManHoursWithTravel' }
    ];

    // Mobilization table columns
    @track mobilizationColumns = [
        { label: 'S.No.', fieldName: 'serialNumber' },
        { label: 'Actions', fieldName: 'actions' },
        { label: 'Job Number', fieldName: 'jobNumber', isJobLink: true },
        { label: 'Job Name', fieldName: 'jobName' },
        { label: 'Start Date Time', fieldName: 'startDate', isDateTime: true },
        { label: 'End Date Time', fieldName: 'endDate', isDateTime: true },
        { label: 'Man Hours Per Job', fieldName: 'totalManHours', isNumber: true },
        { label: 'Man Hours + Travel Time', fieldName: 'totalManHoursWithTravel', isNumber: true },
        { label: 'Job Address', fieldName: 'jobAddress' },
        { label: 'Description', fieldName: 'jobDescription' }
    ];

    // Modal properties
    @track isTimesheetModalOpen = false;
    @track selectedTimesheetEntries = [];
    @track timesheetColumns = [
        { label: 'Sr. No.', fieldName: 'serialNumber' },
        { label: 'Contact Name', fieldName: 'contactName' },
        { label: 'Clock In Time', fieldName: 'clockInTime' },
        { label: 'Clock Out Time', fieldName: 'clockOutTime' },
        { label: 'Work Hours', fieldName: 'workHours'},
        { label: 'Travel Time', fieldName: 'travelTime'},
        { label: 'Per Diem', fieldName: 'perDiem'},
        { label: 'Total Time', fieldName: 'totalTime'},
        { label: 'Premium', fieldName: 'premium'},
        { label: 'Cost Code', fieldName: 'costCode'}
    ];

    normalizeDate(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    /**
     * Method Name: getDefaultStartDate
     * @description: Get default start date (previous Sunday or current day if today is Sunday)
     */
    getDefaultStartDate() {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        if (dayOfWeek === 0) {
            // Today is Sunday, use today
            const start = this.normalizeDate(new Date(today));
            let currentDate = start.toLocaleDateString('en-CA');
            return currentDate;
        } else {
            // Go back to previous Sunday
            const daysToSubtract = dayOfWeek;
            const previousSunday = new Date(today);
            previousSunday.setDate(today.getDate() - daysToSubtract);
            const start = this.normalizeDate(new Date(previousSunday));
            let currentDate = start.toLocaleDateString('en-CA');
            return currentDate;
        }
    }

    /**
     * Method Name: getDefaultEndDate
     * @description: Get default end date (next Saturday or current day if today is Saturday)
     */
    getDefaultEndDate() {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        if (dayOfWeek === 6) {
            // Today is Saturday, use today
            const start = this.normalizeDate(new Date(today));
            let currentDate = start.toLocaleDateString('en-CA');
            return currentDate;
        } else {
            // Go forward to next Saturday
            const daysToAdd = 6 - dayOfWeek;
            const nextSaturday = new Date(today);
            nextSaturday.setDate(today.getDate() + daysToAdd);
            const start = this.normalizeDate(new Date(nextSaturday));
            let currentDate = start.toLocaleDateString('en-CA');
            return currentDate;
        }
    }

    /**
     * Method Name: connectedCallback
     * @description: Initialize component
     */
    connectedCallback() {
        this.checkUserPermissions();
    }

    /**
     * Method Name: checkUserPermissions
     * @description: Check if user has required permissions to access this component
     */
    checkUserPermissions() {
        const permissionSetsToCheck = ['FR_Admin'];
        
        checkPermissionSetsAssigned({ psNames: permissionSetsToCheck })
            .then(result => {
                const assignedMap = result.assignedMap || {};
                const isAdmin = result.isAdmin || false;
                
                const hasFRAdmin = assignedMap['FR_Admin'] || false;
                
                if (isAdmin || hasFRAdmin) {
                    this.hasAccess = true;
                    this.loadContactDetails();
                } else {
                    this.hasAccess = false;
                    this.accessErrorMessage = "You don't have permission to access this page. Please contact your system administrator to request the FR_Admin permission set.";
                }
            })
            .catch(error => {
                this.hasAccess = false;
                this.accessErrorMessage = 'An error occurred while checking permissions. Please try again or contact your system administrator.';
                console.error('Error checking permissions:', error);
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Method Name: loadContactDetails
     * @description: Load contact details with mobilization data
     */
    loadContactDetails() {
        this.isLoading = true;
        
        const startDate = this.customStartDate ? new Date(this.customStartDate) : null;
        const endDate = this.customEndDate ? new Date(this.customEndDate) : null;

        getAllContactsWithDetails({ 
            customStartDate: startDate, 
            customEndDate: endDate 
        })
        .then(result => {
            if (result && Array.isArray(result)) {
                this.contactDetails = result.map(contact => ({
                    ...contact,
                    showMobilizationDetails: false
                }));
                this.processContactData();
            } else {
                this.contactDetails = [];
                this.filteredContactDetails = [];
            }
        })
        .catch(() => {
            this.showToast('Error', 'Unable to load contact details. Please try again.', 'error');
            this.contactDetails = [];
            this.filteredContactDetails = [];
        })
        .finally(() => {
            this.isLoading = false;
        });
    }

    /**
     * Method Name: processMobilizationGroups
     * @description: Helper method to process mobilization groups for display
     */
    processMobilizationGroups(mobilizationGroups) {
        return (mobilizationGroups || []).map((mobilization, mobIndex) => {
            const mobDisplayFields = this.mobilizationColumns.map(column => {
                const key = column.fieldName;
                let value;

                if (key === 'serialNumber') {
                    value = (mobIndex + 1).toString();
                } else if (key === 'actions') {
                    value = 'View Timesheet';
                } else {
                    value = this.getFieldValue(mobilization, key);
                }
                
                // Format the display value based on field type
                let displayValue = value || '--';
                
                if (column.isDateTime && value && key !== 'serialNumber' && key !== 'actions') {
                    displayValue = this.formatToAMPM(value);
                } else if (column.isNumber && value !== null && value !== undefined && key !== 'serialNumber' && key !== 'actions') {
                    displayValue = parseFloat(value).toFixed(2);
                } else if (value !== null && value !== undefined && String(value).trim() !== '' && key !== 'serialNumber' && key !== 'actions') {
                    displayValue = String(value);
                } else if (key === 'serialNumber' || key === 'actions') {
                    displayValue = value;
                } else {
                    displayValue = '--';
                }
                
                return {
                    key: key,
                    value: displayValue,
                    rawValue: value,
                    isJobLink: column.isJobLink || false,
                    isDateTime: column.isDateTime || false,
                    isNumber: column.isNumber || false,
                    isAction: key === 'actions',
                    hasValue: value !== null && value !== undefined && String(value).trim() !== ''
                };
            });

            return {
                ...mobilization,
                displayFields: mobDisplayFields
            };
        });
    }

    /**
     * Method Name: processContactRow
     * @description: Helper method to process a single contact row
     */
    processContactRow(contact, index) {
        const values = this.contactColumns.map(col => {
            let value = '';
            let recordLink = false;
            let isAction = false;

            switch (col.fieldName) {
                case 'serialNumber':
                    value = (index + 1).toString();
                    break;
                case 'actions':
                    value = contact.showMobilizationDetails ? 'Collapse' : 'Expand';
                    isAction = true;
                    break;
                case 'contactName':
                    value = contact.contactName || '--';
                    recordLink = col.recordLink || false;
                    break;
                case 'email':
                    value = contact.email || '--';
                    break;
                case 'phone':
                    value = contact.phone || '--';
                    break;
                case 'totalManHours':
                    value = contact.totalManHours ? contact.totalManHours.toFixed(2) : '0.00';
                    break;
                case 'totalManHours':
                    value = contact.totalManHours !== undefined ? contact.totalManHours.toFixed(2) : '0.00';
                    break;
                case 'totalManHoursWithTravel':
                    value = contact.totalManHoursWithTravel !== undefined ? contact.totalManHoursWithTravel.toFixed(2) : '0.00';
                    break;
                default:
                    value = contact[col.fieldName] || '--';
            }

            return {
                fieldName: col.fieldName,
                value: value,
                style: col.style || '',
                recordLink: recordLink,
                isAction: isAction
            };
        });

        return {
            contactId: contact.contactId,
            contactName: contact.contactName || '--',
            values: values,
            showMobilizationDetails: contact.showMobilizationDetails,
            mobilizationGroups: this.processMobilizationGroups(contact.mobilizationGroups)
        };
    }

    /**
     * Method Name: processContactData
     * @description: Process contact data for table display
     */
    processContactData() {
        try {
            const processedData = this.contactDetails.map((contact, index) => {
                return this.processContactRow(contact, index);
            });

            this.filteredContactDetails = processedData;            
            this.applySearch();
        } catch (error) {
            this.filteredContactDetails = [];
            console.log('Error processing contact data ==> ', error);
        }
    }

    /**
     * Method Name: formatToAMPM
     * @description: Formats ISO datetime string to 12-hour AM/PM format for display (e.g., "Nov 12, 2025, 03:45 PM")
     */
    formatToAMPM(iso) {
        try {
            if (!iso) return '--';
            
            // Extract date and time parts from ISO string
            // Format: "2025-10-05T14:30:00.000Z" or "2025-10-05T14:30"
            const parts = iso.split('T');
            if (parts.length < 2) return iso;
            
            const datePart = parts[0]; // "2025-10-05"
            const timePart = parts[1].substring(0, 5); // "14:30"
            
            // Parse date components
            const [year, month, day] = datePart.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = monthNames[parseInt(month, 10) - 1];
            
            // Extract hours and minutes
            const [hoursStr, minutesStr] = timePart.split(':');
            let hours = parseInt(hoursStr, 10);
            const minutes = minutesStr;
            
            // Determine AM/PM
            const ampm = hours >= 12 ? 'PM' : 'AM';
            
            // Convert to 12-hour format
            hours = hours % 12;
            hours = hours ? hours : 12; // hour '0' should be '12'
            
            // Pad hours with leading zero if needed
            const paddedHours = String(hours).padStart(2, '0');
            
            // Format: "Nov 12, 2025, 03:45 PM"
            return `${monthName} ${parseInt(day, 10)}, ${year}, ${paddedHours}:${minutes} ${ampm}`;
        } catch (error) {
            console.error('Error in formatToAMPM:', error);
            return '--';
        }
    }

    /**
     * Method Name: getFieldValue
     * @description: Get field value from nested object structure
     */
    getFieldValue(record, fieldName) {
        if (!record || !fieldName) return null;
        
        if (record.hasOwnProperty(fieldName)) {
            return record[fieldName];
        }
        
        if (fieldName.includes('.')) {
            const parts = fieldName.split('.');
            let current = record;
            for (let part of parts) {
                if (current && current[part] !== undefined) {
                    current = current[part];
                } else {
                    return null;
                }
            }
            return current;
        }
        
        return null;
    }

    /**
     * Method Name: applySearch
     * @description: Apply search filter
     */
    applySearch() {
        if (!this.searchTerm) {
            this.filteredContactDetails = this.contactDetails.map((contact, index) => {
                return this.processContactRow(contact, index);
            });
            return;
        }

        const searchLower = this.searchTerm.toLowerCase();
        const filtered = this.contactDetails.filter(contact => {
            return contact.contactName && contact.contactName.toLowerCase().includes(searchLower);
        });

        this.filteredContactDetails = filtered.map((contact, index) => {
            return this.processContactRow(contact, index);
        });
    }

    /**
     * Method Name: handleSearch
     * @description: Handle search input change
     */
    handleSearch(event) {
        this.searchTerm = event.target.value;
        this.applySearch();
    }

    /**
     * Method Name: handleCustomStartDateChange
     * @description: Handle start date change
     */
    handleCustomStartDateChange(event) {
        this.customStartDate = event.target.value;
        this.loadContactDetails();
    }

    /**
     * Method Name: handleCustomEndDateChange
     * @description: Handle end date change
     */
    handleCustomEndDateChange(event) {
        this.customEndDate = event.target.value;
        this.loadContactDetails();
    }

    /**
     * Method Name: handleLinkClick
     * @description: Handle contact or job link clicks
     */
    handleLinkClick(event) {
        const recordId = event.currentTarget.dataset.recordId;

        this[NavigationMixin.GenerateUrl]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                actionName: 'view'
            }
        }).then(url => {
            window.open(url, "_blank");
        });
    }

    /**
     * Method Name: handleToggleMobilization
     * @description: Toggle mobilization details display
     */
    handleToggleMobilization(event) {

        try {
            const contactId = event.currentTarget.dataset.contactId;
            
            // Update the main contactDetails array
            this.contactDetails = this.contactDetails.map(contact => {
                if (contact.contactId === contactId) {
                    return {
                        ...contact,
                        showMobilizationDetails: !contact.showMobilizationDetails
                    };
                }
                return contact;
            });

            // Refresh the processed data
            this.processContactData();
        } catch (error) {
            console.log('Error ==> ' , error);
        }
  
    }

    /**
     * Method Name: handleViewTimesheet
     * @description: Handle view timesheet button click
     */
    handleViewTimesheet(event) {
        const contactId = event.currentTarget.dataset.contactId;
        const mobilizationId = event.currentTarget.dataset.mobilizationId;
        const jobId = event.currentTarget.dataset.jobId;
        
        // Find the contact and mobilization
        const contact = this.contactDetails.find(c => c.contactId === contactId);
        
        // Try to find mobilization by either mobilizationId, mobilizationGroupId, or by jobId
        const mobilization = contact?.mobilizationGroups?.find(m => 
            (m.mobilizationId === mobilizationId) || 
            (m.mobilizationGroupId === mobilizationId) ||
            (m.jobId === jobId && (!mobilizationId || mobilizationId === 'undefined' || mobilizationId === 'null'))
        );
        
        if (contact && mobilization) {
            // Filter timesheet entries for this specific contact and job
            // Use the custom date range instead of mobilization dates for better filtering
            const customStartDate = new Date(this.customStartDate);
            const customEndDate = new Date(this.customEndDate);
            customEndDate.setHours(23, 59, 59, 999); // End of day
            
            const filteredEntries = contact.timesheetEntries.filter(entry => {
                if (entry.jobId !== jobId) {
                    return false;
                }
                
                // If clockInTime exists, use it for date filtering
                if (entry.clockInTime) {
                    const entryDate = new Date(entry.clockInTime);
                    return entryDate >= customStartDate && entryDate <= customEndDate;
                }
                
                return true; // Include entries without clockInTime
            });

            // Process timesheet entries for display using existing TimesheetEntryWrapper structure
            this.selectedTimesheetEntries = filteredEntries.map((entry, index) => {
                const values = this.timesheetColumns.map(col => {
                    let value = '';
                    let displayValue = '';

                    switch (col.fieldName) {
                        case 'serialNumber':
                            value = (index + 1).toString();
                            displayValue = value;
                            break;
                        case 'contactName':
                            value = contact.contactName || '--';
                            displayValue = value;
                            break;
                        case 'clockInTime':
                            value = entry.clockInTime;
                            displayValue = value ? this.formatToAMPM(value) : '--';
                            break;
                        case 'clockOutTime':
                            value = entry.clockOutTime;
                            displayValue = value ? this.formatToAMPM(value) : '--';
                            break;
                        case 'workHours':
                            value = entry.workHours || 0;
                            displayValue = typeof value === 'number' ? value.toFixed(2) : '0.00';
                            break;
                        case 'travelTime':
                            value = entry.travelTime || 0;
                            displayValue = typeof value === 'number' ? value.toFixed(2) : '0.00';
                            break;
                        case 'perDiem':
                            value = entry.perDiem || 0;
                            displayValue = value.toString();
                            break;
                        case 'totalTime':
                            value = entry.totalTime || 0;
                            displayValue = typeof value === 'number' ? value.toFixed(2) : '0.00';
                            break;
                        case 'premium':
                            value = entry.premium || false;
                            displayValue = value ? 'Yes' : 'No';
                            break;
                        case 'costCode':
                            value = entry.costCode || '--';
                            displayValue = value;
                            break;
                        default:
                            value = entry[col.fieldName] || '--';
                            displayValue = value;
                    }

                    return {
                        key: col.fieldName,
                        value: displayValue,
                        rawValue: value
                    };
                });

                return {
                    entryId: entry.entryId,
                    values: values
                };
            });

            this.isTimesheetModalOpen = true;
        }
    }

    /**
     * Method Name: closeTimesheetModal
     * @description: Close timesheet modal
     */
    closeTimesheetModal() {
        this.isTimesheetModalOpen = false;
        this.selectedTimesheetEntries = [];
    }

     /**
     * Method Name: showToast
     * @description: Show toast message
     */
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title,
            message,
            variant
        });
        this.dispatchEvent(event);
    }
}