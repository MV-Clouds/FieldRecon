import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getMobilizationMembers from '@salesforce/apex/HomeTabController.getMobilizationMembers';
import getTimeSheetEntryItems from '@salesforce/apex/HomeTabController.getTimeSheetEntryItems';
import createTimesheetRecords from '@salesforce/apex/JobDetailsPageController.createTimesheetRecords';

export default class HomeTab extends NavigationMixin(LightningElement) {
    @track isMobileDevice = false;
    @track selectedDate;
    @track isLoading = false;
    @track activeSectionName = ['jobDetails', 'timesheetDetails'];
    @track activeTab = 'today';
    @track todayJobList = [];
    @track weekJobList = [];
    @track isTodayJobAvailable = false;
    @track isWeekJobAvailable = false;
    @track accordionStyleApplied = false;
    @track hasError = false;
    @track errorMessage = '';
    @track showClockInModal = false;
    @track showClockOutModal = false;
    @track costCodeOptions = [];
    @track clockInTime;
    @track clockOutTime;
    @track selectedContactId;
    @track selectedMobilizationId;
    @track selectedCostCodeId;
    @track previousClockInTime;
    @track currentWeekTravelTime;
    @track currentTotalWorkHours;
    @track timesheetDetailsRaw = [];
    @track currentModalJobStartDateTime;
    @track currentModalJobEndDateTime;
    @track groupedTimesheets = [];
    @track showCrewModal = false;
    @track selectedJobId;

    // Main Table Columns (Desktop)
    mainTableColumns = [
        { label: '', fieldName: 'action', style: 'width: 4rem;' }, // Expand Button
        { label: 'Date', fieldName: 'dateLabel', style: '' },
        { label: 'Job Names', fieldName: 'jobNames', style: '' },
        { label: 'Total Work Hours', fieldName: 'totalHours', style: '' },
        { label: 'Total Travel Hours', fieldName: 'totalTravelHours', style: '' }
    ];

    // Sub Table Columns (Desktop)
    subTableColumns = [
        { label: 'Job Name', fieldName: 'jobName', style: 'width: 20%'  },
        { label: 'Clock In Time', fieldName: 'clockInTime' , style: 'width: 20%' },
        { label: 'Clock Out Time', fieldName: 'clockOutTime' , style: 'width: 20%' },
        { label: 'Work Hours', fieldName: 'workHours' , style: 'width: 20%' },
        { label: 'Travel Hours', fieldName: 'travelTime' , style: 'width: 20%' }
    ];

    @track currentDisplayTime;
    @track currentDateTimeForApex;
    @track timeUpdateInterval;
    @track timesheetColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { label: 'Job Number', fieldName: 'jobNumber', style: 'width: 10rem', isLink: true, recordIdField: 'jobId' },
        { label: 'Job Name', fieldName: 'jobName', style: 'width: 15rem' },
        { label: 'Clock In Time', fieldName: 'clockInTime', style: 'width: 12rem' },
        { label: 'Clock Out Time', fieldName: 'clockOutTime', style: 'width: 12rem' },
        { label: 'Work Hours', fieldName: 'workHours', style: 'width: 6rem' },
        { label: 'Travel Time', fieldName: 'travelTime', style: 'width: 6rem' },
        { label: 'Total Time', fieldName: 'totalTime', style: 'width: 6rem' },
        { label: 'Cost Code', fieldName: 'costCodeName', style: 'width: 10rem' }
    ];

    get apexFormattedDate() {
        const start = this.normalizeDate(new Date(this.selectedDate));
        return start.toLocaleDateString('en-CA');;
    }

    get isTodayTabActive() {
        return this.activeTab === 'today';
    }

    get isWeekTabActive() {
        return this.activeTab === 'week';
    }

    get todayTabClass() {
        return this.activeTab === 'today' ? 'active' : '';
    }

    get weekTabClass() {
        return this.activeTab === 'week' ? 'active' : '';
    }

    get modalJobStartTime() {
        const job = this.getCurrentModalJobRecord();
        return job ? job.jobStartTime : '';
    }

    get modalJobEndTime() {
        const job = this.getCurrentModalJobRecord();
        return job ? job.jobEndTime : '';
    }

    /** 
    * Method Name: timesheetDetails 
    * @description: This method processes raw timesheet details and formats them for display in the UI.
    */
    get timesheetDetails() {
        try {
            if (!this.timesheetDetailsRaw) {
                this.currentWeekTravelTime = 0;
                this.currentTotalWorkHours = 0;
                return [];
            }

            this.currentWeekTravelTime = 0;
            this.currentTotalWorkHours = 0;

            return this.timesheetDetailsRaw.map((ts, index) => {
                return {
                    id: ts.id,
                    jobId: ts.jobId,
                    values: this.timesheetColumns.map(col => {
                        let cell = { value: '--', style: col.style, recordLink: null, };

                        if (col.fieldName === 'srNo') {
                            cell.value = index + 1;
                        } else {
                            cell.value = ts[col.fieldName] || '--';
                            if (col.isLink && col.recordIdField) {
                                cell.recordLink = `/${ts[col.recordIdField]}`;
                            }
                        }

                        // Format dates nicely for the table
                        if (col.fieldName === 'clockInTime' || col.fieldName === 'clockOutTime') {
                            cell.value = this.formatToAMPM(cell.value);
                        }


                        return cell;
                    })
                };
            });
        } catch (error) {
            console.error('Error in timesheetDetails ::', error);
            this.currentWeekTravelTime = 0;
            this.currentTotalWorkHours = 0;
            return [];
        }
    }

    /**
     * Method Name: dailyTimesheetSummary
     * @description: Groups timesheet data by day for Mobile Card View.
     */
    get dailyTimesheetSummary() {
        if (!this.timesheetDetailsRaw || this.timesheetDetailsRaw.length === 0) {
            return [];
        }

        const groups = {};

        this.timesheetDetailsRaw.forEach(entry => {
            // Group by Date (Assume clockInTime exists and is ISO)
            let dateKey = 'Unknown Date';
            let displayDate = 'Unknown Date';

            if (entry.clockInTime) {
                // Extract YYYY-MM-DD
                dateKey = entry.clockInTime.split('T')[0];
                const dateObj = new Date(dateKey);
                // Format: Monday, Oct 6
                displayDate = this.formatDateLabel(dateObj);
            }

            if (!groups[dateKey]) {
                groups[dateKey] = {
                    date: dateKey,
                    labelDate: displayDate,
                    totalHours: 0,
                    entries: []
                };
            }

            // Sum up total time (Work + Travel) for the daily summary header
            const work = entry.workHours || 0;
            const travel = entry.travelTime || 0;
            groups[dateKey].totalHours += (work + travel);

            groups[dateKey].entries.push({
                id: entry.id,
                jobName: entry.jobName || 'Unknown Job',
                jobNumber: entry.jobNumber || '--',
                workHours: work ? work.toFixed(2) + ' Hrs' : '0 Hrs',
                travelTime: travel ? travel.toFixed(2) + ' Hrs' : '0 Hrs'
            });
        });

        // Convert object to array and format the label
        return Object.values(groups).map(day => {
            return {
                ...day,
                // Label format: "Monday, Oct 6: 8.5 Hours"
                label: `${day.labelDate} | Total Hours: ${day.totalHours.toFixed(2)} Hours`
            };
        }).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date
    }

    connectedCallback() {
        try {
            this.selectedDate = new Date();
            let isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

            if (isMobileDevice) {
                this.isMobileDevice = true;
            } else {
                this.isMobileDevice = false;
            }

            this.updateCurrentTime();
            this.timeUpdateInterval = setInterval(() => {
                this.updateCurrentTime();
            }, 1000);

            this.getMobilizationMembers();
            this.getTimesheetDetails();
        } catch (error) {
            console.error('Error in connectedCallback:', error);
        }
    }

    /** 
    * Method Name: renderedCallback 
    * @description: Ensures accordion styling is applied once after the component is rendered.
    */
    renderedCallback() {
        if (!this.accordionStyleApplied) {
            this.applyAccordionStyling();
        }
    }

    /** 
    * Method Name: applyAccordionStyling 
    * @description: Dynamically injects custom CSS to style the accordion sections within the component.
    */
    applyAccordionStyling() {
        try {
            // Create style element if it doesn't exist
            const style = document.createElement('style');
            style.textContent = `
                .accordion-container .section-control {
                    background: rgba(94, 90, 219, 0.9) !important;
                    color: white !important;
                    margin-bottom: 4px;
                    --slds-c-icon-color-foreground-default: #ffffff !important;
                    font-weight: 600 !important;
                    border-radius: 4px;
                }
                .accordion-container .slds-accordion__summary-content{
                    font-size: medium;
                }
                /* Mobile Timesheet Accordion Headers */
                .mobile-timesheet-container .section-control {
                    background: rgb(94 90 219 / 18%) !important; 
                    color: #333 !important;
                    border-left: 5px solid rgba(94, 90, 219, 0.9);
                    border-bottom: 1px solid #ddd;
                    --slds-c-icon-color-foreground-default: #5e5adb !important;
                }
            `;
            const accordionContainer = this.template.querySelector('.accordion-container');
            if (accordionContainer) {
                accordionContainer.appendChild(style);
                this.accordionStyleApplied = true;
            }

        } catch (error) {
            console.error('Error applying accordion styling:', error);
        }
    }

    /** 
    * Method Name: getMobilizationMembers 
    * @description: Fetches mobilization members from Apex, processes the data for today or week view, and prepares it for UI display including job times, map markers, and cost code options.
    */
    getMobilizationMembers() {
        try {
            this.isLoading = true;
            getMobilizationMembers({ filterDate: this.apexFormattedDate, mode: this.activeTab })
                .then((data) => {
                    console.log('getMobilizationMembers fetched successfully:', JSON.stringify(data));
                    if (data && !data?.ERROR) {
                        this.hasError = false;
                        this.errorMessage = '';
                        if (data && Object.keys(data).length !== 0) {
                            if (this.activeTab == 'today') {
                                this.todayJobList = data.dayJobs || [];
                                this.isTodayJobAvailable = this.todayJobList.length > 0;

                                this.todayJobList = this.todayJobList.map(job => {
                                    console.log('job :: ', job);
                                    const rawStart = job.jobStartTime;
                                    const rawEnd = job.jobEndTime;
                                    const description = job.jobDescription || '--';
                                    const needsReadMore = this.checkIfDescriptionNeedsReadMore(description);

                                    const lastIn = job.lastClockInTime ? this.formatToAMPM(job.lastClockInTime) : null;
                                    const lastOut = job.lastClockOutTime ? this.formatToAMPM(job.lastClockOutTime) : null;

                                    return {
                                        ...job,
                                        jobStartTimeIso: rawStart,
                                        jobEndTimeIso: rawEnd,
                                        jobId: job.jobId,
                                        jobStartTime: this.formatToAMPM(rawStart),
                                        jobEndTime: this.formatToAMPM(rawEnd),
                                        jobDescription: description,
                                        displayDescription: description,
                                        descriptionClass: needsReadMore ? 'job-description-content collapsed' : 'job-description-content',
                                        showReadMore: needsReadMore,
                                        readMoreText: 'Read more...',
                                        isExpanded: false,
                                        lastClockInFormatted: lastIn,
                                        lastClockOutFormatted: lastOut,
                                        hasLastEntry: !!(lastIn && lastOut),
                                        isCrewLeader: job.isCrewLeader || false,
                                        mapMarkers: [{
                                            location: {
                                                Street: job.jobStreet || '',
                                                City: job.jobCity || '',
                                                State: job.jobState || '',
                                                PostalCode: job.jobPostalCode || '',
                                                Country: job.jobCountry || ''
                                            },
                                            value: job.mobId,
                                            title: job.jobName ? `${job.jobName} (${job.jobNumber})` : job.jobNumber,
                                            description: job.jobDescription ? job.jobDescription.replace(/'/g, '&#39;') : '',
                                            icon: 'standard:account'
                                        }],
                                        isValidLocation: (job.jobStreet != '--' && job.jobCity != '--' && job.jobState != '--') ? true : false
                                    };
                                });

                                const costCodeMap = data.costCodeDetails[0].costCodeDetails;
                                this.costCodeOptions = Object.keys(costCodeMap).map(key => ({
                                    label: costCodeMap[key], // the name
                                    value: key               // the id
                                }));

                            } else if (this.activeTab == 'week') {
                                let apexData = data.weekJobs || [];
                                this.groupWeeklyJobData(apexData);
                                this.isWeekJobAvailable = apexData.length > 0;
                            }
                        }
                    } else {
                        this.hasError = true;
                        this.errorMessage = data.ERROR || 'An error occurred while fetching data.';
                    }
                })
                .catch((error) => {
                    console.error('Error fetching data getMobilizationMembers apex:', error);
                    this.showToast('Error', 'Failed to load data!', 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in getMobilizationMembers:', error);
            this.showToast('Error', 'Failed to load data!', 'error');
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: groupWeeklyJobData 
    * @description: Groups Apex weekly job data by day from today to next Monday, formats job times, and prepares map markers for UI display in accordion sections.
    */
    groupWeeklyJobData(apexData) {
        try {
            let today = new Date();

            // normalize apexData keys
            const normalizedApexData = {};
            for (let key in apexData) {
                normalizedApexData[key] = apexData[key].map(job => {
                    const description = job.jobDescription || '--';
                    const needsReadMore = this.checkIfDescriptionNeedsReadMore(description);

                    return {
                        ...job,
                        jobStartTimeIso: job.jobStartTime,
                        jobEndTimeIso: job.jobEndTime,
                        jobStartTime: this.formatToAMPM(job.jobStartTime),
                        jobEndTime: this.formatToAMPM(job.jobEndTime),
                        jobDescription: description,
                        displayDescription: description,
                        descriptionClass: needsReadMore ? 'job-description-content collapsed' : 'job-description-content',
                        showReadMore: needsReadMore,
                        readMoreText: 'Read more...',
                        isExpanded: false,
                        mapMarkers: [{
                            location: {
                                Street: job.jobStreet || '',
                                City: job.jobCity || '',
                                State: job.jobState || '',
                                PostalCode: job.jobPostalCode || '',
                                Country: job.jobCountry || ''
                            },
                            value: job.mobId,
                            title: job.jobName ? `${job.jobName} (${job.jobNumber})` : job.jobNumber,
                            description: job.jobDescription ? job.jobDescription.replace(/'/g, '&#39;') : '',
                            icon: 'standard:account'
                        }]
                    };
                });
            }

            let weekSections = [];
            // loop today → next 6 days
            for (let i = 0; i < 7; i++) {
                let currentDate = new Date(today);
                currentDate.setDate(today.getDate() + i);

                const start = this.normalizeDate(currentDate);
                let dateKey = start.toLocaleDateString('en-CA');

                let jobsForDay = normalizedApexData[dateKey] || [];

                weekSections.push({
                    id: `day-${i}`,
                    label: this.formatDateLabel(currentDate),
                    jobs: jobsForDay
                });
            }

            this.weekJobList = weekSections;
        } catch (error) {
            console.error('Error in groupWeeklyJobData :: ', error);
        }
    }

    /** 
    * Method Name: getTimesheetDetails 
    * @description: Fetches raw timesheet entries from Apex and stores them for further processing in the UI.
    */
    getTimesheetDetails() {
        try {
            this.isLoading = true;
            getTimeSheetEntryItems()
                .then(result => {
                    console.log('getTimeSheetEntryItems result :: ', result);

                    if (result && !result?.ERROR) {
                        if (result && result.timesheetEntries.length !== 0) {
                            // 1. Store the raw data
                            this.timesheetDetailsRaw = result.timesheetEntries;
                            
                            this.calculateTotals();
                            this.processGroupedTimesheets(); // Process for Desktop View
                        } else {
                            this.timesheetDetailsRaw = [];
                            this.groupedTimesheets = [];
                            this.currentWeekTravelTime = 0;
                            this.currentTotalWorkHours = 0;
                        }
                    } else {
                        this.hasError = true;
                        this.errorMessage = result.ERROR || 'An error occurred while fetching data.';
                    }
                })
                .catch(error => {
                    console.error('Error in getTimeSheetEntryItems apex :: ', error);
                    this.showToast('Error', 'Failed to load data!', 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                })
        } catch (error) {
            console.error('Error in getTimeSheetEntryItems ::', error);
            this.showToast('Error', 'Failed to load data!', 'error');
            this.isLoading = false;
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
    * Method Name: getCurrentModalJobRecord 
    * @description: Retrieves the current job record based on the selected mobilization ID.
    */
    getCurrentModalJobRecord() {
        if (!this.selectedMobilizationId || !Array.isArray(this.todayJobList)) {
            return null;
        }

        return this.todayJobList.find(job => job.mobId === this.selectedMobilizationId);
    }

    /** 
    * Method Name: normalizeDate 
    * @description: Normalizes a date by stripping time components, returning a date set to midnight.
    */
    normalizeDate(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    /** 
    * Method Name: formatToAMPM
    * @description: Formats ISO datetime string to 12-hour AM/PM format for display (e.g., "Nov 12, 2025, 03:45 PM")
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
            return iso;
        }
    }

    /**
     * Method Name: calculateTotals
     * @description: Iterates through raw data to sum up work and travel hours.
     * This separates the calculation logic from the UI rendering logic.
     */
    calculateTotals() {
        try {
            let totalTravel = 0;
            let totalWork = 0;

            if (this.timesheetDetailsRaw && this.timesheetDetailsRaw.length > 0) {
                this.timesheetDetailsRaw.forEach(entry => {
                    // Safety check to ensure we are adding numbers
                    if (entry.travelTime) {
                        totalTravel += parseFloat(entry.travelTime);
                    }
                    if (entry.workHours) {
                        totalWork += parseFloat(entry.workHours);
                    }
                });
            }

            // Assign to tracked variables to update the Summary Cards
            this.currentWeekTravelTime = totalTravel;
            this.currentTotalWorkHours = totalWork;
        } catch (error) {
            console.error('Error calculating totals:', error);
        }
    }

    /**
     * Method Name: processGroupedTimesheets
     * @description: Groups raw timesheet entries by Date for the Desktop Nested Table.
     */
    processGroupedTimesheets() {
        if (!this.timesheetDetailsRaw || this.timesheetDetailsRaw.length === 0) {
            this.groupedTimesheets = [];
            return;
        }

        const groups = {};

        this.timesheetDetailsRaw.forEach(entry => {
            // Key by YYYY-MM-DD
            let dateKey = entry.clockInTime ? entry.clockInTime.split('T')[0] : 'Unknown';
            
            if (!groups[dateKey]) {
                const dateObj = new Date(dateKey);
                groups[dateKey] = {
                    id: dateKey,
                    dateLabel: this.formatDateLabel(dateObj),
                    jobNamesSet: new Set(),
                    totalHours: 0,
                    totalTravelHours: 0, // Initialize Travel Sum
                    isExpanded: false,
                    entries: []
                };
            }

            // Aggregate Data
            groups[dateKey].jobNamesSet.add(entry.jobName || 'Unknown');
            
            // Calc Hours
            const work = entry.workHours || 0;
            const travel = entry.travelTime || 0; // Get Travel Time

            groups[dateKey].totalHours += work;
            groups[dateKey].totalTravelHours += travel; // Sum Travel Time

            // Add Child Entry
            groups[dateKey].entries.push({
                id: entry.id,
                jobName: entry.jobName,
                clockInTime: this.formatToAMPM(entry.clockInTime),
                clockOutTime: this.formatToAMPM(entry.clockOutTime),
                workHours: work.toFixed(2),
                travelTime: travel.toFixed(2) // Map formatted Travel Time
            });
        });

        // Convert Map to Array and Sort Descending by Date
        this.groupedTimesheets = Object.values(groups).map(group => {
            return {
                ...group,
                jobNames: Array.from(group.jobNamesSet).join(', '),
                totalHours: group.totalHours.toFixed(2),
                totalTravelHours: group.totalTravelHours.toFixed(2) // Format Total Travel
            };
        }).sort((a, b) => new Date(b.id) - new Date(a.id));
    }

    /**
     * Method Name: handleToggleTimesheetRow
     * @description: Toggles the sub-table visibility for a specific date row.
     */
    handleToggleTimesheetRow(event) {
        const rowId = event.currentTarget.dataset.id;
        this.groupedTimesheets = this.groupedTimesheets.map(row => {
            if (row.id === rowId) {
                return { ...row, isExpanded: !row.isExpanded };
            }
            return row;
        });
    }

    /**
    * Method Name: handleSectionToggle
    * @description: Handle accordion section toggle - Allow multiple sections to be open
    */
    handleSectionToggle(event) {
        this.activeSectionName = event.detail.openSections;
    }

    /**
    * Method Name: handleTodayTab
    * @description: Switches the UI to "Today" view and fetches today's mobilization jobs.
    */
    handleTodayTab() {
        this.activeTab = 'today';
        this.getMobilizationMembers();
    }

    /**
    * Method Name: handleWeekTab
    * @description: Switches the UI to "Week" view and fetches the week's mobilization jobs.
    */
    handleWeekTab() {
        this.activeTab = 'week';
        this.getMobilizationMembers();
    }

    /**
    * Method Name: handleClockIn
    * @description: Opens the Clock In modal and populates selected job and contact details for clocking in.
    */
    handleClockIn(event) {
        this.showClockInModal = true;
        const mobId = event.currentTarget.dataset.id;
        const selectedMob = this.todayJobList.find(job => job.mobId === mobId);
        console.log('selectedMob :: ', selectedMob);
        if (selectedMob) {
            this.selectedContactId = selectedMob.contactId;
            this.selectedMobilizationId = selectedMob.mobId;
            this.currentModalJobStartDateTime = selectedMob.jobStartTimeIso || selectedMob.jobStartTime;
            this.currentModalJobEndDateTime = selectedMob.jobEndTimeIso || selectedMob.jobEndTime;
            this.updateCurrentTime();
        }
    }

    /**
    * Method Name: handleClockOut
    * @description: Opens the Clock Out modal and populates selected job, contact, and previous clock-in details for clocking out.
    */
    handleClockOut(event) {
        this.showClockOutModal = true;
        const mobId = event.currentTarget.dataset.id;
        const selectedMob = this.todayJobList.find(job => job.mobId === mobId);
        if (selectedMob) {
            this.selectedContactId = selectedMob.contactId;
            this.selectedMobilizationId = selectedMob.mobId;
            this.previousClockInTime = this.formatToAMPM(selectedMob.clockInTime);
            this.currentModalJobStartDateTime = selectedMob.jobStartTimeIso || selectedMob.jobStartTime;
            this.currentModalJobEndDateTime = selectedMob.jobEndTimeIso || selectedMob.jobEndTime;
            this.updateCurrentTime();
        }
    }

    /** 
    * Method Name: handleInputChange 
    * @description: Method is used to handle the input change
    */
    handleInputChange(event) {
        let field = event.target.dataset.field;
        let value = event.target.value;

        if (field === 'costCode') {
            this.selectedCostCodeId = value;
        }
    }

    /** 
    * Method Name: closeClockInModal 
    * @description: Closes the Clock In modal and resets all related job, contact, and time fields.
    */
    closeClockInModal() {
        this.showClockInModal = false;
        this.selectedContactId = null;
        this.selectedMobilizationId = null;
        this.selectedCostCodeId = null;
        this.previousClockInTime = null;
        this.clockInTime = null;
        this.clockOutTime = null;
        this.currentModalJobStartDateTime = null;
        this.currentModalJobEndDateTime = null;
    }

    /** 
    * Method Name: closeClockOutModal 
    * @description: Closes the Clock Out modal and resets all related job, contact, and time fields.
    */
    closeClockOutModal() {
        this.showClockOutModal = false;
        this.selectedContactId = null;
        this.selectedMobilizationId = null;
        this.selectedCostCodeId = null;
        this.previousClockInTime = null;
        this.clockOutTime = null;
        this.clockInTime = null;
        this.currentModalJobStartDateTime = null;
        this.currentModalJobEndDateTime = null;
    }

    /** 
    * Method Name: getCurrentLocation 
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
                    // Permission denied or other error
                    resolve(null);
                }
            );
        });
    }

    /** 
    * Method Name: saveClockIn 
    * @description: Validates input and submits a Clock In request for the selected mobilization, updating the timesheet and UI accordingly.
    */
    async saveClockIn() {
        try {
            if (!this.selectedCostCodeId) {
                this.showToast('Error', 'Select Cost Code!', 'error');
                return;
            }

            const selectedRecordDetails = this.todayJobList.find(
                record => record.mobId === this.selectedMobilizationId
            );

            if (!selectedRecordDetails) {
                this.showToast('Error', 'Unable to determine job details for the selected record', 'error');
                return;
            }

            this.isLoading = true;
            this.updateCurrentTime();

            const location = await this.getCurrentLocation();

            const params = {
                actionType: 'clockIn',
                contactId: this.selectedContactId,
                costCodeId: this.selectedCostCodeId,
                mobId: this.selectedMobilizationId,
                jobId: selectedRecordDetails.jobId,
                clockInTime: this.currentDateTimeForApex,
                isTimeSheetNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetNull : true,
                timesheetId: selectedRecordDetails ? selectedRecordDetails?.timesheetId : null,
                isTimeSheetEntryNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetEntryNull : true,
                timesheetEntryId: selectedRecordDetails ? selectedRecordDetails?.timesheetEntryId : null,
                mobMemberId: selectedRecordDetails.mobMemberId,
                clockInLatitude: location?.latitude || null,
                clockInLongitude: location?.longitude || null,
                canAccessLocation: selectedRecordDetails?.canAccessLocation || false
            };

            console.log('createTimesheetRecords params :: ', params);

            createTimesheetRecords({ params: JSON.stringify(params) })
                .then(result => {
                    if (result == true) {
                        this.showToast('Success', 'Clocked In Successfully', 'success');
                        this.closeClockInModal();
                        this.getMobilizationMembers();
                        this.getTimesheetDetails();
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
            console.error('Error in saveClockIn:', error);
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: saveClockOut 
    * @description: Validates input and submits a Clock Out request for the selected mobilization, updating the timesheet and UI accordingly.
    */
    async saveClockOut() {
        try {
            const selectedRecordDetails = this.todayJobList.find(
                record => record.mobId === this.selectedMobilizationId
            );

            if (!selectedRecordDetails) {
                this.showToast('Error', 'Unable to determine job details for the selected record', 'error');
                return;
            }

            this.isLoading = true;
            this.updateCurrentTime();

            const location = await this.getCurrentLocation();

            const params = {
                actionType: 'clockOut',
                contactId: this.selectedContactId,
                costCodeId: this.selectedCostCodeId,
                mobId: this.selectedMobilizationId,
                jobId: selectedRecordDetails.jobId,
                clockInTime: selectedRecordDetails.clockInTime,
                clockOutTime: this.currentDateTimeForApex,
                isTimeSheetNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetNull : true,
                timesheetId: selectedRecordDetails ? selectedRecordDetails?.timesheetId : null,
                isTimeSheetEntryNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetEntryNull : true,
                timesheetEntryId: selectedRecordDetails ? selectedRecordDetails?.timesheetEntryId : null,
                mobMemberId: selectedRecordDetails.mobMemberId,
                clockOutLatitude: location?.latitude || null,
                clockOutLongitude: location?.longitude || null,
                canAccessLocation: selectedRecordDetails?.canAccessLocation || false
            };

            console.log('createTimesheetRecords params :: ', params);

            createTimesheetRecords({ params: JSON.stringify(params) })
                .then(result => {
                    console.log('createTimesheetRecords apex :: result', result);
                    if (result == true) {
                        this.getMobilizationMembers();
                        this.getTimesheetDetails();
                        this.closeClockOutModal();
                        this.showToast('Success', 'Clocked Out Successfully', 'success');
                    } else {
                        this.showToast('Error', 'Failed to Clock Out User', 'error');
                    }
                })
                .catch(error => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error creating timesheet records createTimesheetRecords apex :: ', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
            return;
        } catch (error) {
            console.error('Error in saveClockOut:', error);
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: handleLinkClick 
    * @description: Method is used to handle the link click
    */
    handleLinkClick(event) {
        try {
            const jobId = event.currentTarget.dataset.link; // ✅ use currentTarget
            console.log('Job Id:', jobId);

            if (jobId) {
                this[NavigationMixin.Navigate]({
                    type: 'standard__recordPage',
                    attributes: {
                        recordId: jobId,
                        actionName: 'view',
                    },
                });
            } else {
                console.warn('No jobId found in dataset');
            }
        } catch (error) {
            console.error('Error in handleLinkClick:', error);
        }
    }


    /** 
    * Method Name: formatDateLabel 
    * @description: Converts a Date object into a human-readable string format for UI labels (e.g., Monday 6 Oct, 2025).
    */
    formatDateLabel(date) {
        try {
            const options = { weekday: 'long', day: 'numeric', month: 'short'};
            return date.toLocaleDateString(undefined, options); 
        } catch (error) {
            console.error('Error in formatDateLabel :: ', error);
        }
    }

    /** 
    * Method Name: handleOpenInMaps 
    * @description: Opens the Google Maps location for the selected job based on its address, handling both today and week views.
    */
    handleOpenInMaps(event) {
        try {
            const mobId = event.currentTarget.dataset.id;
            let selectedMob;

            if (this.activeTab === 'today') {
                selectedMob = this.todayJobList.find(job => job.mobId === mobId);
            } else {
                // Week view: weekJobList contains sections with jobs
                for (let section of this.weekJobList) {
                    selectedMob = section.jobs.find(job => job.mobId === mobId);
                    if (selectedMob) break;
                }
            }

            if (selectedMob) {
                if (!selectedMob.isValidLocation) {
                    this.showToast('Error', 'Invalid Location', 'error');
                    return;
                }
                const street = selectedMob?.jobStreet || '';
                const city = selectedMob?.jobCity || '';
                const state = selectedMob?.jobState || '';
                const postalCode = selectedMob?.jobPostalCode || '';
                const country = selectedMob?.jobCountry || '';

                const query = encodeURIComponent(`${street} ${city} ${state} ${postalCode} ${country}`.trim());
                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`);
            }
        } catch (error) {
            console.error('Error in handleOpenInMaps :: ', error);
        }
    }

    /**
    * Method Name: checkIfDescriptionNeedsReadMore
    * @description: Checks if description text needs read more functionality (more than 3 lines)
    */
    checkIfDescriptionNeedsReadMore(text) {
        if (!text || text === '--') return false;
        // Approximate: if text is longer than 150 characters, it might need read more
        // This is a rough estimate; actual line count depends on container width
        return text.length > 150;
    }

    /**
    * Method Name: handleToggleDescription
    * @description: Toggles the expanded/collapsed state of job description
    */
    handleToggleDescription(event) {
        const mobId = event.currentTarget.dataset.id;

        if (this.activeTab === 'today') {
            this.todayJobList = this.todayJobList.map(job => {
                if (job.mobId === mobId) {
                    const isExpanded = !job.isExpanded;
                    return {
                        ...job,
                        isExpanded: isExpanded,
                        descriptionClass: isExpanded ? 'job-description-content' : 'job-description-content collapsed',
                        readMoreText: isExpanded ? 'Read less' : 'Read more...'
                    };
                }
                return job;
            });
        } else if (this.activeTab === 'week') {
            this.weekJobList = this.weekJobList.map(section => {
                return {
                    ...section,
                    jobs: section.jobs.map(job => {
                        if (job.mobId === mobId) {
                            const isExpanded = !job.isExpanded;
                            return {
                                ...job,
                                isExpanded: isExpanded,
                                descriptionClass: isExpanded ? 'job-description-content' : 'job-description-content collapsed',
                                readMoreText: isExpanded ? 'Read less' : 'Read more...'
                            };
                        }
                        return job;
                    })
                };
            });
        }
    }

    /**
     * Method Name: handleCrewClockInOut
     * @description: Handles the Crew Clock In/Out action
     * @param {*} event 
     */
    handleCrewClockInOut(event) {
        const mobId = event.currentTarget.dataset.id;
        const selectedMob = this.todayJobList.find(job => job.mobId === mobId);
        
        if (selectedMob) {
            this.selectedJobId = selectedMob.jobId;
            this.showCrewModal = true;
        }
    }

    /**
     * Method Name: closeCrewModal
     * @description: Closes the Crew Clock In/Out modal
     */
    closeCrewModal() {
        this.showCrewModal = false;
        this.selectedJobId = null;
        
        // Refresh the data to show updated status after crew action
        this.getMobilizationMembers();
        this.getTimesheetDetails();
    }

    /** 
    * Method Name: showToast 
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