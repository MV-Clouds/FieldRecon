import { LightningElement, track, wire } from 'lwc';
import getAllJobsWithScopeData from '@salesforce/apex/JobMetricsController.getAllJobsWithScopeData';
import getJobMetrics from '@salesforce/apex/JobMetricsController.getJobMetrics';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

// Import D3.js from static resource
import { loadScript } from 'lightning/platformResourceLoader';
import D3 from '@salesforce/resourceUrl/d3';

export default class JobReportDashboard extends LightningElement {
    @track isLoading = true;
    @track financeData = [];
    @track showChart = false;
    d3Initialized = false;

    // Metric data
    @track backlogCount = 0;
    @track backlogValue = 0;
    @track inProgressCount = 0;
    @track inProgressValue = 0;
    @track outstandingCount = 0;
    @track outstandingValue = 0;
    @track retainageCount = 0;
    @track retainageValue = 0;
    @track closeCount = 0;
    @track closeValue = 0;

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

    // Store wired responses for refresh
    wiredMetricsResponse;
    wiredJobDataResponse;

    connectedCallback() {
        // Load D3.js when component is connected
        this.loadD3();
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

    @wire(getJobMetrics)
    wiredMetrics(result) {
        this.wiredMetricsResponse = result;
        const { error, data } = result;
        if (data) {
            this.processMetricsData(data);
        } else if (error) {
            this.showToast('Error', 'Failed to load job metrics data: ' + error.body.message, 'error');
        }
    }

    @wire(getAllJobsWithScopeData)
    wiredJobData(result) {
        this.wiredJobDataResponse = result;
        const { error, data } = result;
        if (data) {
            this.processFinanceData(data);
        } else if (error) {
            this.showToast('Error', 'Failed to load finance data: ' + error.body.message, 'error');
            this.isLoading = false;
        }
    }

    get isFinanceDataAvailable() {
        return this.financeData && this.financeData.length > 0;
    }

    get tableButtonClass() {
        return `toggle-option ${!this.showChart ? 'active' : ''}`;
    }

    get chartButtonClass() {
        return `toggle-option ${this.showChart ? 'active' : ''}`;
    }

    processMetricsData(data) {
        this.backlogCount = data.backlog?.count || 0;
        this.backlogValue = data.backlog?.totalValue || 0;
        this.inProgressCount = data.inProgress?.count || 0;
        this.inProgressValue = data.inProgress?.totalValue || 0;
        this.outstandingCount = data.outstanding?.count || 0;
        this.outstandingValue = data.outstanding?.totalValue || 0;
        this.retainageCount = data.retainagePending?.count || 0;
        this.retainageValue = data.retainagePending?.totalValue || 0;
        this.closeCount = data.close?.count || 0;
        this.closeValue = data.close?.totalValue || 0;
    }

    processFinanceData(data) {
        this.financeData = data.map(job => {
            // Calculate values based on your formulas
            const totalContract = (job.baseContract || 0) + (job.changeOrder || 0);
            const completedValue = job.totalCompletedValue || 0;
            const completionPercentage = totalContract > 0 ? (completedValue / totalContract) : 0;
            const remainingValue = Math.max(0, totalContract - completedValue);

            return {
                ...job,
                totalContract: totalContract,
                percentComplete: completionPercentage,
                remainingValue: remainingValue,
                billedAmount: job.billedAmount || 0,
                paidAmount: job.paidAmount || 0,
                balanceAmount: job.balanceAmount || 0,
                retainageHeld: job.retainageHeld || 0
            };
        });

        this.calculateTotals();
        this.isLoading = false;

        // Render chart if chart view is active
        if (this.showChart && this.d3Initialized) {
            this.renderChart();
        }
    }

    calculateTotals() {
        // Reset totals
        this.totalContract = 0;
        this.totalBaseContract = 0;
        this.totalChangeOrder = 0;
        this.totalCompletedValue = 0;
        this.totalRemaining = 0;
        this.totalBilled = 0;
        this.totalPaid = 0;
        this.totalBalance = 0;
        this.totalRetainage = 0;

        // Calculate sums
        this.financeData.forEach(job => {
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

        // Calculate average completion percentage
        this.averageCompletion = this.totalContract > 0 ? (this.totalCompletedValue / this.totalContract) : 0;
    }

    switchToTableView() {
        this.showChart = false;
    }

    switchToChartView() {
        this.showChart = true;

        if (this.d3Initialized && this.isFinanceDataAvailable) {
            // Use setTimeout to ensure the DOM is updated
            setTimeout(() => {
                this.renderChart();
            }, 0);
        }
    }

    // Add handle value type changes
    handleValueTypeChange(event) {
        this.chartConfig.valueType = event.target.value;
        if (this.showChart && this.d3Initialized && this.isFinanceDataAvailable) {
            setTimeout(() => {
                this.renderChart();
            }, 0);
        }
    }

    // renderChart() {
    //     if (!window.d3 || !this.isFinanceDataAvailable) return;

    //     const container = this.template.querySelector('.chart-container');
    //     if (!container) return;

    //     // Clear previous chart
    //     container.innerHTML = '';

    //     const margin = { top: 60, right: 20, bottom: 120, left: 80 };
    //     const containerWidth = container.clientWidth;
    //     const containerHeight = 500;

    //     const width = containerWidth - margin.left - margin.right;
    //     const height = containerHeight - margin.top - margin.bottom;

    //     const svg = window.d3.select(container)
    //         .append('svg')
    //         .attr('width', '100%')
    //         .attr('height', containerHeight)
    //         .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
    //         .attr('preserveAspectRatio', 'xMidYMid meet')
    //         .append('g')
    //         .attr('transform', `translate(${margin.left},${margin.top})`);

    //     // Prepare data for chart 
    //     const chartData = [...this.financeData]
    //         .sort((a, b) => (b[this.chartConfig.valueType] || 0) - (a[this.chartConfig.valueType] || 0));

    //     // Get the current value type for display
    //     const currentValueType = this.chartConfig.valueType;
    //     const currentValueLabel = this.chartConfig.valueTypes.find(type => type.value === currentValueType)?.label || currentValueType;

    //     // Calculate Y-axis domain with proper tick values
    //     const maxValue = window.d3.max(chartData, d => d[currentValueType] || 0);
    //     const minValue = window.d3.min(chartData, d => d[currentValueType] || 0);

    //     // Create values for Y-axis
    //     const yDomain = [0, maxValue * 1.1];
    //     const yTickValues = this.generateNiceTickValues(yDomain[1]);

    //     const y = window.d3.scaleLinear()
    //         .domain(yDomain)
    //         .range([height, 0])
    //         .nice();

    //     const x = window.d3.scaleBand()
    //         .domain(chartData.map(d => d.jobName))
    //         .range([0, width])
    //         .padding(0.4);

    //     // Light color palette
    //     const lightColors = [
    //         '#8ECAE6', '#219EBC', '#126782', // Light blues
    //         '#FFB4A2', '#E5989B', '#B5838D', // Light pinks
    //         '#A7C957', '#606C38', '#283618', // Light greens
    //         '#E9C46A', '#F4A261', '#E76F51'  // Light oranges
    //     ];

    //     const color = window.d3.scaleOrdinal()
    //         .domain(chartData.map((d, i) => i))
    //         .range(lightColors);

    //     // Add X axis with consistent styling
    //     const xAxis = svg.append('g')
    //         .attr('transform', `translate(0,${height})`)
    //         .call(window.d3.axisBottom(x));

    //     // Style X axis labels and line
    //     xAxis.selectAll('text')
    //         .attr('transform', 'rotate(-45)')
    //         .style('text-anchor', 'end')
    //         .style('font-size', '11px')
    //         .style('fill', '#666');

    //     // Style X axis line to be visible
    //     xAxis.select('.domain')
    //         .attr('stroke', '#666')
    //         .attr('stroke-width', 1);

    //     // Add X axis label
    //     svg.append('text')
    //         .attr('x', width / 2)
    //         .attr('y', height + margin.bottom - 40)
    //         .style('text-anchor', 'middle')
    //         .style('font-size', '12px')
    //         .style('fill', '#666')
    //         .text('Job Name');

    //     // Add Y axis with consistent styling
    //     const yAxis = svg.append('g')
    //         .call(window.d3.axisLeft(y).tickValues(yTickValues).tickFormat(d => this.formatCurrency(d)));

    //     // Style Y axis line to match X axis
    //     yAxis.select('.domain')
    //         .attr('stroke', '#666')
    //         .attr('stroke-width', 1);

    //     yAxis.selectAll('text')
    //         .style('font-size', '11px')
    //         .style('fill', '#666');

    //     // Add Y axis label
    //     svg.append('text')
    //         .attr('transform', 'rotate(-90)')
    //         .attr('y', 0 - margin.left + 15)
    //         .attr('x', 0 - (height / 2))
    //         .attr('dy', '1em')
    //         .style('text-anchor', 'middle')
    //         .style('font-size', '12px')
    //         .style('fill', '#666')
    //         .text(`${currentValueLabel}`);

    //     // Add chart title 
    //     svg.append('text')
    //         .attr('x', width / 2)
    //         .attr('y', 0 - margin.top / 2)
    //         .attr('text-anchor', 'middle')
    //         .style('font-size', '16px')
    //         .style('font-weight', '600')
    //         .style('fill', '#5e5adb')
    //         .text(`Job Financial Overview`);

    //     // Add dropdown in the top
    //     const dropdownGroup = svg.append('g')
    //         .attr('class', 'chart-dropdown')
    //         .attr('transform', `translate(${width - 160}, -45)`);

    //     // Create foreignObject for the select element
    //     const foreignObject = dropdownGroup.append('foreignObject')
    //         .attr('x', 35)
    //         .attr('y', -4)
    //         .attr('width', 150)
    //         .attr('height', 26);

    //     const selectElement = foreignObject.append('xhtml:select')
    //         .style('width', '100%')
    //         .style('height', '24px')
    //         .style('border', '1px solid #ddd')
    //         .style('border-radius', '4px')
    //         .style('padding', '2px 8px')
    //         .style('font-size', '12px')
    //         .style('background', 'white')
    //         .style('color', '#333')
    //         .on('change', (event) => {
    //             this.chartConfig.valueType = event.target.value;
    //             this.renderChart();
    //         });

    //     selectElement.selectAll('option')
    //         .data(this.chartConfig.valueTypes)
    //         .enter()
    //         .append('xhtml:option')
    //         .attr('value', d => d.value)
    //         .property('selected', d => d.value === this.chartConfig.valueType)
    //         .text(d => d.label);

    //     // Create tooltip
    //     const tooltip = window.d3.select(container)
    //         .append('div')
    //         .attr('class', 'chart-tooltip')
    //         .style('position', 'absolute')
    //         .style('background', 'white')
    //         .style('padding', '12px')
    //         .style('border', '1px solid #e0e0e0')
    //         .style('border-radius', '6px')
    //         .style('pointer-events', 'none')
    //         .style('opacity', 0)
    //         .style('font-size', '12px')
    //         .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
    //         .style('z-index', '1000')
    //         .style('max-width', '300px');

    //     // Add bars with light colors
    //     svg.selectAll('.bar')
    //         .data(chartData)
    //         .enter()
    //         .append('rect')
    //         .attr('class', 'bar')
    //         .attr('x', d => x(d.jobName))
    //         .attr('y', d => y(d[currentValueType] || 0))
    //         .attr('width', x.bandwidth())
    //         .style('cursor', 'pointer')
    //         .style('pointer-events', 'all')
    //         .attr('height', d => height - y(d[currentValueType] || 0))
    //         .attr('fill', (d, i) => color(i))
    //         .attr('rx', 3) // Rounded corners
    //         .attr('ry', 3)
    //         .on('mouseover', function (event, d) {
    //             const value = d[currentValueType] || 0;
    //             tooltip
    //                 .style('opacity', 1)
    //                 .html(`<div style="font-weight:bold;">$${window.d3.format(',')(value)}</div>`);
    //         })

    //         .on('mousemove', function (event) {
    //             tooltip
    //                 .style('left', (event.offsetX + 20) + 'px')
    //                 .style('top', (event.offsetY - 40) + 'px');
    //         })

    //         .on('mouseout', function () {
    //             window.d3.select(this)
    //                 .attr('stroke', 'none')
    //                 .attr('stroke-width', 0);
    //             tooltip.style('opacity', 0);
    //         });
    // }

    renderChart() {
        if (!window.d3 || !this.isFinanceDataAvailable) return;

        const container = this.template.querySelector('.chart-container');
        if (!container) return;

        // Clear previous chart
        container.innerHTML = '';

        const margin = { top: 60, right: 20, bottom: 120, left: 80 };
        const containerWidth = container.clientWidth;
        const containerHeight = 500;

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

        // Prepare data for chart 
        const chartData = [...this.financeData]
            .sort((a, b) => (b[this.chartConfig.valueType] || 0) - (a[this.chartConfig.valueType] || 0));

        // Get the current value type for display
        const currentValueType = this.chartConfig.valueType;
        const currentValueLabel = this.chartConfig.valueTypes.find(type => type.value === currentValueType)?.label || currentValueType;

        // Calculate Y-axis domain with proper tick values
        const maxValue = window.d3.max(chartData, d => d[currentValueType] || 0);
        const minValue = window.d3.min(chartData, d => d[currentValueType] || 0);

        // Create values for Y-axis
        const yDomain = [0, maxValue * 1.1];
        const yTickValues = this.generateNiceTickValues(yDomain[1]);

        const y = window.d3.scaleLinear()
            .domain(yDomain)
            .range([height, 0])
            .nice();

        const x = window.d3.scaleBand()
            .domain(chartData.map(d => d.jobName))
            .range([0, width])
            .padding(0.4);

        // Light color palette
        const lightColors = [
            '#8ECAE6', '#219EBC', '#126782', // Light blues
            '#FFB4A2', '#E5989B', '#B5838D', // Light pinks
            '#A7C957', '#606C38', '#283618', // Light greens
            '#E9C46A', '#F4A261', '#E76F51'  // Light oranges
        ];

        const color = window.d3.scaleOrdinal()
            .domain(chartData.map((d, i) => i))
            .range(lightColors);

        // Add X axis with consistent styling
        const xAxis = svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(window.d3.axisBottom(x));

        // Style X axis labels and line
        xAxis.selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .style('font-size', '11px')
            .style('fill', '#666');

        // Style X axis line to be visible
        xAxis.select('.domain')
            .attr('stroke', '#666')
            .attr('stroke-width', 1);

        // Add X axis label
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height + margin.bottom - 40)
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#666')
            .text('Job Name');

        // Add Y axis with consistent styling
        const yAxis = svg.append('g')
            .call(window.d3.axisLeft(y).tickValues(yTickValues).tickFormat(d => this.formatCurrency(d)));

        // Style Y axis line to match X axis
        yAxis.select('.domain')
            .attr('stroke', '#666')
            .attr('stroke-width', 1);

        yAxis.selectAll('text')
            .style('font-size', '11px')
            .style('fill', '#666');

        // Add Y axis label
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left + 15)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#666')
            .text(`${currentValueLabel}`);

        // Add chart title 
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 0 - margin.top / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('font-weight', '600')
            .style('fill', '#5e5adb')
            .text(`Job Financial Overview`);

        // Add dropdown in the top
        const dropdownGroup = svg.append('g')
            .attr('class', 'chart-dropdown')
            .attr('transform', `translate(${width - 160}, -45)`);

        // Create foreignObject for the select element
        const foreignObject = dropdownGroup.append('foreignObject')
            .attr('x', 35)
            .attr('y', -4)
            .attr('width', 150)
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

        // Create tooltip
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

        // Add bars with light colors and hover effects
        svg.selectAll('.bar')
            .data(chartData)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.jobName))
            .attr('y', d => y(d[currentValueType] || 0))
            .attr('width', x.bandwidth())
            .attr('height', d => height - y(d[currentValueType] || 0))
            .attr('fill', (d, i) => color(i))
            .attr('rx', 3) // Rounded corners
            .attr('ry', 3)
            .style('cursor', 'pointer') // Add pointer cursor on hover
            .on('mouseover', function (event, d) {
                const value = d[currentValueType] || 0;
                tooltip
                    .style('opacity', 1)
                    .html(`
                    <div>$${window.d3.format(',')(value)}</div>
                `);
            })
            .on('mousemove', function (event) {
                tooltip
                    .style('left', (event.offsetX + 20) + 'px')
                    .style('top', (event.offsetY - 40) + 'px');
            })
            .on('mouseout', function () {
                // Remove hover effect from bar
                window.d3.select(this)
                    .attr('stroke', 'none')
                    .attr('stroke-width', 0);
                tooltip.style('opacity', 0);
            });
    }

    // Helper method to generate nice tick values for Y-axis
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

    // Helper method to format currency values
    formatCurrency(value) {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
            return `$${(value / 1000).toFixed(0)}K`;
        } else {
            return `$${value}`;
        }
    }

    async handleRefresh() {
        this.isLoading = true;
        try {
            await Promise.all([
                refreshApex(this.wiredMetricsResponse),
                refreshApex(this.wiredJobDataResponse)
            ]);

        } catch (error) {
            this.showToast('Error', 'Failed to refresh data: ' + error.body?.message || error.message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    //Displays a toast notification with specified title, message, and variant.
    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(evt);
    }
}