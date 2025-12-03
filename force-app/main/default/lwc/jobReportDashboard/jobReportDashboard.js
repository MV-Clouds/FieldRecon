import { LightningElement, track, wire } from 'lwc';
import getAllJobsWithScopeData from '@salesforce/apex/JobMetricsController.getAllJobsWithScopeData';
import getJobMetrics from '@salesforce/apex/JobMetricsController.getJobMetrics';
import getMetricSettings from '@salesforce/apex/JobMetricsController.getMetricSettings';
import saveMetricSettings from '@salesforce/apex/JobMetricsController.saveMetricSettings';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { loadScript } from 'lightning/platformResourceLoader';
import D3 from '@salesforce/resourceUrl/d3';
import { NavigationMixin } from 'lightning/navigation';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import JOB_OBJECT from '@salesforce/schema/Job__c';
import STATUS_FIELD from '@salesforce/schema/Job__c.Status__c';
import checkPermissionSetsAssigned from '@salesforce/apex/PermissionsUtility.checkPermissionSetsAssigned';

export default class JobReportDashboard extends NavigationMixin(LightningElement) {
    @track isLoading = true;
    @track financeData = [];
    @track showChart = false;
    d3Initialized = false;

    // Metric data
    @track backlogCount = 0;
    @track backlogValue = 0;
    @track inProgressCount = 0;
    @track inProgressValue = 0;
    @track openBalanceCount = 0;
    @track openBalanceValue = 0;
    @track retainageCount = 0;
    @track retainageValue = 0;
    @track remainingCount = 0;
    @track remainingValue = 0;

    // Totals for footer
    @track totalContract = 0;
    @track totalBaseContract = 0;
    @track totalChangeOrder = 0;
    @track totalCompletedValue = 0;
    @track totalRemaining = 0;
    @track totalBilled = 0;
    @track totalPaid = 0;
    @track totalBalance = 0;
    @track totalRetainage = 0;
    @track averageCompletion = 0;

    @track chartConfig = {
        valueType: 'totalContract',
        valueTypes: [
            { label: 'Total Contract', value: 'totalContract' },
            { label: 'Base Contract', value: 'baseContract' },
            { label: 'Change Order', value: 'changeOrder' },
            { label: 'Billed Amount', value: 'billedAmount' },
            { label: 'Paid Amount', value: 'paidAmount' },
            { label: 'Balance Amount', value: 'balanceAmount' },
            { label: 'Retainage Held', value: 'retainageHeld' }
        ]
    };

    @track searchTerm = '';
    @track selectedStatuses = [];
    @track allFinanceData = [];
    @track jobStatusMap = new Map();

    // Custom multiselect properties
    @track showStatusDropdown = false;
    @track statusOptions = [];
    @track filteredStatusOptions = [];
    @track statusSearchTerm = '';

    @track showEditPopup = false;
    @track currentEditingMetric = '';
    @track metricSettings = {};
    @track editSelectedStatuses = [];
    @track hasAccess = false;
    @track accessErrorMessage = 'You don\'t have permission to access this.';

    @track currentPage = 1;
    @track pageSize = 50;
    @track totalPages = 1;
    @track paginatedFinanceData = [];
    @track showRecentlyViewed = true;



    @wire(getObjectInfo, { objectApiName: JOB_OBJECT })
    objectInfo;

    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: STATUS_FIELD
    })
    wiredStatusValues({ data, error }) {
        if (data) {
            // Create status options from picklist values
            this.statusOptions = data.values.map(item => ({
                label: item.label,
                value: item.value,
                selected: true
            }));

            // Add "None" option for null status
            this.statusOptions.push({
                label: 'None',
                value: 'null',
                selected: true
            });

            this.filteredStatusOptions = [...this.statusOptions];

            // Initialize selected statuses with all options including "None"
            this.selectedStatuses = this.statusOptions.map(option => option.value);

        } else if (error) {
            this.statusOptions = [];
            this.showToast('Error', 'Failed to load status options', 'error');
        }
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
        const currentPage = this.currentPage;

        // Always show first page
        pages.push({ number: 1, isEllipsis: false });

        if (currentPage > 3) {
            pages.push({ number: '...', isEllipsis: true });
        }

        // Show pages around current page
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
            if (i > 1 && i < totalPages) {
                pages.push({ number: i, isEllipsis: false });
            }
        }

        if (currentPage < totalPages - 2) {
            pages.push({ number: '...', isEllipsis: true });
        }

        // Always show last page if there is more than one page
        if (totalPages > 1) {
            pages.push({ number: totalPages, isEllipsis: false });
        }

        // Add CSS class for active page
        return pages.map(page => ({
            ...page,
            cssClass: page.isEllipsis ? 'pagination-ellipsis' :
                `pagination-button ${page.number === this.currentPage ? 'active' : ''}`
        }));
    }

    connectedCallback() {
        this.loadD3();
        this.loadMetricSettings();
        this.overrideSLDS();
        this.checkUserPermissions();
        // Close dropdown when clicking outside
        document.addEventListener('click', this.handleOutsideClick.bind(this));
    }

    disconnectedCallback() {
        document.removeEventListener('click', this.handleOutsideClick.bind(this));
    }


    loadMetricsData() {
        this.isLoading = true;
        getJobMetrics()
            .then(data => {
                console.log('data', data);

                this.processMetricsData(data);
            })
            .catch(error => {
                this.showToast('Error', 'Failed to load job metrics data: ' + error.body?.message, 'error');
            });
    }

    loadJobData() {
        this.isLoading = true;

        // Pass the showRecentlyViewed flag to Apex
        getAllJobsWithScopeData({ filterByRecentlyViewed: this.showRecentlyViewed })
            .then(data => {
                this.processFinanceData(data);
            })
            .catch(error => {
                this.showToast('Error', 'Failed to load finance data: ' + error.body?.message, 'error');
            });
    }

    checkUserPermissions() {
        const permissionSetsToCheck = ['FR_Admin'];

        checkPermissionSetsAssigned({ psNames: permissionSetsToCheck })
            .then(result => {
                const assignedMap = result.assignedMap || {};
                const isAdmin = result.isAdmin || false;

                const hasFRAdmin = assignedMap['FR_Admin'] || false;

                if (isAdmin || hasFRAdmin) {
                    this.hasAccess = true;
                    this.loadMetricsData();
                    this.loadJobData();
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

    overrideSLDS() {
        let style = document.createElement('style');
        style.innerText = `
                .mob-popup .slds-dueling-list__options [aria-selected='true'] {
                    background-color: #5e5adb !important;
                }

                .mob-popup .slds-button__icon {
                    fill: #5e5adb !important;
                }

                .mob-popup .slds-listbox_vertical .slds-listbox__option[aria-selected='false']:hover,
                .mob-popup .slds-listbox_vertical .slds-listbox__option:not([aria-selected='true']):hover {
                    background-color: #e3e3fb !important;
                }
        `;
        this.template.host.appendChild(style);
    }

    handleOutsideClick(event) {
        const dropdown = this.template.querySelector('.custom-multiselect');
        if (dropdown && !dropdown.contains(event.target)) {
            this.showStatusDropdown = false;
        }
    }

    async loadD3() {
        try {
            await loadScript(this, D3);
            this.d3Initialized = true;
        } catch (error) {
            console.error('Error loading D3.js:', error);
            this.showToast('Error', 'Something went wrong!', 'error');
        }
    }

    async loadMetricSettings() {
        try {
            const result = await getMetricSettings();
            this.metricSettings = result.metricStatusMap;
            console.log('loadMetricSettings', result, ' ', this.metricSettings);

        } catch (error) {
            console.error('Error loading metric settings:', error);
            this.showToast('Error', 'Failed to load metric settings', 'error');
        }
    }

    get selectedStatusText() {
        // If no statuses selected, show "All Statuses"
        if (this.selectedStatuses.length === 0) {
            return 'All Statuses';
        }

        // Get all available status values including "None"
        const allStatusValues = this.statusOptions.map(option => option.value);

        // Check if all statuses are selected (including "None")
        const allSelected = allStatusValues.length > 0 &&
            this.selectedStatuses.length === allStatusValues.length &&
            allStatusValues.every(status => this.selectedStatuses.includes(status));

        if (allSelected) {
            return 'All Statuses';
        }

        // If only one status selected, show its label
        if (this.selectedStatuses.length === 1) {
            const selectedValue = this.selectedStatuses[0];
            // Handle "null" value specially
            if (selectedValue === 'null') {
                return 'None';
            }
            const option = this.statusOptions.find(opt => opt.value === selectedValue);
            return option ? option.label : 'All Statuses';
        }

        const selectedCount = this.selectedStatuses.length;
        const hasEmptyStatus = this.selectedStatuses.includes('null');

        if (hasEmptyStatus) {
            const regularStatusCount = selectedCount - 1;

            if (regularStatusCount === 0) {
                return 'None';
            } else {
                return `${selectedCount} Statuses Selected`;
            }
        } else {
            return `${selectedCount} Statuses Selected`;
        }
    }

    get isFinanceDataAvailable() {
        return this.paginatedFinanceData && this.paginatedFinanceData.length > 0;
    }

    get tableButtonClass() {
        return `toggle-option ${!this.showChart ? 'active' : ''}`;
    }

    get chartButtonClass() {
        return `toggle-option ${this.showChart ? 'active' : ''}`;
    }

    get metricDisplayName() {
        return this.getMetricDisplayName(this.currentEditingMetric);
    }

    get recentlyViewedButtonLabel() {
        return this.showRecentlyViewed ? 'Show All Jobs' : 'Recently Viewed Jobs';
    }

    toggleStatusDropdown(event) {
        event.stopPropagation();
        this.showStatusDropdown = !this.showStatusDropdown;
    }

    handleDropdownClick(event) {
        event.stopPropagation();
    }

    handleStatusSearch(event) {
        this.statusSearchTerm = event.target.value.toLowerCase();
        if (this.statusSearchTerm) {
            this.filteredStatusOptions = this.statusOptions.filter(option =>
                option.label.toLowerCase().includes(this.statusSearchTerm)
            );
        } else {
            this.filteredStatusOptions = [...this.statusOptions];
        }
    }

    handleStatusToggle(event) {
        event.stopPropagation();
        const selectedValue = event.currentTarget.dataset.value;

        if (this.selectedStatuses.includes(selectedValue)) {
            this.selectedStatuses = this.selectedStatuses.filter(val => val !== selectedValue);
        } else {
            this.selectedStatuses = [...this.selectedStatuses, selectedValue];
        }

        // Update the selected property in options
        this.statusOptions = this.statusOptions.map(option => ({
            ...option,
            selected: this.selectedStatuses.includes(option.value)
        }));

        this.filteredStatusOptions = this.filteredStatusOptions.map(option => ({
            ...option,
            selected: this.selectedStatuses.includes(option.value)
        }));

        this.applyFilters();
    }

    getMetricDisplayName(metricName) {
        const nameMap = {
            'backlog': 'Backlog',
            'inProgress': 'In Progress',
            'openBalance': 'Open Balance',
            'retainagePending': 'Retainage Pending',
            'workRemaining': 'Work Remaining'
        };
        return nameMap[metricName] || metricName;
    }

    toggleRecentlyViewed() {
        this.showRecentlyViewed = !this.showRecentlyViewed;

        // Reload data with the new filter
        this.loadJobData();
    }

    processMetricsData(data) {
        this.backlogCount = data.backlog?.count || 0;
        this.backlogValue = data.backlog?.totalValue || 0;
        this.inProgressCount = data.inProgress?.count || 0;
        this.inProgressValue = data.inProgress?.totalValue || 0;
        this.openBalanceCount = data.openBalance?.count || 0;
        this.openBalanceValue = data.openBalance?.totalValue || 0;
        this.retainageCount = data.retainagePending?.count || 0;
        this.retainageValue = data.retainagePending?.totalValue || 0;
        this.remainingCount = data.workRemaining?.count || 0;
        this.remainingValue = data.workRemaining?.totalValue || 0;
    }

    processFinanceData(data) {
        // Clear the allJobIds set
        this.allJobIds = new Set();

        this.allFinanceData = data.map((job, index) => {
            const totalContract = (job.baseContract || 0) + (job.changeOrder || 0);
            const completedValue = job.totalCompletedValue || 0;
            const completionPercentage = totalContract > 0 ? (completedValue / totalContract) : 0;
            const remainingValue = Math.max(0, totalContract - completedValue);

            // Store job ID
            if (job.jobId) {
                this.allJobIds.add(job.jobId);
            }

            return {
                ...job,
                srNo: index + 1,
                totalContract: totalContract,
                percentComplete: completionPercentage,
                remainingValue: remainingValue,
                billedAmount: job.billedAmount || 0,
                paidAmount: job.paidAmount || 0,
                balanceAmount: job.balanceAmount || 0,
                retainageHeld: job.retainageHeld || 0,
                // Ensure status is properly handled for null values
                status: job.status === null || job.status === undefined ? 'null' : job.status
            };
        });

        this.applyFilters();
        this.isLoading = false;
    }

    navigateToJobRecord(event) {
        const jobId = event.currentTarget.dataset.id;
        if (jobId) {
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: jobId,
                    objectApiName: 'wfrecon__Job__c',
                    actionName: 'view'
                }
            });
        }
    }


    // Add pagination update method
    updatePaginatedData() {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;

        // Update paginated data with correct serial numbers
        this.paginatedFinanceData = this.financeData
            .slice(startIndex, endIndex)
            .map((job, index) => ({
                ...job,
                srNo: startIndex + index + 1
            }));

        this.calculateTotals();
    }

    handlePageChange(event) {
        const pageNumber = parseInt(event.currentTarget.dataset.page, 10);
        if (!isNaN(pageNumber) && pageNumber !== this.currentPage) {
            this.currentPage = pageNumber;
            this.updatePaginatedData();
        }
    }

    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updatePaginatedData();
        }
    }

    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.updatePaginatedData();
        }
    }

    handleRefresh() {
        this.isLoading = true;

        // Reset to first page
        this.currentPage = 1;

        Promise.all([
            getMetricSettings(),
            getJobMetrics(),
            getAllJobsWithScopeData({ filterByRecentlyViewed: this.showRecentlyViewed })
        ])
            .then(([settingsResult, metricsData, jobsData]) => {
                // Process metric settings
                this.metricSettings = settingsResult?.metricStatusMap || {};

                // Process metrics data
                this.processMetricsData(metricsData);

                // Process job data
                this.processFinanceData(jobsData);

                this.showToast('Success', 'Data refreshed successfully', 'success');
            })
            .catch(error => {
                console.error('Error refreshing data:', error);
                this.showToast('Error', 'Failed to refresh data: ' + (error.body?.message || error.message), 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }


    calculateTotals() {
        this.totalContract = 0;
        this.totalBaseContract = 0;
        this.totalChangeOrder = 0;
        this.totalCompletedValue = 0;
        this.totalRemaining = 0;
        this.totalBilled = 0;
        this.totalPaid = 0;
        this.totalBalance = 0;
        this.totalRetainage = 0;

        this.paginatedFinanceData.forEach(job => {
            this.totalContract += job.totalContract || 0;
            this.totalBaseContract += job.baseContract || 0;
            this.totalChangeOrder += job.changeOrder || 0;
            this.totalCompletedValue += job.totalCompletedValue || 0;
            this.totalRemaining += job.remainingValue || 0;
            this.totalBilled += job.billedAmount || 0;
            this.totalPaid += job.paidAmount || 0;
            this.totalBalance += job.balanceAmount || 0;
            this.totalRetainage += job.retainageHeld || 0;
        });

        this.averageCompletion = this.totalContract > 0 ? (this.totalCompletedValue / this.totalContract) : 0;
    }

    switchToTableView() {
        this.showChart = false;
    }

    switchToChartView() {
        this.showChart = true;
        if (this.d3Initialized && this.isFinanceDataAvailable) {
            setTimeout(() => {
                this.renderChart();
            }, 0);
        }
    }

    handleValueTypeChange(event) {
        this.chartConfig.valueType = event.target.value;
        if (this.showChart && this.d3Initialized && this.isFinanceDataAvailable) {
            setTimeout(() => {
                this.renderChart();
            }, 0);
        }
    }

    openEditPopup(event) {
        const metricName = event.currentTarget.dataset.metric;
        this.currentEditingMetric = metricName;
        this.editSelectedStatuses = this.metricSettings[metricName] || [];
        this.showEditPopup = true;
    }

    closeEditPopup() {
        this.showEditPopup = false;
        this.currentEditingMetric = '';
        this.editSelectedStatuses = [];
    }

    handleStatusSelection(event) {
        this.editSelectedStatuses = event.detail.value;
    }

    handleModalClick(event) {
        event.stopPropagation();
    }

    async handleSave() {
        try {
            this.isLoading = true;
            this.metricSettings[this.currentEditingMetric] = this.editSelectedStatuses;

            const metricStatusMap = {};
            for (const [metricName, statuses] of Object.entries(this.metricSettings)) {
                metricStatusMap[metricName] = statuses;
            }

            await saveMetricSettings({ metricStatusMap: metricStatusMap });
            this.loadMetricsData();
            this.loadJobData();
            this.closeEditPopup();
            this.showToast('Success', 'Metric settings saved successfully', 'success');
        } catch (error) {
            this.showToast('Error', 'Failed to save settings: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleSearchInput(event) {
        this.searchTerm = event.target.value;
        this.applyFilters();
    }

    handleKeyPress(event) {
        if (event.key === 'Enter') {
            this.applyFilters();
        }
    }

    applyFilters() {
        let filteredData = [...this.allFinanceData];

        // Apply search filter
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filteredData = filteredData.filter(job => {
                const nameMatch = job.jobName?.toLowerCase().includes(searchLower);
                const numberMatch = job.jobNumber?.toLowerCase().includes(searchLower);
                return nameMatch || numberMatch;
            });
        }

        // Apply status filter
        if (this.selectedStatuses && this.selectedStatuses.length > 0) {
            filteredData = filteredData.filter(job => {
                // Handle "null" status value
                const jobStatus = job.status === null || job.status === undefined ? 'null' : job.status;
                return this.selectedStatuses.includes(jobStatus);
            });
        }

        // Reset to first page when filters change
        this.currentPage = 1;

        // Reassign serial numbers
        this.financeData = filteredData.map((job, index) => ({
            ...job,
            srNo: index + 1
        }));

        // Calculate pagination
        this.totalPages = Math.ceil(this.financeData.length / this.pageSize);
        this.updatePaginatedData();

        this.calculateTotals();

        // Re-render chart if needed
        if (this.showChart && this.d3Initialized && this.isFinanceDataAvailable) {
            setTimeout(() => {
                this.renderChart();
            }, 0);
        }
    }

    handleMetricClick(event) {
        const metricName = event.currentTarget.dataset.label;
        const statusesForMetric = this.metricSettings[metricName] || [];

        if (statusesForMetric.length > 0) {
            this.searchTerm = '';
            this.selectedStatuses = [...statusesForMetric];

            // Update the selected property in options
            this.statusOptions = this.statusOptions.map(option => ({
                ...option,
                selected: this.selectedStatuses.includes(option.value)
            }));

            this.filteredStatusOptions = this.filteredStatusOptions.map(option => ({
                ...option,
                selected: this.selectedStatuses.includes(option.value)
            }));

            this.applyFilters();
        } else {
            this.showToast('No Statuses', `No statuses configured for ${this.getMetricDisplayName(metricName)}`, 'warning');
        }
    }
    clearFilters() {
        this.searchTerm = '';
        this.statusSearchTerm = '';

        // Select ALL statuses including "None"
        this.selectedStatuses = this.statusOptions.map(option => option.value);

        // Update the selected property in options
        this.statusOptions = this.statusOptions.map(option => ({
            ...option,
            selected: true
        }));

        this.filteredStatusOptions = this.filteredStatusOptions.map(option => ({
            ...option,
            selected: true
        }));

        this.applyFilters();
    }

    renderChart() {
        if (!window.d3 || !this.isFinanceDataAvailable) return;

        const container = this.template.querySelector('.chart-container');
        if (!container) return;

        container.innerHTML = '';

        const margin = { top: 60, right: 20, bottom: 120, left: 100 };
        const containerWidth = container.clientWidth;

        const barMinHeight = 50; // minimum pixels per bar
        const chartData = [...this.financeData]
            .sort((a, b) => (b[this.chartConfig.valueType] || 0) - (a[this.chartConfig.valueType] || 0));

        // Calculate height based on number of items
        const calculatedHeight = chartData.length * barMinHeight + margin.top + margin.bottom;
        const containerHeight = calculatedHeight;

        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        const svg = window.d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', containerHeight)
            .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const currentValueType = this.chartConfig.valueType;
        const currentValueLabel = this.chartConfig.valueTypes.find(type => type.value === currentValueType)?.label || currentValueType;

        const maxValue = window.d3.max(chartData, d => d[currentValueType] || 0);
        const yDomain = [0, maxValue * 1.1];
        const yTickValues = this.generateNiceTickValues(yDomain[1]);

        const x = window.d3.scaleLinear()
            .domain(yDomain)
            .range([0, width])
            .nice();

        const y = window.d3.scaleBand()
            .domain(chartData.map(d => d.jobName))
            .range([0, height])
            .padding(0.4);

        const lightColors = [
            '#53bfc3ff',
            '#87d1fcff',
            '#5FA8D3',
            '#3D5A80',
            '#2A4B74',
            '#1E3A5F',
            '#155475',
            '#1B7F8C',
            '#2A9D8F',
            '#2E7DAF'
        ];

        const color = window.d3.scaleOrdinal()
            .domain(chartData.map((d, i) => i))
            .range(lightColors);

        const xAxis = svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(window.d3.axisBottom(x).tickValues(yTickValues).tickFormat(d => this.formatCurrency(d)));

        xAxis.selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .style('font-size', '11px')
            .style('fill', '#666');

        xAxis.select('.domain')
            .attr('stroke', '#666')
            .attr('stroke-width', 1);

        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#666')
            .text('Job Name');

        const yAxis = svg.append('g')
            .call(window.d3.axisLeft(y));

        yAxis.select('.domain')
            .attr('stroke', '#666')
            .attr('stroke-width', 1);

        yAxis.selectAll('text')
            .style('font-size', '11px')
            .style('fill', '#666')
            .each(function (d) {
                const text = window.d3.select(this);

                // Split text every 10 characters
                const parts = d.match(/.{1,10}/g);

                text.text(null);

                parts.forEach((p, i) => {
                    text.append("tspan")
                        .attr("x", text.attr("x"))
                        .attr("dy", i === 0 ? 0 : 12)
                        .text(p);
                });
            });


        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height + margin.bottom - 40)
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#666')
            .text(currentValueLabel);

        const dropdownGroup = svg.append('g')
            .attr('class', 'chart-dropdown')
            .attr('transform', `translate(${width - 200}, -45)`);

        dropdownGroup.append('text')
            .attr('x', 70)
            .attr('y', 2)
            .style('font-size', '12px')
            .style('fill', '#666')
            .style('font-weight', '500')
            .text('Change X-axis:');

        const foreignObject = dropdownGroup.append('foreignObject')
            .attr('x', 70)
            .attr('y', 6)
            .attr('width', 130)
            .attr('height', 26);

        const selectElement = foreignObject.append('xhtml:select')
            .style('width', '100%')
            .style('height', '24px')
            .style('border', '1px solid #ddd')
            .style('border-radius', '4px')
            .style('padding', '2px 8px')
            .style('font-size', '12px')
            .style('background', 'white')
            .style('color', '#333')
            .on('change', (event) => {
                this.chartConfig.valueType = event.target.value;
                this.renderChart();
            });

        selectElement.selectAll('option')
            .data(this.chartConfig.valueTypes)
            .enter()
            .append('xhtml:option')
            .attr('value', d => d.value)
            .property('selected', d => d.value === this.chartConfig.valueType)
            .text(d => d.label);

        const tooltip = window.d3.select(container)
            .append('div')
            .attr('class', 'chart-tooltip')
            .style('position', 'absolute')
            .style('background', 'white')
            .style('padding', '12px')
            .style('border', '1px solid #e0e0e0')
            .style('border-radius', '6px')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('font-size', '12px')
            .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
            .style('z-index', '1000')
            .style('max-width', '300px');

        svg.selectAll('.bar')
            .data(chartData)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('y', d => y(d.jobName))
            .attr('x', 0)
            .attr('height', y.bandwidth())
            .attr('width', d => x(d[currentValueType] || 0))
            .attr('fill', (d, i) => color(i))
            .attr('rx', 3)
            .attr('ry', 3)
            .style('cursor', 'pointer')
            .on('mouseover', function (event, d) {
                const value = d[currentValueType] || 0;
                tooltip
                    .style('opacity', 1)
                    .html(`
                    <div><strong>${d.jobName}</strong></div>
                    <div>${currentValueLabel}: $${window.d3.format(',')(value)}</div>
                `);
            })
            .on('mousemove', function (event) {
                tooltip
                    .style('left', (event.offsetX + 20) + 'px')
                    .style('top', (event.offsetY - 40) + 'px');
            })
            .on('mouseout', function () {
                window.d3.select(this)
                    .attr('stroke', 'none')
                    .attr('stroke-width', 0);
                tooltip.style('opacity', 0);
            });
    }


    generateNiceTickValues(maxValue) {
        if (maxValue <= 0) return [0, 1, 2];

        const exponent = Math.floor(Math.log10(maxValue));
        const magnitude = Math.pow(10, exponent);

        let step;
        if (maxValue / magnitude < 2) {
            step = magnitude / 5;
        } else if (maxValue / magnitude < 5) {
            step = magnitude / 2;
        } else {
            step = magnitude;
        }

        const niceMax = Math.ceil(maxValue / step) * step;
        const tickCount = Math.ceil(niceMax / step) + 1;
        const ticks = [];

        for (let i = 0; i < tickCount; i++) {
            ticks.push(i * step);
        }

        return ticks;
    }

    formatCurrency(value) {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
            return `$${(value / 1000).toFixed(0)}K`;
        } else {
            return `$${value}`;
        }
    }

    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(evt);
    }
}