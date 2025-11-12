import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAllContactsWithDetails from '@salesforce/apex/TimeCardManagerController.getAllContactsWithDetails';

export default class TimeCardManager extends NavigationMixin(LightningElement) {
    @track isLoading = true;
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

    /**
     * Method Name: getDefaultStartDate
     * @description: Get default start date (previous Sunday or current day if today is Sunday)
     */
    getDefaultStartDate() {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        if (dayOfWeek === 0) {
            // Today is Sunday, use today
            return today.toISOString().split('T')[0];
        } else {
            // Go back to previous Sunday
            const daysToSubtract = dayOfWeek;
            const previousSunday = new Date(today);
            previousSunday.setDate(today.getDate() - daysToSubtract);
            return previousSunday.toISOString().split('T')[0];
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
            return today.toISOString().split('T')[0];
        } else {
            // Go forward to next Saturday
            const daysToAdd = 6 - dayOfWeek;
            const nextSaturday = new Date(today);
            nextSaturday.setDate(today.getDate() + daysToAdd);
            return nextSaturday.toISOString().split('T')[0];
        }
    }

    /**
     * Method Name: connectedCallback
     * @description: Initialize component
     */
    connectedCallback() {
        this.loadContactDetails();
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

            console.log('result ===> ', result);
            
            
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
        .catch(error => {
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
                    displayValue = this.formatDateTime(value);
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
     * Method Name: formatDateTime
     * @description: Format datetime to "2025-10-23 6:30" format
     */
    formatDateTime(dateValue) {
        if (!dateValue) return '--';
        
        try {
            const iso = new Date(dateValue).toISOString();
            return iso.slice(0, 16).replace('T', ' '); // "2025-10-05 07:00"
        } catch (error) {
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
            customStartDate.setHours(0, 0, 0, 0); // Start of day
            const customEndDate = new Date(this.customEndDate);
            customEndDate.setHours(23, 59, 59, 999); // End of day

            console.log('contact.timesheetEntries ==> ', contact.timesheetEntries);
            
            
            const filteredEntries = contact.timesheetEntries.filter(entry => {
                if (entry.jobId !== jobId) {
                    return false;
                }
                
                // If clockInTime exists, use it for date filtering
                if (entry.clockInTime) {

                    console.log('Started for JobId ==> ', entry.jobId);
                    

                    console.log('entry.clockInTime ==> ', entry.clockInTime);
                    
                    const entryDate = new Date(entry.clockInTime);

                    console.log('entryDate ==> ', entryDate);

                    console.log('customStartDate ==> ', customStartDate);
                    console.log('customEndDate ==> ', customEndDate);

                    console.log('entryDate >= customStartDate ==> ', entryDate >= customStartDate);
                    console.log('entryDate <= customEndDate ==> ', entryDate <= customEndDate);
                    
                    console.log('Ended for JobId ==> ' , entry.jobId);
                    
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
                            displayValue = value ? this.formatDateTime(value) : '--';
                            break;
                        case 'clockOutTime':
                            value = entry.clockOutTime;
                            displayValue = value ? this.formatDateTime(value) : '--';
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