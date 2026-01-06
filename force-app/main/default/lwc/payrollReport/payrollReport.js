import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getPayrollData from '@salesforce/apex/PayrollReportHandler.getPayrollData';

export default class PayrollReport extends LightningElement {
    @track data = [];
    @track error;
    @track searchKey = '';
    @track isLoading = false;
    @track isExporting = false;
    @track isLoadDisabledFlag = false;
    @track isDataLoaded = false; // Flag to track if data has been loaded
    @track startDate = '';
    @track endDate = '';
    @track lastSaturday = '';
    @track today = '';
    @track selectedRecords = new Set(); 
    @track showActiveOnly = false; 
    selectAll = false;

    // derived rows for rendering grouped table
    @track displayRows = [];

    isLoadDisabled = false;

    // Utility function to round values safely
    roundValue(value) {
        if (!value || isNaN(value)) return 0;
        return value === 0 ? 0 : Math.round(value * 100) / 100;
    }

    connectedCallback() {
        try {
            this.initializeDates(); // set default dates to last week's Sunday → Saturday
            this.loadData();
        } catch (error) {
            console.error('Error in connectedCallback:', error);
            this.handleError('Failed to initialize component', error);
        }
    }

    initializeDates() {
        try {
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0=Sunday, 6=Saturday
            this.today = today.toISOString().split('T')[0];

            // Calculate last week's Sunday
            const lastSunday = new Date(today);
            lastSunday.setDate(today.getDate() - dayOfWeek - 7);

            // Calculate last week's Saturday
            const lastSaturday = new Date(lastSunday);
            lastSaturday.setDate(lastSunday.getDate() + 6);

            this.startDate = lastSunday.toISOString().split('T')[0];
            console.log('this.startDate *** : ',this.startDate);
            this.endDate = lastSaturday.toISOString().split('T')[0];
            console.log('this.endDate *** : ',this.endDate);
            this.lastSaturday = this.endDate; // store to validate user input
        } catch (error) {
            console.error('Error initializing default dates:', error);
            this.handleError('Failed to initialize default dates', error);
        }
    }

    handleDateChange(event) {
        try {
            const { name, value } = event.target;

            // Prevent future dates
            if (value > this.today) {
                this.showToast('Error', 'Future dates are not allowed', 'error');
                if (name === 'startDate') this.startDate = this.startDate;
                if (name === 'endDate') this.endDate = this.endDate;
                this.isLoadDisabledFlag = true;
                this.isLoadDisabled = true;
                return;
            }

            // Disable Load Data button if end date > last Saturday
            if (name === 'endDate') {
                this.isLoadDisabledFlag = value > this.lastSaturday;
                this.isLoadDisabled = false;
            }
            if(name === 'endDate' && value < this.startDate) {
                this.showToast('Error', 'Please enter an End Date that is after the Start Date.', 'error');
                this.isLoadDisabled = true; 
            }

            if (name === 'startDate') this.startDate = value;
            if (name === 'endDate') this.endDate = value;
        } catch (error) {
            console.error('Error in handleDateChange:', error);
            this.handleError('Failed to update date', error);
        }
    }

    handleSearch(event) {
        try {
            this.searchKey = event.target.value.toLowerCase();
            // Apply the search filter and rebuild displayRows from the filtered employees
            this.applySearchFilter();
        } catch (error) {
            console.error('Error in handleSearch:', error);
            this.handleError('Failed to perform search', error);
        }
    }

    handleCheckboxChange(event) {
        try {
            const empId = event.target.dataset.id;
            if (event.target.checked) {
                this.selectedRecords.add(empId);
            } else {
                this.selectedRecords.delete(empId);
                this.selectAll = false;
            }
            this.selectAll = this.selectedRecords.size === this.filteredData.length;
        } catch (error) {
            console.error('Error in handleCheckboxChange:', error);
        }
    }

    handleSelectAll(event) {
        try {
            this.selectAll = event.target.checked;
            if (this.selectAll) {
                this.filteredData.forEach(emp => this.selectedRecords.add(emp.Employee));
            } else {
               this.filteredData.forEach(emp => this.selectedRecords.delete(emp.Employee));
            }
        } catch (error) {
            console.error('Error in handleSelectAll:', error);
        }
    }

    handleShowActiveOnly(event) {
        try {
            this.showActiveOnly = event.target.checked;
            // Rebuild displayRows from the filtered data whenever active-only toggles
            this.applySearchFilter();
        } catch (error) {
            console.error('Error in handleShowActiveOnly:', error);
        }
    }

    loadData() {
        try {
            this.isLoading = true;
            this.error = undefined;
            this.isDataLoaded = false; // reset flag before loading
            // console.log('Loading data with startDate:', this.startDate, 'and endDate:', this.formatEndDateWithTime(this.endDate)    );
            const endDateObj = new Date(this.endDate);
            endDateObj.setDate(endDateObj.getDate() + 1);
            // Convert to YYYY-MM-DD
            const adjustedEndDate = endDateObj.toISOString().split('T')[0];
            console.log('Adjusted End Date:', adjustedEndDate);
            
            
            getPayrollData({ startDate: this.startDate, endDate: adjustedEndDate})
                .then(result => {
                    try {
                        // Map result into usable structure and prepare JobRows
                        this.data = result.map(emp => {
                            let employeeUrl = null;
                            if (emp.EmployeeIdURL) {
                                if (typeof emp.EmployeeIdURL === 'string') {
                                    employeeUrl = emp.EmployeeIdURL.startsWith('/') ? emp.EmployeeIdURL : '/' + emp.EmployeeIdURL;
                                } else if (emp.EmployeeIdURL.Id) {
                                    employeeUrl = '/' + emp.EmployeeIdURL.Id;
                                }
                            }

                            // Build job rows from emp.JobRows if provided by Apex; fallback to JobURLs or JobNameList
                            let jobRows = [];
                            if (emp.JobRows && Array.isArray(emp.JobRows) && emp.JobRows.length > 0) {
                                jobRows = emp.JobRows.map((jr, i) => {
                                    let url = jr.url || null;
                                    if (url && typeof url === 'string' && !url.startsWith('/')) {
                                        if (/^[a-zA-Z0-9]{15,18}$/.test(url)) url = '/' + url;
                                    }
                                    return {
                                        sr: i + 1,
                                        name: jr.name || '',
                                        url,
                                        reg: this.roundValue(jr.reg || 0),
                                        travel: this.roundValue(jr.travel || 0),
                                        premium: this.roundValue(jr.premium || 0),
                                        reimbursement: this.roundValue(jr.reimbursement || 0)
                                    };
                                });
                            } else if (emp.JobURLs && Array.isArray(emp.JobURLs) && emp.JobURLs.length > 0) {
                                jobRows = emp.JobURLs.map((jobItem, i) => {
                                    const name = jobItem.name || jobItem.Name || '';
                                    const url = jobItem.url || null;
                                    return { sr: i + 1, name, url, reg: 0, travel: 0, premium: 0, reimbursement: 0 };
                                });
                            } else if (emp.JobNameList && Array.isArray(emp.JobNameList)) {
                                jobRows = emp.JobNameList.map((name, i) => ({ sr: i+1, name, url: null, reg:0, travel:0, premium:0, reimbursement:0 }));
                            } else {
                                // fallback placeholder
                                jobRows = [{ sr: 1, name: '', url: null, reg:0, travel:0, premium:0, reimbursement:0 }];
                            }

                            // Safely round numeric values without mutating original object
                            const premium_hours = this.roundValue(emp.premium_hours || 0);
                            const travel_hours = this.roundValue(emp.TravelHoursDisplay || 0);
                            const regular_hours_withot_travel = this.roundValue((emp.regular_hours || 0) - (emp.TravelHoursDisplay || 0));
                            const overtime_hours = this.roundValue(emp.overtime_hours || 0);

                            return {
                                ...emp,
                                EmployeeIdURL: employeeUrl,
                                JobRows: jobRows,
                                premium_hours,
                                travel_hours,
                                regular_hours_withot_travel,
                                overtime_hours,
                            };
                        });
                        console.log('main data *** : ', JSON.stringify(this.data));

                        // after mapping, prepare displayRows for grouped rendering
                        // this.prepareDisplayRows();

                        // ensure displayRows respects any existing search/active filters
                        this.applySearchFilter();

                        this.error = undefined;
                        this.isDataLoaded = true; // data loaded

                        this.showToast('Success', `Loaded ${this.data.length} payroll records successfully`, 'success');
                    } catch (mappingError) {
                        console.error('Error mapping data:', mappingError);
                        this.handleError('Failed to process payroll data', mappingError);
                    }
                })
                .catch(error => {
                    console.error('Error loading payroll data:', error);
                    this.handleError('Failed to load payroll data', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in loadData:', error);
            this.isLoading = false;
            this.handleError('Failed to initiate data loading', error);
        }
    }

    /**
     * Build displayRows array used by template for grouped rows rendering.
     * Each employee produces N rows where N = number of jobRows for that employee.
     * The first row contains employee columns and first job; later rows only show the job columns.
     */
    // prepareDisplayRows() {
    //     try {
    //         const rows = [];
    //         this.data.forEach(emp => {
    //             try {
    //                 const jobs = emp.JobRows || [];
    //                 if (!jobs.length) {
    //                     // ensure at least one row
    //                     jobs.push({ sr: 1, name: '', url: null, reg: 0, travel: 0, premium: 0, reimbursement: 0 });
    //                 }



    //                 const jobCount = jobs.length;
    //                 let totalReg = jobs.reduce((sum, j) => sum + (j.reg || 0), 0);
    //                 let totalOT = emp.overtime_hours || 0;

    //                 for (let i = 0; i < jobs.length; i++) {
    //                     const job = jobs[i];
    //                     const isFirstRow = i === 0;

    //                     // Generate unique row key
    //                     const key = emp.Employee
    //                         ? emp.Employee + '-' + (job.sr || i)
    //                         : 'emp-' + Math.random().toString(36).substr(2, 9);

    //                     // --- CALCULATE OVERTIME PER JOB ---
    //                     let otForJob = 0;
    //                     if (totalOT > 0 && totalReg > 0) {
    //                         const weight = (job.reg || 0) / totalReg;     // Weight %
    //                         otForJob = parseFloat((totalOT * weight).toFixed(2)); // Overtime split
    //                     }

    //                     rows.push({
    //                         key,
    //                         Employee: emp.Employee,
    //                         EmployeeIdURL: emp.EmployeeIdURL,
    //                         isFirstRow,
    //                         isSelected: this.selectedRecords.has(emp.Employee),
    //                         // jobCount: jobCount, 

    //                         last_name: isFirstRow ? (emp.last_name || '') : '',
    //                         first_name: isFirstRow ? (emp.first_name || '') : '',
    //                         title: isFirstRow ? (emp.title || '') : '',
    //                         overtime_hours: isFirstRow ? (emp.overtime_hours || 0) : '',
    //                         jobCount: jobCount,   

    //                         job: {
    //                             last_name: emp.last_name || '',
    //                             first_name: emp.first_name || '',
    //                             title: emp.title || '',
    //                             Employee: emp.Employee || '',
    //                             name: job.name || '',
    //                             url: job.url || null,
    //                             reg: job.reg || 0,
    //                             travel: job.travel || 0,
    //                             premium: job.premium || 0,
    //                             reimbursement: job.reimbursement || 0,
    //                             ot: otForJob   // <----- NEW FIELD ADDED
    //                         }
    //                     });
    //                 }

    //             } catch (innerErr) {
    //                 console.error('Error creating display rows for employee', innerErr);
    //             }
    //         });
    //         this.displayRows = rows;
    //     } catch (error) {
    //         console.error('Error in prepareDisplayRows:', error);
    //         this.displayRows = [];
    //     }
    // }

    /**
     * Rebuild displayRows based on a provided employee list (same logic as prepareDisplayRows but from the given list)
     * This is used so that the UI (which renders displayRows) follows the filtered employee list when searching or toggling active-only.
     */
    buildDisplayRowsFrom(employeeList) {
        try {
            const rows = [];
            (employeeList || []).forEach(emp => {
                try {
                    const jobs = emp.JobRows || [];                
                    if (!jobs.length) {
                        jobs.push({ sr: 1, name: '', url: null, reg: 0, travel: 0, premium: 0, reimbursement: 0 });
                    }

                    const jobCount = jobs.length;
                    let totalReg = jobs.reduce((sum, j) => sum + (j.reg || 0), 0);
                    let totalOT = emp.overtime_hours || 0;
                    let newReg = 0.0;
                    

                    for (let i = 0; i < jobs.length; i++) {
                        const job = jobs[i];
                        const isFirstRow = i === 0;
                        const key = emp.Employee
                            ? emp.Employee + '-' + (job.sr || i)
                            : 'emp-' + Math.random().toString(36).substr(2, 9);
                        let otForJob = 0;
                        if(jobs.length != 1){
                            if (totalOT > 0 && totalReg > 0) {
                                const weight = (job.reg || 0) / totalReg;
                                otForJob = parseFloat((totalOT * weight).toFixed(2));
                                newReg = (job.reg || 0) - (otForJob || 0);
                            }
                        }
                        else{
                            newReg = emp.regular_hours_withot_travel || 0;
                            otForJob = emp.overtime_hours || 0;
                        }
                        rows.push({
                            key,
                            Employee: emp.Employee,
                            EmployeeIdURL: emp.EmployeeIdURL,
                            isFirstRow,
                            isSelected: this.selectedRecords.has(emp.Employee),
                            // Repeat employee fields for every job row for CSV and UI consistency
                            last_name: emp.last_name || '',
                            first_name: emp.first_name || '',
                            title: emp.title || '',
                            overtime_hours: emp.overtime_hours || '',
                            jobCount: jobCount,

                            job: {
                                last_name: emp.last_name || '',
                                first_name: emp.first_name || '',
                                title: emp.title || '',
                                Employee: emp.Employee || '',
                                name: job.name || '',
                                url: job.url || null,
                                // reg: job.reg || 0,
                                reg: newReg.toFixed(2),
                                travel: job.travel || 0,
                                premium: job.premium || 0,
                                reimbursement: job.reimbursement || 0,
                                ot: otForJob
                            }
                        });
                    }
                } catch (innerErr) {
                    console.error('Error creating display rows from filtered employee', innerErr);
                }
            });
            this.displayRows = rows;
        } catch (error) {
            console.error('Error in buildDisplayRowsFrom:', error);
            this.displayRows = [];
        }
    }

    /**
     * Apply search + active-only filter on this.data and rebuild displayRows from that filtered list.
     */
    applySearchFilter() {
        try {
            let source = this.data || [];

            if (this.showActiveOnly) {
                source = source.filter(emp => emp.isActive);
            }

            if (this.searchKey && this.searchKey.trim() !== '') {
                const s = this.searchKey.toLowerCase();
                source = source.filter(emp => {
                    try {
                        const lastName = emp.last_name ? emp.last_name.toLowerCase() : '';
                        const firstName = emp.first_name ? emp.first_name.toLowerCase() : '';
                        const empId = emp.Employee ? String(emp.Employee).toLowerCase() : '';
                        return (
                            lastName.includes(s) ||
                            firstName.includes(s) ||
                            empId.includes(s)
                        );
                    } catch (filterError) {
                        console.error('Error filtering employee for search:', filterError);
                        return false;
                    }
                });
            }

            // Rebuild displayRows from the filtered employee list
            this.buildDisplayRowsFrom(source);
        } catch (error) {
            console.error('Error in applySearchFilter:', error);
            // fallback to building from all data to avoid empty UI
            this.buildDisplayRowsFrom(this.data);
        }
    }

    get filteredData() {
        try {
            let filtered = this.data;
            if (this.showActiveOnly) {
                filtered = filtered.filter(emp => emp.isActive);
            }
            if (!this.searchKey) {
                return filtered;
            }
            return  filtered.filter(emp => {
                try {
                    const lastName = emp.last_name ? emp.last_name.toLowerCase() : '';
                    const firstName = emp.first_name ? emp.first_name.toLowerCase() : '';
                    const empId = emp.Employee ? String(emp.Employee).toLowerCase() : '';
                    return (
                        lastName.includes(this.searchKey) ||
                        firstName.includes(this.searchKey) ||
                        empId.includes(this.searchKey)
                    );
                } catch (filterError) {
                    console.error('Error filtering individual record:', filterError);
                    return false;
                }
            });
        } catch (error) {
            console.error('Error in filteredData getter:', error);
            return [];
        }
    }

    get hasData() {
        try {
             return this.data && this.data.length > 0;
        } catch (error) {
            console.error('Error in hasData getter:', error);
            return false;
        }
    }

    get showEmptyState() {
        try {
            return (this.isDataLoaded && this.data.length === 0) ||  (this.filteredData.length === 0);
        } catch (error) {
            console.error('Error in showEmptyState getter:', error);
            return false;
        }
    }

    get isExportDisabled() {
        try {
            return !this.hasData || this.isExporting;
        } catch (error) {
            console.error('Error in isExportDisabled getter:', error);
            return true;
        }
    }

    get isLoadDisabled() {
        try {
            return this.isLoading || this.isLoadDisabledFlag;
        } catch (error) {
            console.error('Error in isLoadDisabled getter:', error);
            return true;
        }
    }

    // Helper function to properly escape CSV fields
    escapeCsvField(field) {
        if (field == null || field === '') return '';
        const stringField = String(field);
        // If field contains comma, double quote, or newline, wrap it in quotes and escape internal quotes
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
    }

    exportCsv() {
    try {
        if (!this.hasData || this.isExporting) return;
        this.isExporting = true;

        const selected = Array.from(this.selectedRecords);

        // Filter rows based on selected employees
        const rowsToExport = this.displayRows.filter(row => {
            if (selected.length === 0) return true;
            return selected.includes(row.Employee);
        });

        const columns = [
            'last_name',
            'first_name',
            'title',
            'Employee',
            'Job',
            'regular_hours',
            'overtime_hours',
            'premium',
            'reimbursement'
        ];

        const csvHeader = columns.join(',');

        const csvBody = rowsToExport.map(row => {
            try {
                const regPlusTravel =
                // console.log('row.job.reg:',row.job.reg,' row.job.travel:',row.job.travel);
                
                    (parseFloat(row.job.reg) || 0) +(row.job.travel) || 0;

                return [
                    row.job.last_name ? row.job.last_name || '' : '',
                    row.job.first_name ? row.job.first_name || '' : '',
                    row.job.title ? row.job.title || '' : '',
                    // row.first_name || '',
                    // row.title || '',
                    row.Employee || '',
                    this.escapeCsvField(row.job.name || ''),
                    regPlusTravel.toFixed(2),
                    row.job.ot ? row.job.ot.toFixed(2) : '0',
                    row.job.premium ? row.job.premium.toFixed(2) : '0',
                    row.job.reimbursement ? row.job.reimbursement.toFixed(2) : '0'
                ].join(',');
            } catch (e) {
                console.error('CSV Row Error:', e);
                return columns.map(() => '').join(',');
            }
        }).join('\n');

        const csvContent = `${csvHeader}\n${csvBody}`;

        const link = document.createElement('a');
        link.href =
            'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);

        const now = new Date();
        const fileName = `PayrollReport_${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}.csv`;

        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showToast('Success', `CSV exported successfully`, 'success');

        if (selected.length > 0) {
            this.selectedRecords = new Set();
        }
    } catch (error) {
        console.error('Error in exportCsv:', error);
        this.handleError('Failed to export CSV', error);
    } finally {
        this.isExporting = false;
    }
}



    showToast(title, message, variant) {
        try {
            const event = new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            });
            this.dispatchEvent(event);
        } catch (error) {
            console.error('Error showing toast:', error);
        }
    }

    handleError(message, error) {
        try {
            const errorMessage = error?.body?.message || error?.message || message || 'An unexpected error occurred';
            this.error = errorMessage;
            this.data = [];
            this.displayRows = [];
            this.showToast('Error', errorMessage, 'error');
        } catch (handlingError) {
            console.error('Error in error handler:', handlingError);
            this.error = 'Multiple errors occurred';
            this.showToast('Error', 'Multiple errors occurred', 'error');
        }
    }
}