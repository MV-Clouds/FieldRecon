import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getProposalLinesWithBudgets from '@salesforce/apex/ProposalLinesContainerController.getProposalLinesWithBudgets';
import getPricebooks from '@salesforce/apex/ProposalLinesContainerController.getPricebooks';
import getProductsByPricebook from '@salesforce/apex/ProposalLinesContainerController.getProductsByPricebook';
import saveProposalLines from '@salesforce/apex/ProposalLinesContainerController.saveProposalLines';
import deleteProposalLine from '@salesforce/apex/ProposalLinesContainerController.deleteProposalLine';
import deleteBudgetLine from '@salesforce/apex/ProposalLinesContainerController.deleteBudgetLine';
import getProposalDefaults from '@salesforce/apex/ProposalLinesContainerController.getProposalDefaults';
import saveAllChanges from '@salesforce/apex/ProposalLinesContainerController.saveAllChanges';

export default class ProposalLinesContainer extends NavigationMixin(LightningElement) {
    @api recordId;
    @track isLoading = false;
    @track proposalLinesRaw = [];
    @track showAddModal = false;
    @track isModalLoading = false;
    @track isSaving = false;
    @track proposalDefaults = { oh: 0, warranty: 0, profit: 0 };
    @track pricebookOptions = [];
    @track newProposalLines = [];
    @track editingBudgetLines = new Map();
    @track hasModificationsBySection = new Map();
    @track isSavingBySection = new Map();
    @track editingProposalLines = new Set();
    @track editingBudgetCells = new Set();
    @track modifiedProposalLines = new Map();
    @track originalProposalLineValues = new Map();
    @track modifiedBudgetLineFields = new Map();
    @track manuallyEditedSalesPrices = new Map(); // Track manually edited sales prices
    @track manuallyEditedUnitPrices = new Map(); // Track manually edited unit prices
    @track editingFieldValues = new Map(); // Store raw string values during editing
    @track showConfirmModal = false;
    @track confirmModalTitle = '';
    @track confirmModalMessage = '';
    @track confirmModalAction = null;
    @track confirmModalData = null;
    @track originalSequences = new Map(); // Store original sequences
    @track hasSequenceChanges = false; // Track if sequences have been modified
    @track activeSectionName = ['baseContractSection', 'alternateSection'];
    @track accordionStyleApplied = false;
    draggedLineId = null;
    draggedOverLineId = null;

    costTypes = ['labor', 'materials', 'hotel', 'mileage', 'perdiem'];

    // Type options for proposal lines
    typeOptions = [
        { label: 'Base Contract', value: 'Base Contract' },
        { label: 'Alternate', value: 'Alternate' }
    ];

    // Get type options with selected state for a line
    getTypeOptionsForLine(lineType) {
        return this.typeOptions.map(option => ({
            ...option,
            selected: option.value === (lineType || 'Base Contract')
        }));
    }

    // Helper method to safely get field value (avoid undefined)
    safeValue(value, defaultValue = '') {
        return (value !== undefined && value !== null) ? value : defaultValue;
    }

    safeNumber(value, defaultValue = 0) {
        const num = parseFloat(value);
        return (!isNaN(num)) ? num : defaultValue;
    }

    // Format number as currency with commas
    formatCurrency(value, decimals = 2) {
        const num = this.safeNumber(value, 0);
        return num.toLocaleString('en-US', { 
            minimumFractionDigits: decimals, 
            maximumFractionDigits: decimals 
        });
    }

    getBudgetCellClass(isModified, baseClass = 'editable-cell') {
        return isModified ? `${baseClass} modified-cell` : baseClass;
    }

    connectedCallback() {
        this.loadProposalDefaults();
        this.loadProposalLines();
    }

    /**
     * Method Name: renderedCallback    
     * @description: Apply accordion styling once
    */
    renderedCallback() {
        if(!this.accordionStyleApplied){
            this.applyAccordionStyling();
        }
    }

    /**
     * Method Name: applyAccordionStyling   
     * @description: Dynamically apply styles to accordion headers
     */
    applyAccordionStyling() {
        try {
            // Create style element if it doesn't exist
            const style = document.createElement('style');
            style.textContent = `
                .prop-accordion-container .section-control {
                    background: rgba(94, 90, 219, 0.9) !important;
                    color: white !important;
                    margin-bottom: 4px;
                    --slds-c-icon-color-foreground-default: #ffffff !important;
                    font-weight: 600 !important;
                    border-radius: 8px;
                    padding: 8px 16px;
                }

                .prop-accordion-container .slds-accordion__summary-content {
                    font-size: medium;
                }
                
            `;
            
            // Append to component's template
            const accordionContainer = this.template.querySelector('.prop-accordion-container');
            if (accordionContainer) {
                accordionContainer.appendChild(style);
                this.accordionStyleApplied = true;
            }
            
        } catch (error) {
            console.log('Error applying accordion styling: ', error);
        }
    }

    // Load proposal defaults (OH, Warranty, Profit)
    loadProposalDefaults() {
        getProposalDefaults({ proposalId: this.recordId })
            .then(result => {
                if (result.success && result.data) {
                    this.proposalDefaults = result.data;
                }
            })
            .catch(error => {
                console.error('Error loading proposal defaults:', error);
            });
    }

    // Load proposal lines with budgets and budget lines
    loadProposalLines() {
        this.isLoading = true;
        getProposalLinesWithBudgets({ proposalId: this.recordId })
            .then(result => {
                if (result.success && result.data) {
                    const lines = result.data.proposalLines || [];

                    // Sort by sequence field
                    lines.sort((a, b) => {
                        const seqA = a.wfrecon__Sequence__c || 0;
                        const seqB = b.wfrecon__Sequence__c || 0;
                        return seqA - seqB;
                    });

                    this.proposalLinesRaw = lines;
                    // Process and organize budget lines by cost type
                    this.proposalLinesRaw.forEach((line, index) => {
                        line.isExpanded = false;
                        line.budgetRowKey = `budget-${line.Id}`;
                        line.recordLink = `/${line.Id}`;
                        // Use database sequence or fall back to position-based numbering
                        line.currentSequence = line.wfrecon__Sequence__c ? parseInt(line.wfrecon__Sequence__c) : (index + 1);

                        if (line.wfrecon__Budgets__r && line.wfrecon__Budgets__r.length > 0) {
                            const budget = line.wfrecon__Budgets__r[0];
                            // Organize budget lines by cost type
                            const budgetLinesByCostType = this.organizeBudgetLinesByCostType(budget.wfrecon__Budget_Lines__r || [], line.Id);

                            // Create clean budget object without raw budget lines
                            line.budget = {
                                Id: budget.Id,
                                Name: budget.Name,
                                budgetLinesByCostType: budgetLinesByCostType,
                                laborHasModifications: false,
                                materialHasModifications: false,
                                hotelHasModifications: false,
                                mileageHasModifications: false,
                                perdiemHasModifications: false
                            };
                        }
                        // Remove the raw Budgets__r to avoid duplication
                        delete line.wfrecon__Budgets__r;
                    });

                    // Store original sequences
                    this.originalSequences.clear();
                    this.proposalLinesRaw.forEach(line => {
                        this.originalSequences.set(line.Id, line.currentSequence);
                    });
                    this.hasSequenceChanges = false;
                }
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error loading proposal lines:', error);
                this.showToast('Error', 'Unable to load proposal lines', 'error');
                this.isLoading = false;
            });
    }

    // Organize budget lines by cost type
    organizeBudgetLinesByCostType(budgetLines, proposalLineId) {
        const organized = {
            labor: [],
            materials: [],
            hotel: [],
            mileage: [],
            perdiem: []
        };

        budgetLines.forEach(line => {
            const costType = (line.wfrecon__Cost_Type__c || '').toLowerCase().replace(/\s+/g, '');
            if (organized[costType]) {
                // Create a new object to avoid mutations affecting original
                const clonedLine = {
                    ...line,
                    // Ensure all fields have safe values
                    wfrecon__No_Of_Crew_Members__c: this.safeNumber(line.wfrecon__No_Of_Crew_Members__c),
                    wfrecon__Hrs_day__c: this.safeNumber(line.wfrecon__Hrs_day__c),
                    wfrecon__Burden_Rate_Hour__c: this.safeNumber(line.wfrecon__Burden_Rate_Hour__c),
                    wfrecon__of_Days__c: this.safeNumber(line.wfrecon__of_Days__c),
                    wfrecon__Estimated_Hours__c: this.safeNumber(line.wfrecon__Estimated_Hours__c),
                    wfrecon__Labor_Cost__c: this.safeNumber(line.wfrecon__Labor_Cost__c),
                    wfrecon__Note__c: this.safeValue(line.wfrecon__Note__c),

                    wfrecon__Material__c: this.safeValue(line.wfrecon__Material__c),
                    wfrecon__QTY__c: this.safeNumber(line.wfrecon__QTY__c),
                    wfrecon__Cost_Each__c: this.safeNumber(line.wfrecon__Cost_Each__c),
                    wfrecon__Material_Cost__c: this.safeNumber(line.wfrecon__Material_Cost__c),

                    wfrecon__Of_Nights__c: this.safeNumber(line.wfrecon__Of_Nights__c),
                    wfrecon__Number_Of_Rooms__c: this.safeNumber(line.wfrecon__Number_Of_Rooms__c),
                    wfrecon__Costs_Per_Night__c: this.safeNumber(line.wfrecon__Costs_Per_Night__c),
                    wfrecon__Total_Hotel_Cost__c: this.safeNumber(line.wfrecon__Total_Hotel_Cost__c),

                    wfrecon__Of_Trips__c: this.safeNumber(line.wfrecon__Of_Trips__c),
                    wfrecon__Of_Trucks__c: this.safeNumber(line.wfrecon__Of_Trucks__c),
                    wfrecon__Mileage__c: this.safeNumber(line.wfrecon__Mileage__c),
                    wfrecon__Mileage_Rate__c: this.safeNumber(line.wfrecon__Mileage_Rate__c),
                    wfrecon__Total_Mileage__c: this.safeNumber(line.wfrecon__Total_Mileage__c),

                    wfrecon__Per_Diem_of_Days__c: this.safeNumber(line.wfrecon__Per_Diem_of_Days__c),
                    wfrecon__Per_Diem_Rate__c: this.safeNumber(line.wfrecon__Per_Diem_Rate__c),
                    wfrecon__Total_Per_Diem__c: this.safeNumber(line.wfrecon__Total_Per_Diem__c),
                    wfrecon__of_Men__c: this.safeNumber(line.wfrecon__of_Men__c)
                };

                organized[costType].push(clonedLine);
            }
        });

        // Add displayIndex to each budget line
        Object.keys(organized).forEach(costType => {
            organized[costType].forEach((line, index) => {
                line.displayIndex = index + 1;
                line.isBeingEdited = false;

                // Add field-specific editing flags based on editingBudgetCells
                const budgetLineId = line.Id || line.tempId;
                const modifiedFields = this.modifiedBudgetLineFields.get(budgetLineId) || new Set();

                // Labor fields
                line.isEditingCrew = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__No_Of_Crew_Members__c`);
                line.isEditingHrsDay = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Hrs_day__c`);
                line.isEditingBurdenRate = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Burden_Rate_Hour__c`);
                line.isEditingDays = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__of_Days__c`);
                line.isEditingNote = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Note__c`);

                // Labor cell classes - check if specific field is modified
                line.crewCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__No_Of_Crew_Members__c'));
                line.hrsDayCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__Hrs_day__c'));
                line.burdenRateCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__Burden_Rate_Hour__c'));
                line.daysCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__of_Days__c'));
                line.noteCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__Note__c'));

                // Materials fields
                line.isEditingMaterial = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Material__c`);
                line.isEditingQty = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__QTY__c`);
                line.isEditingCostEach = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Cost_Each__c`);

                // Materials cell classes - check if specific field is modified
                line.materialCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__Material__c'));
                line.qtyCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__QTY__c'));
                line.costEachCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__Cost_Each__c'));

                // Hotel fields
                line.isEditingNights = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Of_Nights__c`);
                line.isEditingRooms = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Number_Of_Rooms__c`);
                line.isEditingCostPerNight = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Costs_Per_Night__c`);

                // Hotel cell classes - check if specific field is modified
                line.nightsCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__Of_Nights__c'));
                line.roomsCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__Number_Of_Rooms__c'));
                line.costPerNightCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__Costs_Per_Night__c'));

                // Mileage fields
                line.isEditingTrips = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Of_Trips__c`);
                line.isEditingTrucks = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Of_Trucks__c`);
                line.isEditingMileage = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Mileage__c`);
                line.isEditingMileageRate = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Mileage_Rate__c`);

                // Mileage cell classes - check if specific field is modified
                line.tripsCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__Of_Trips__c'));
                line.trucksCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__Of_Trucks__c'));
                line.mileageCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__Mileage__c'));
                line.mileageRateCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__Mileage_Rate__c'));

                // Per Diem fields
                line.isEditingPerDiemDays = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Per_Diem_of_Days__c`);
                line.isEditingMen = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__of_Men__c`);
                line.isEditingPerDiemRate = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Per_Diem_Rate__c`);

                // Per Diem cell classes - check if specific field is modified
                line.perDiemDaysCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__Per_Diem_of_Days__c'));
                line.menCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__of_Men__c'));
                line.perDiemRateCellClass = this.getBudgetCellClass(modifiedFields.has('wfrecon__Per_Diem_Rate__c'));
            });
        });

        return organized;
    }

    // Get formatted proposal lines
    get proposalLines() {
        return this.proposalLinesRaw.map((line, index) => {
            const modifiedFields = this.modifiedProposalLines.get(line.Id) || new Set();
            const isEditingSalesPrice = this.editingProposalLines.has(`${line.Id}_wfrecon__Sales_Price__c`);
            const editingKey = `${line.Id}_wfrecon__Sales_Price__c`;
            
            return {
                ...line,
                serialNumber: line.currentSequence || (index + 1),
                totalAmount: this.formatCurrency(line.wfrecon__Total_Cost__c),
                isOddRow: (index % 2 === 0),
                isModified: modifiedFields.size > 0,
                isEditingQuantity: this.editingProposalLines.has(`${line.Id}_wfrecon__Quantity__c`),
                isEditingUnitPrice: this.editingProposalLines.has(`${line.Id}_wfrecon__Unit_Price__c`),
                isEditingDescription: this.editingProposalLines.has(`${line.Id}_wfrecon__Description__c`),
                isEditingProfit: this.editingProposalLines.has(`${line.Id}_wfrecon__Profit_Per__c`),
                isEditingSalesPrice: isEditingSalesPrice,
                // CSS classes for each field
                quantityCellClass: modifiedFields.has('wfrecon__Quantity__c')
                    ? 'center-trancate-text editable-cell modified-cell'
                    : 'center-trancate-text editable-cell',
                unitPriceCellClass: modifiedFields.has('wfrecon__Unit_Price__c')
                    ? 'center-trancate-text editable-cell modified-cell'
                    : 'center-trancate-text editable-cell',
                descriptionCellClass: modifiedFields.has('wfrecon__Description__c')
                    ? 'center-trancate-text editable-cell modified-cell'
                    : 'center-trancate-text editable-cell',
                profitCellClass: modifiedFields.has('wfrecon__Profit_Per__c')
                    ? 'center-trancate-text editable-cell modified-cell'
                    : 'center-trancate-text editable-cell',
                profitSummaryItemClass: modifiedFields.has('wfrecon__Profit_Per__c')
                    ? 'summary-item editable-summary-item modified-cell'
                    : 'summary-item editable-summary-item',
                salesPriceCellClass: modifiedFields.has('wfrecon__Sales_Price__c')
                    ? 'center-trancate-text editable-cell modified-cell'
                    : 'center-trancate-text editable-cell',
                // Safe values for display - use editing value if currently editing
                displayQuantity: this.safeNumber(line.wfrecon__Quantity__c, 0),
                displayUnitPrice: this.editingFieldValues.get(`${line.Id}_wfrecon__Unit_Price__c`) || this.safeNumber(line.wfrecon__Unit_Price__c, 0),
                formattedUnitPrice: this.formatCurrency(line.wfrecon__Unit_Price__c),
                displayDescription: this.safeValue(line.wfrecon__Description__c, ''),
                displayOH: this.safeNumber(line.wfrecon__OH_Per__c, 0),
                displayWarranty: this.safeNumber(line.wfrecon__Warranty_Per__c, 0),
                displayProfit: this.editingFieldValues.get(`${line.Id}_wfrecon__Profit_Per__c`) || this.safeNumber(line.wfrecon__Profit_Per__c, 0),
                displayOHAmount: this.formatCurrency(line.wfrecon__OH_Amount__c),
                displayWarrantyAmount: this.formatCurrency(line.wfrecon__Warranty_Amount__c),
                displayProfitAmount: this.formatCurrency(line.wfrecon__Profit_Amount__c),
                displayTotalCost: this.formatCurrency(line.wfrecon__Total_Cost__c),
                displayRecommendedPrice: this.safeNumber(line.wfrecon__Recommended_Price__c, 0),
                displaySalesPrice: this.editingFieldValues.get(`${line.Id}_wfrecon__Sales_Price__c`) || this.safeNumber(line.wfrecon__Sales_Price__c, 0),
                formattedRecommendedPrice: this.formatCurrency(line.wfrecon__Recommended_Price__c),
                formattedSalesPrice: this.formatCurrency(line.wfrecon__Sales_Price__c),
                displayLaborCost: this.formatCurrency(line.wfrecon__Labor_Cost__c),
                displayMaterialCost: this.formatCurrency(line.wfrecon__Material_Cost__c),
                displayHotelCost: this.formatCurrency(line.wfrecon__Hotel_Cost__c),
                displayMileageCost: this.formatCurrency(line.wfrecon__Mileage_Cost__c),
                displayPerDiemCost: this.formatCurrency(line.wfrecon__Per_Diem_Cost__c)
            };
        });
    }

    // Get Base Contract proposal lines
    get baseContractLines() {
        const lines = this.proposalLines.filter(line =>
            (line.wfrecon__Type__c || 'Base Contract') === 'Base Contract'
        );
        // Recalculate serialNumber for Base Contract lines only
        return lines.map((line, index) => ({
            ...line,
            serialNumber: index + 1
        }));
    }

    // Get Alternate proposal lines
    get alternateLines() {
        const lines = this.proposalLines.filter(line =>
            line.wfrecon__Type__c === 'Alternate'
        );
        // Recalculate serialNumber for Alternate lines only
        return lines.map((line, index) => ({
            ...line,
            serialNumber: index + 1
        }));
    }

    // Section labels with counts
    get baseContractSectionLabel() {
        return `Base Contract (${this.baseContractLines.length})`;
    }

    get alternateSectionLabel() {
        return `Alternate (${this.alternateLines.length})`;
    }

    // Get grand total of all proposal lines (only Base Contract)
    get grandTotal() {
        if (!this.proposalLinesRaw || this.proposalLinesRaw.length === 0) return '0.00';

        const total = this.proposalLinesRaw
            .filter(line => (line.wfrecon__Type__c || 'Base Contract') === 'Base Contract')
            .reduce((sum, line) => {
                return sum + this.safeNumber(line.wfrecon__Total_Cost__c, 0);
            }, 0);

        return this.formatCurrency(total);
    }

    // Get total sales price of all proposal lines (only Base Contract)
    get totalSalesPrice() {
        if (!this.proposalLinesRaw || this.proposalLinesRaw.length === 0) return '0.00';

        const total = this.proposalLinesRaw
            .filter(line => (line.wfrecon__Type__c || 'Base Contract') === 'Base Contract')
            .reduce((sum, line) => {
                return sum + this.safeNumber(line.wfrecon__Sales_Price__c, 0);
            }, 0);

        return this.formatCurrency(total);
    }

    // Get margin (Total Sales Price - Grand Total Cost)
    get margin() {
        const totalSales = parseFloat(this.totalSalesPrice.replace(/,/g, '')) || 0;
        const totalCost = parseFloat(this.grandTotal.replace(/,/g, '')) || 0;
        const marginValue = totalSales - totalCost;

        return this.formatCurrency(marginValue);
    }

    // Handle toggle expand/collapse
    handleToggleExpand(event) {
        const lineId = event.currentTarget.dataset.id;
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => ({
            ...line,
            isExpanded: line.Id === lineId ? !line.isExpanded : line.isExpanded
        }));
    }

    // Handle Add Proposal Line button click
    handleAddProposalLine() {
        this.showAddModal = true;
        this.loadPricebooks();
        this.initializeNewProposalLines();
    }

    // Load pricebooks
    loadPricebooks() {
        this.isModalLoading = true;
        getPricebooks()
            .then(result => {
                if (result.success && result.data) {
                    this.pricebookOptions = result.data.map(pb => ({
                        label: pb.Name,
                        value: pb.Id
                    }));
                }
                this.isModalLoading = false;
            })
            .catch(error => {
                console.error('Error loading pricebooks:', error);
                this.showToast('Error', 'Unable to load pricebooks', 'error');
                this.isModalLoading = false;
            });
    }

    // Initialize new proposal lines
    initializeNewProposalLines() {
        this.newProposalLines = [{
            tempId: `temp-0`,
            lineNumber: 1,
            pricebookId: '',
            productId: '',
            quantity: 1,
            oh: this.proposalDefaults.oh,
            warranty: this.proposalDefaults.warranty,
            profit: this.proposalDefaults.profit,
            description: '',
            type: 'Base Contract',
            typeOptionsWithSelection: this.getTypeOptionsForLine('Base Contract'),
            productOptions: [],
            canDelete: false
        }];
    }

    // Handle row pricebook change
    handleRowPricebookChange(event) {
        const tempId = event.currentTarget.dataset.id;
        const pricebookId = event.target.value;

        if (pricebookId) {
            this.loadProductsForRow(tempId, pricebookId);
        }

        this.newProposalLines = this.newProposalLines.map(line => {
            if (line.tempId === tempId) {
                return {
                    ...line,
                    pricebookId: pricebookId,
                    productId: '',
                    productOptions: []
                };
            }
            return line;
        });
    }

    // Load products for a specific row
    loadProductsForRow(tempId, pricebookId) {
        this.isModalLoading = true;
        getProductsByPricebook({ pricebookId: pricebookId })
            .then(result => {
                if (result.success && result.data) {
                    const productOptions = result.data.map(entry => ({
                        label: entry.Product2.Name,
                        value: entry.Product2Id,
                        description: entry.Product2.Description || ''
                    }));

                    this.newProposalLines = this.newProposalLines.map(line => {
                        if (line.tempId === tempId) {
                            return {
                                ...line,
                                productOptions: productOptions
                            };
                        }
                        return line;
                    });
                }
                this.isModalLoading = false;
            })
            .catch(error => {
                console.error('Error loading products:', error);
                this.showToast('Error', 'Unable to load products', 'error');
                this.isModalLoading = false;
            });
    }

    // Handle product change
    handleProductChange(event) {
        const tempId = event.currentTarget.dataset.id;
        const productId = event.target.value;

        this.newProposalLines = this.newProposalLines.map(line => {
            if (line.tempId === tempId) {
                // Find the product name and description from productOptions
                const selectedProduct = line.productOptions.find(opt => opt.value === productId);
                const productName = selectedProduct ? selectedProduct.label : '';
                const productDescription = selectedProduct ? selectedProduct.description : '';

                return {
                    ...line,
                    productId: productId,
                    productName: productName,
                    description: productDescription
                };
            }
            return line;
        });
    }

    // Handle line field change
    handleLineFieldChange(event) {
        const tempId = event.currentTarget.dataset.id;
        const field = event.currentTarget.dataset.field;
        const value = event.target.value;

        this.newProposalLines = this.newProposalLines.map(line => {
            if (line.tempId === tempId) {
                let fieldValue = field === 'quantity' || field === 'oh' || field === 'warranty' || field === 'profit'
                    ? parseFloat(value) || 0
                    : value;
                
                // Ensure quantity is at least 1 and is a whole number
                if (field === 'quantity') {
                    fieldValue = Math.round(fieldValue);
                    if (fieldValue <= 0) {
                        fieldValue = 1;
                    }
                }

                return {
                    ...line,
                    [field]: fieldValue
                };
            }
            return line;
        });
    }



    // Handle add another proposal line
    handleAddAnotherLine() {
        const newLine = {
            tempId: `temp-${this.newProposalLines.length}`,
            lineNumber: this.newProposalLines.length + 1,
            pricebookId: '',
            productId: '',
            quantity: 1,
            oh: this.proposalDefaults.oh,
            warranty: this.proposalDefaults.warranty,
            profit: this.proposalDefaults.profit,
            description: '',
            type: 'Base Contract',
            typeOptionsWithSelection: this.getTypeOptionsForLine('Base Contract'),
            productOptions: [],
            canDelete: true
        };

        this.newProposalLines = [...this.newProposalLines, newLine];

        // Scroll to bottom
        setTimeout(() => {
            const container = this.template.querySelector('[data-id="tableContainer"]');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 100);
    }

    // Handle remove proposal line
    handleRemoveLine(event) {
        const tempId = event.currentTarget.dataset.id;
        this.newProposalLines = this.newProposalLines.filter(line => line.tempId !== tempId);

        // Re-number lines
        this.newProposalLines = this.newProposalLines.map((line, index) => ({
            ...line,
            lineNumber: index + 1,
            canDelete: index > 0
        }));
    }

    // Handle save proposal lines
    handleSaveProposalLines() {
        // Validate required fields
        const hasInvalidLines = this.newProposalLines.some(line =>
            !line.pricebookId || !line.productId || !line.quantity || line.quantity <= 0
        );

        if (hasInvalidLines) {
            this.showToast('Validation Error', 'Please fill all required fields (Pricebook, Product, Quantity)', 'warning');
            return;
        }

        // Validate profit percentage: must be less than (100 - OH% - Warranty%)
        const invalidProfit = this.newProposalLines.find(line => {
            const profit = parseFloat(line.profit) || 0;
            const oh = parseFloat(line.oh) || 0;
            const warranty = parseFloat(line.warranty) || 0;
            const maxAllowed = 100 - oh - warranty;
            return profit <= 0 || profit >= maxAllowed;
        });

        if (invalidProfit) {
            const oh = parseFloat(invalidProfit.oh) || 0;
            const warranty = parseFloat(invalidProfit.warranty) || 0;
            const maxAllowed = 100 - oh - warranty;
            this.showToast('Validation Error', `Profit % must be greater than 0 and less than ${maxAllowed.toFixed(2)}%`, 'warning');
            return;
        }

        this.isSaving = true;

        // Get the highest sequence for Base Contract lines
        const maxBaseContractSequence = this.proposalLinesRaw
            .filter(line => (line.wfrecon__Type__c || 'Base Contract') === 'Base Contract')
            .reduce((max, line) => Math.max(max, line.currentSequence || 0), 0);

        let nextBaseContractSequence = maxBaseContractSequence + 1;

        const proposalLinesData = this.newProposalLines.map(line => {
            // Limit product name to 80 characters for proposal line name
            const proposalLineName = line.productName ? line.productName.substring(0, 80) : '';
            const lineType = line.type || 'Base Contract';
            
            // Set sequence based on type
            let sequence = 0;
            if (lineType === 'Base Contract') {
                sequence = nextBaseContractSequence++;
            }

            return {
                productId: line.productId,
                pricebookId: line.pricebookId,
                quantity: line.quantity,
                oh: line.oh,
                warranty: line.warranty,
                profit: line.profit,
                proposalLineName: proposalLineName,
                description: line.description || '',
                type: lineType,
                sequence: sequence
            };
        });

        const linesData = JSON.stringify({
            proposalId: this.recordId,
            proposalLines: proposalLinesData
        });

        saveProposalLines({ linesData: linesData })
            .then(result => {
                if (result.success) {
                    this.showToast('Success', result.message, 'success');
                    this.handleCloseModal();
                    this.loadProposalLines();
                } else {
                    this.showToast('Error', result.message, 'error');
                }
                this.isSaving = false;
            })
            .catch(error => {
                console.error('Error saving proposal lines:', error);
                this.showToast('Error', 'Unable to save proposal lines', 'error');
                this.isSaving = false;
            });
    }

    // Handle type field change in modal
    handleTypeFieldChange(event) {
        const tempId = event.currentTarget.dataset.id;
        const value = event.target.value;

        this.newProposalLines = this.newProposalLines.map(line => {
            if (line.tempId === tempId) {
                return {
                    ...line,
                    type: value,
                    typeOptionsWithSelection: this.getTypeOptionsForLine(value)
                };
            }
            return line;
        });
    }

    // Handle close modal
    handleCloseModal() {
        this.showAddModal = false;
        this.newProposalLines = [];
        this.isSaving = false;
    }

    // Handle delete proposal line
    handleDeleteProposalLine(event) {
        const lineId = event.currentTarget.dataset.id;

        this.confirmModalTitle = 'Delete Proposal Line';
        this.confirmModalMessage = 'Are you sure you want to delete this proposal line and its associated budget? This action cannot be undone.';
        this.confirmModalAction = 'deleteProposalLine';
        this.confirmModalData = { lineId };
        this.showConfirmModal = true;
    }

    confirmDeleteProposalLine(lineId) {
        this.isLoading = true;
        deleteProposalLine({ proposalLineId: lineId })
            .then(result => {
                if (result.success) {
                    this.showToast('Success', result.message, 'success');
                    // Reload data then clear all tracking like confirmDiscardAllChanges does
                    this.loadProposalLines();
                    this.editingProposalLines.clear();
                    this.modifiedProposalLines.clear();
                    this.originalProposalLineValues.clear();
                    this.manuallyEditedSalesPrices.clear();
                    this.editingBudgetLines.clear();
                    this.hasModificationsBySection.clear();
                    this.modifiedBudgetLineFields.clear();
                    this.hasSequenceChanges = false;
                } else {
                    this.showToast('Error', result.message, 'error');
                }
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error deleting proposal line:', error);
                this.showToast('Error', 'Unable to delete proposal line', 'error');
                this.isLoading = false;
            });
    }

    // Handle proposal line cell click to enter edit mode
    handleProposalLineCellClick(event) {
        // If clicking on an input, don't interfere
        if (event.target.tagName === 'INPUT') {
            return;
        }

        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const fieldName = event.currentTarget.dataset.field;
        const isEditable = event.currentTarget.dataset.editable === 'true';

        if (!isEditable) return;

        // Store original value if not already stored
        if (!this.originalProposalLineValues.has(proposalLineId)) {
            const line = this.proposalLinesRaw.find(l => l.Id === proposalLineId);
            if (line) {
                this.originalProposalLineValues.set(proposalLineId, {
                    wfrecon__Quantity__c: line.wfrecon__Quantity__c,
                    wfrecon__OH_Per__c: line.wfrecon__OH_Per__c,
                    wfrecon__Warranty_Per__c: line.wfrecon__Warranty_Per__c,
                    wfrecon__Profit_Per__c: line.wfrecon__Profit_Per__c
                });
            }
        }

        // Clear any existing edits
        this.editingProposalLines.clear();

        // Add this specific field to editing
        const editKey = `${proposalLineId}_${fieldName}`;
        this.editingProposalLines.add(editKey);
        
        this.proposalLinesRaw = [...this.proposalLinesRaw];

        // Focus the input in the next tick
        setTimeout(() => {
            const input = this.template.querySelector(`input[data-proposal-line-id="${proposalLineId}"][data-field="${fieldName}"]`);
            if (input) {
                input.focus();
                input.select();
            }
        }, 10);
    }

    // Handle proposal line field change
    handleProposalLineFieldChange(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const fieldName = event.currentTarget.dataset.field;
        let value = event.target.value;

        // Validate and limit decimal places to 2 for decimal fields
        const decimalFields = ['wfrecon__Unit_Price__c', 'wfrecon__Sales_Price__c', 'wfrecon__Profit_Per__c'];
        if (decimalFields.includes(fieldName) && value.includes('.')) {
            const parts = value.split('.');
            if (parts[1] && parts[1].length > 2) {
                // Limit to 2 decimal places
                value = parts[0] + '.' + parts[1].substring(0, 2);
                event.target.value = value;
            }
        }

        // Store raw string value for editing (preserves decimal points)
        const editKey = `${proposalLineId}_${fieldName}`;
        this.editingFieldValues.set(editKey, value);

        // Handle field value
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId) {
                let fieldValue;
                if (fieldName === 'wfrecon__Description__c') {
                    fieldValue = value;
                } else {
                    fieldValue = value === '' ? 0 : (parseFloat(value) || 0);
                }
                
                // Track manually edited sales prices
                if (fieldName === 'wfrecon__Sales_Price__c') {
                    this.manuallyEditedSalesPrices.set(proposalLineId, fieldValue);
                }
                
                // Track manually edited unit prices
                if (fieldName === 'wfrecon__Unit_Price__c') {
                    this.manuallyEditedUnitPrices.set(proposalLineId, fieldValue);
                }
                
                return {
                    ...line,
                    [fieldName]: fieldValue
                };
            }
            return line;
        });

        // Mark only this specific field as modified
        if (!this.modifiedProposalLines.has(proposalLineId)) {
            this.modifiedProposalLines.set(proposalLineId, new Set());
        }
        this.modifiedProposalLines.get(proposalLineId).add(fieldName);

        // Trigger appropriate calculation based on field changed
        if (fieldName === 'wfrecon__Unit_Price__c') {
            this.recalculateFromUnitPrice(proposalLineId);
        } else if (fieldName === 'wfrecon__Quantity__c') {
            this.recalculateFromQuantity(proposalLineId);
        } else if (fieldName === 'wfrecon__Profit_Per__c') {
            this.recalculateFromProfitPercent(proposalLineId);
        } else if (fieldName === 'wfrecon__Sales_Price__c') {
            this.recalculateFromSalesPrice(proposalLineId);
        }
    }

    // Handle proposal line field blur to exit edit mode (no auto-save)
    handleProposalLineFieldBlur(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const fieldName = event.currentTarget.dataset.field;
        const editKey = `${proposalLineId}_${fieldName}`;

        // Validate Quantity on blur
        if (fieldName === 'wfrecon__Quantity__c') {
            const line = this.proposalLinesRaw.find(l => l.Id === proposalLineId);
            if (line) {
                let quantity = parseFloat(line.wfrecon__Quantity__c);
                
                // Round to whole number and ensure at least 1
                quantity = Math.round(quantity);
                if (isNaN(quantity) || quantity <= 0) {
                    quantity = 1;
                }
                
                // Update if value changed (validation and formatting only)
                if (quantity !== line.wfrecon__Quantity__c) {
                    this.proposalLinesRaw = this.proposalLinesRaw.map(l => {
                        if (l.Id === proposalLineId) {
                            return {
                                ...l,
                                wfrecon__Quantity__c: quantity
                            };
                        }
                        return l;
                    });
                    this.showToast('Info', 'Quantity has been rounded to a whole number', 'info');
                    // Recalculate since we rounded the value
                    this.recalculateFromQuantity(proposalLineId);
                }
            }
        }

        // Validate Profit % on blur
        if (fieldName === 'wfrecon__Profit_Per__c') {
            const line = this.proposalLinesRaw.find(l => l.Id === proposalLineId);
            if (line) {
                let profit = parseFloat(line.wfrecon__Profit_Per__c);
                const oh = parseFloat(event.currentTarget.dataset.oh) || 0;
                const warranty = parseFloat(event.currentTarget.dataset.warranty) || 0;
                const maxAllowed = 100 - oh - warranty;
                
                // Round to 2 decimal places
                profit = Math.round(profit * 100) / 100;
                
                let needsRecalc = false;
                
                // Validate: Profit must be less than (100 - OH% - Warranty%)
                if (isNaN(profit) || profit <= 0) {
                    profit = 1.00;
                    needsRecalc = true;
                } else if (profit >= maxAllowed) {
                    // Reset to a safe value and show error
                    profit = Math.max(0.01, maxAllowed - 0.01);
                    this.showToast('Error', `Profit % must be less than ${maxAllowed.toFixed(2)}%. Value has been adjusted to ${profit.toFixed(2)}%.`, 'error');
                    needsRecalc = true;
                } else if (profit !== line.wfrecon__Profit_Per__c) {
                    // Value was rounded
                    needsRecalc = true;
                }
                
                if (needsRecalc) {
                    this.proposalLinesRaw = this.proposalLinesRaw.map(l => {
                        if (l.Id === proposalLineId) {
                            return {
                                ...l,
                                wfrecon__Profit_Per__c: profit
                            };
                        }
                        return l;
                    });
                    // Recalculate since we modified the value
                    this.recalculateFromProfitPercent(proposalLineId);
                }
            }
        }

        // Validate Sales Price on blur
        if (fieldName === 'wfrecon__Sales_Price__c') {
            const line = this.proposalLinesRaw.find(l => l.Id === proposalLineId);
            if (line) {
                let salesPrice = parseFloat(line.wfrecon__Sales_Price__c);
                const recommendedPrice = parseFloat(line.wfrecon__Recommended_Price__c) || 0;

                // Handle invalid or empty input
                if (isNaN(salesPrice) || salesPrice < 0) {
                    salesPrice = recommendedPrice;
                }

                // Validation only - ensure sales price is not less than recommended price
                if (salesPrice < recommendedPrice) {
                    this.proposalLinesRaw = this.proposalLinesRaw.map(l => {
                        if (l.Id === proposalLineId) {
                            return {
                                ...l,
                                wfrecon__Sales_Price__c: recommendedPrice
                            };
                        }
                        return l;
                    });
                    this.manuallyEditedSalesPrices.set(proposalLineId, recommendedPrice);
                    this.showToast('Error', `Sales Price cannot be less than Recommended Price ($${this.formatCurrency(recommendedPrice)})`, 'error');
                }
            }
        }

        this.editingProposalLines.delete(editKey);
        this.editingFieldValues.delete(editKey);
        this.proposalLinesRaw = [...this.proposalLinesRaw];
    }

    // Handle budget line cell click to enter edit mode
    handleBudgetLineCellClick(event) {
        try {
            if (event.target.tagName === 'INPUT') {
                return;
            }

            const proposalLineId = event.currentTarget.dataset.proposalLineId;
            const budgetLineId = event.currentTarget.dataset.budgetLineId;
            const fieldName = event.currentTarget.dataset.field;
            const isEditable = event.currentTarget.dataset.editable === 'true';

            if (!isEditable) return;

            // Clear any existing edits
            this.editingBudgetCells.clear();

            // Add this specific field to editing
            const editKey = `${proposalLineId}_${budgetLineId}_${fieldName}`;
            this.editingBudgetCells.add(editKey);

            // Reorganize budget lines to recalculate editing flags
            this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
                if (line.Id === proposalLineId && line.budget) {
                    // Flatten all budget lines
                    const allBudgetLines = [];
                    Object.keys(line.budget.budgetLinesByCostType).forEach(type => {
                        allBudgetLines.push(...(line.budget.budgetLinesByCostType[type] || []));
                    });

                    return {
                        ...line,
                        budget: {
                            ...line.budget,
                            budgetLinesByCostType: this.organizeBudgetLinesByCostType(allBudgetLines, line.Id)
                        }
                    };
                }
                return line;
            });

            // Focus the input in the next tick
            setTimeout(() => {
                const input = this.template.querySelector(`input[data-proposal-line-id="${proposalLineId}"][data-budget-line-id="${budgetLineId}"][data-field="${fieldName}"]`);
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 10);
        } catch (error) {
            console.error('Error in handleBudgetLineCellClick:', error);
        }
    }

    // Handle budget line field blur to exit edit mode
    handleBudgetLineCellBlur(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const budgetLineId = event.currentTarget.dataset.budgetLineId;
        const costType = event.currentTarget.dataset.costType;
        const fieldName = event.currentTarget.dataset.field;

        const editKey = `${proposalLineId}_${budgetLineId}_${fieldName}`;

        // Validate quantity-related fields (crew, rooms, men, qty, etc.)
        const quantityFields = [
            'wfrecon__No_Of_Crew_Members__c',
            'wfrecon__Number_Of_Rooms__c',
            'wfrecon__of_Men__c',
            'wfrecon__QTY__c'
        ];

        if (quantityFields.includes(fieldName)) {
            this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
                if (line.Id === proposalLineId && line.budget) {
                    const allBudgetLines = [];
                    let hasInvalidValue = false;
                    
                    Object.keys(line.budget.budgetLinesByCostType).forEach(type => {
                        const lines = line.budget.budgetLinesByCostType[type].map(budgetLine => {
                            if ((budgetLine.Id === budgetLineId || budgetLine.tempId === budgetLineId) && type === costType) {
                                let value = parseFloat(budgetLine[fieldName]);
                                // Round to whole number
                                value = Math.round(value);
                                if (isNaN(value) || value <= 0) {
                                    hasInvalidValue = true;
                                    value = 1;
                                }
                                // Update if value is different
                                if (value !== budgetLine[fieldName]) {
                                    hasInvalidValue = true;
                                    return {
                                        ...budgetLine,
                                        [fieldName]: value
                                    };
                                }
                            }
                            return budgetLine;
                        });
                        allBudgetLines.push(...lines);
                    });

                    if (hasInvalidValue) {
                        this.showToast('Info', 'Quantity has been rounded to a whole number', 'info');
                    }

                    // Recalculate after fixing invalid values
                    const recalculatedLines = allBudgetLines.map(bl => {
                        const type = bl.wfrecon__Cost_Type__c;
                        return this.calculateFormulaFields(bl, type);
                    });

                    this.recalculateProposalLineTotals(proposalLineId);

                    return {
                        ...line,
                        budget: {
                            ...line.budget,
                            budgetLinesByCostType: this.organizeBudgetLinesByCostType(recalculatedLines, line.Id)
                        }
                    };
                }
                return line;
            });
        }

        this.editingBudgetCells.delete(editKey);

        // Reorganize budget lines to recalculate editing flags
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId && line.budget) {
                // Flatten all budget lines
                const allBudgetLines = [];
                Object.keys(line.budget.budgetLinesByCostType).forEach(type => {
                    allBudgetLines.push(...(line.budget.budgetLinesByCostType[type] || []));
                });

                return {
                    ...line,
                    budget: {
                        ...line.budget,
                        budgetLinesByCostType: this.organizeBudgetLinesByCostType(allBudgetLines, line.Id)
                    }
                };
            }
            return line;
        });
    }

    // Show toast notification
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }

    // Confirmation modal handlers
    handleConfirmAction() {
        if (this.confirmModalAction === 'deleteProposalLine') {
            this.confirmDeleteProposalLine(this.confirmModalData.lineId);
        } else if (this.confirmModalAction === 'deleteBudgetLine') {
            this.confirmDeleteBudgetLine(this.confirmModalData.budgetLineId);
        } else if (this.confirmModalAction === 'discardAllChanges') {
            this.confirmDiscardAllChanges();
        }
        this.handleCloseConfirmModal();
    }

    handleCloseConfirmModal() {
        this.showConfirmModal = false;
        this.confirmModalTitle = '';
        this.confirmModalMessage = '';
        this.confirmModalAction = null;
        this.confirmModalData = null;
    }

    // Budget line section handlers
    handleToggleSection(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const costType = event.currentTarget.dataset.costType;

        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId && line.budget) {
                const sectionKey = `${costType}Expanded`;
                return {
                    ...line,
                    budget: {
                        ...line.budget,
                        [sectionKey]: !line.budget[sectionKey]
                    }
                };
            }
            return line;
        });
    }

    handleAddBudgetLineToSection(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const costType = event.currentTarget.dataset.costType;
        const budgetId = event.currentTarget.dataset.budgetId;

        // Add new empty budget line to the section
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId && line.budget) {
                const newBudgetLine = this.createEmptyBudgetLine(budgetId, costType);

                // Flatten all budget lines to an array
                const allBudgetLines = [];
                Object.keys(line.budget.budgetLinesByCostType).forEach(type => {
                    allBudgetLines.push(...(line.budget.budgetLinesByCostType[type] || []));
                });
                allBudgetLines.push(newBudgetLine);

                return {
                    ...line,
                    budget: {
                        ...line.budget,
                        budgetLinesByCostType: this.organizeBudgetLinesByCostType(allBudgetLines, line.Id)
                    }
                };
            }
            return line;
        });

        // Mark section as modified
        this.markSectionAsModified(proposalLineId, costType);

        // Recalculate proposal line totals
        this.recalculateProposalLineTotals(proposalLineId);
    }

    createEmptyBudgetLine(budgetId, costType) {
        const tempId = `temp-${Date.now()}`;
        const baseLine = {
            Id: tempId,  // Set Id to tempId for consistent identification
            tempId: tempId,
            wfrecon__Budget__c: budgetId,
            wfrecon__Cost_Type__c: costType,
            isNew: true
        };

        switch (costType) {
            case 'labor':
                return {
                    ...baseLine,
                    wfrecon__No_Of_Crew_Members__c: 0,
                    wfrecon__Hrs_day__c: 0,
                    wfrecon__Burden_Rate_Hour__c: 0,
                    wfrecon__of_Days__c: 0,
                    wfrecon__Estimated_Hours__c: 0,
                    wfrecon__Labor_Cost__c: 0,
                    wfrecon__Note__c: ''
                };
            case 'materials':
                return {
                    ...baseLine,
                    wfrecon__Material__c: '',
                    wfrecon__QTY__c: 0,
                    wfrecon__Cost_Each__c: 0,
                    wfrecon__Material_Cost__c: 0
                };
            case 'hotel':
                return {
                    ...baseLine,
                    wfrecon__Of_Nights__c: 0,
                    wfrecon__Number_Of_Rooms__c: 0,
                    wfrecon__Costs_Per_Night__c: 0,
                    wfrecon__Total_Hotel_Cost__c: 0
                };
            case 'mileage':
                return {
                    ...baseLine,
                    wfrecon__Of_Trips__c: 0,
                    wfrecon__Of_Trucks__c: 0,
                    wfrecon__Mileage__c: 0,
                    wfrecon__Mileage_Rate__c: 0,
                    wfrecon__Total_Mileage__c: 0
                };
            case 'perdiem':
                return {
                    ...baseLine,
                    wfrecon__Per_Diem_of_Days__c: 0,
                    wfrecon__Per_Diem_Rate__c: 0,
                    wfrecon__Total_Per_Diem__c: 0,
                    wfrecon__of_Men__c: 0
                };
            default:
                return baseLine;
        }
    }

    handleBudgetLineFieldChange(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const budgetLineId = event.currentTarget.dataset.budgetLineId;
        const costType = event.currentTarget.dataset.costType;
        const fieldName = event.currentTarget.dataset.field;
        let newValue = event.target.value;

        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId && line.budget) {
                // Flatten all budget lines to an array
                const allBudgetLines = [];
                Object.keys(line.budget.budgetLinesByCostType).forEach(type => {
                    const lines = line.budget.budgetLinesByCostType[type].map(budgetLine => {
                        if (type === costType && ((budgetLine.Id === budgetLineId) || (budgetLine.tempId === budgetLineId))) {
                            const updatedLine = {
                                ...budgetLine,
                                [fieldName]: newValue
                            };

                            // Track which field was modified only for existing (non-new) budget lines
                            if (!budgetLine.isNew) {
                                if (!this.modifiedBudgetLineFields.has(budgetLineId)) {
                                    this.modifiedBudgetLineFields.set(budgetLineId, new Set());
                                }
                                this.modifiedBudgetLineFields.get(budgetLineId).add(fieldName);
                            }

                            // Calculate formula fields based on cost type
                            return this.calculateFormulaFields(updatedLine, costType);
                        }
                        return budgetLine;
                    });
                    allBudgetLines.push(...lines);
                });

                return {
                    ...line,
                    budget: {
                        ...line.budget,
                        budgetLinesByCostType: this.organizeBudgetLinesByCostType(allBudgetLines, line.Id)
                    }
                };
            }
            return line;
        });

        this.markSectionAsModified(proposalLineId, costType);

        // Recalculate proposal line totals
        this.recalculateProposalLineTotals(proposalLineId);
    }

    calculateFormulaFields(budgetLine, costType) {
        const parseNum = (val) => parseFloat(val) || 0;

        switch (costType) {
            case 'labor':
                // Estimated Hours = No_Of_Crew_Members * Hrs_day * of_Days
                const estimatedHours = parseNum(budgetLine.wfrecon__No_Of_Crew_Members__c) *
                    parseNum(budgetLine.wfrecon__Hrs_day__c) *
                    parseNum(budgetLine.wfrecon__of_Days__c);
                budgetLine.wfrecon__Estimated_Hours__c = estimatedHours;

                // Labor Cost = Estimated_Hours * Burden_Rate_Hour
                budgetLine.wfrecon__Labor_Cost__c = estimatedHours * parseNum(budgetLine.wfrecon__Burden_Rate_Hour__c);
                break;

            case 'materials':
                // Material Cost Subtotal = QTY * Cost_Each
                budgetLine.wfrecon__Material_Cost__c = parseNum(budgetLine.wfrecon__QTY__c) *
                    parseNum(budgetLine.wfrecon__Cost_Each__c);
                break;

            case 'hotel':
                // Total Hotel Cost = Number_Of_Rooms * Of_Nights * Costs_Per_Night
                budgetLine.wfrecon__Total_Hotel_Cost__c = parseNum(budgetLine.wfrecon__Number_Of_Rooms__c) *
                    parseNum(budgetLine.wfrecon__Of_Nights__c) *
                    parseNum(budgetLine.wfrecon__Costs_Per_Night__c);
                break;

            case 'mileage':
                // Total Mileage = Of_Trucks * Of_Trips * Mileage * Mileage_Rate
                budgetLine.wfrecon__Total_Mileage__c = parseNum(budgetLine.wfrecon__Of_Trucks__c) *
                    parseNum(budgetLine.wfrecon__Of_Trips__c) *
                    parseNum(budgetLine.wfrecon__Mileage__c) *
                    parseNum(budgetLine.wfrecon__Mileage_Rate__c);
                break;

            case 'perdiem':
                // Total Per Diem = Per_Diem_of_Days * of_Men * Per_Diem_Rate
                budgetLine.wfrecon__Total_Per_Diem__c = parseNum(budgetLine.wfrecon__Per_Diem_of_Days__c) *
                    parseNum(budgetLine.wfrecon__of_Men__c) *
                    parseNum(budgetLine.wfrecon__Per_Diem_Rate__c);
                break;
        }

        return budgetLine;
    }

    // Recalculate from Total Cost change (updates Sales Price and all amounts)
    recalculateFromTotalCost(proposalLineId) {
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId) {
                const roundTo2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;
                const totalCost = parseFloat(line.wfrecon__Total_Cost__c) || 0;
                const ohPer = parseFloat(line.wfrecon__OH_Per__c) || 0;
                const profitPer = parseFloat(line.wfrecon__Profit_Per__c) || 0;
                const warrantyPer = parseFloat(line.wfrecon__Warranty_Per__c) || 0;

                // Calculate recommended price from total cost
                const denominator = 1 - ((ohPer + profitPer + warrantyPer) / 100);
                const recommendedPrice = denominator !== 0 ? totalCost / denominator : totalCost;
                
                // Update sales price if not manually edited or if recommended is higher
                let salesPrice = parseFloat(line.wfrecon__Sales_Price__c) || 0;
                const manuallyEditedPrice = this.manuallyEditedSalesPrices.get(line.Id);
                
                if (!manuallyEditedPrice || recommendedPrice > manuallyEditedPrice) {
                    salesPrice = recommendedPrice;
                    this.manuallyEditedSalesPrices.delete(line.Id);
                }

                // Calculate amounts from sales price
                const ohAmount = salesPrice * (ohPer / 100);
                const profitAmount = salesPrice * (profitPer / 100);
                const warrantyAmount = salesPrice * (warrantyPer / 100);

                line.wfrecon__Recommended_Price__c = roundTo2(recommendedPrice);
                line.wfrecon__Sales_Price__c = roundTo2(salesPrice);
                line.wfrecon__OH_Amount__c = roundTo2(ohAmount);
                line.wfrecon__Profit_Amount__c = roundTo2(profitAmount);
                line.wfrecon__Warranty_Amount__c = roundTo2(warrantyAmount);
            }
            return line;
        });
    }

    // Recalculate from Unit Price change (updates Total Cost → continues flow)
    recalculateFromUnitPrice(proposalLineId) {
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId) {
                const roundTo2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;
                const unitPrice = parseFloat(line.wfrecon__Unit_Price__c) || 0;
                const quantity = parseFloat(line.wfrecon__Quantity__c) || 1;

                // Calculate total cost
                const totalCost = unitPrice * quantity;
                line.wfrecon__Total_Cost__c = roundTo2(totalCost);
            }
            return line;
        });
        
        // Continue with total cost flow
        this.recalculateFromTotalCost(proposalLineId);
    }

    // Recalculate from Quantity change (updates Total Cost → continues flow)
    recalculateFromQuantity(proposalLineId) {
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId) {
                const roundTo2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;
                const unitPrice = parseFloat(line.wfrecon__Unit_Price__c) || 0;
                const quantity = parseFloat(line.wfrecon__Quantity__c) || 1;

                // Calculate total cost
                const totalCost = unitPrice * quantity;
                line.wfrecon__Total_Cost__c = roundTo2(totalCost);
            }
            return line;
        });
        
        // Continue with total cost flow
        this.recalculateFromTotalCost(proposalLineId);
    }

    // Recalculate from Sales Price change (updates amounts only)
    recalculateFromSalesPrice(proposalLineId) {
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId) {
                const roundTo2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;
                const salesPrice = parseFloat(line.wfrecon__Sales_Price__c) || 0;
                const ohPer = parseFloat(line.wfrecon__OH_Per__c) || 0;
                const profitPer = parseFloat(line.wfrecon__Profit_Per__c) || 0;
                const warrantyPer = parseFloat(line.wfrecon__Warranty_Per__c) || 0;

                // Calculate amounts from sales price
                const ohAmount = salesPrice * (ohPer / 100);
                const profitAmount = salesPrice * (profitPer / 100);
                const warrantyAmount = salesPrice * (warrantyPer / 100);

                line.wfrecon__OH_Amount__c = roundTo2(ohAmount);
                line.wfrecon__Profit_Amount__c = roundTo2(profitAmount);
                line.wfrecon__Warranty_Amount__c = roundTo2(warrantyAmount);
            }
            return line;
        });
    }

    // Recalculate from Profit % change (updates Total Cost → continues flow)
    recalculateFromProfitPercent(proposalLineId) {
        // Profit % affects the recommended price calculation
        this.recalculateFromTotalCost(proposalLineId);
    }

    // Recalculate all proposal line totals based on budget lines
    recalculateProposalLineTotals(proposalLineId) {
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id !== proposalLineId || !line.budget) {
                return line;
            }

            const parseNum = (val) => parseFloat(val) || 0;

            // Calculate cost totals from budget lines
            let laborCost = 0;
            let materialCost = 0;
            let hotelCost = 0;
            let mileageCost = 0;
            let perDiemCost = 0;

            // Sum up labor costs
            const laborLines = line.budget.budgetLinesByCostType.labor || [];
            laborCost = laborLines.reduce((sum, bl) => sum + parseNum(bl.wfrecon__Labor_Cost__c), 0);

            // Sum up material costs
            const materialLines = line.budget.budgetLinesByCostType.materials || [];
            materialCost = materialLines.reduce((sum, bl) => sum + parseNum(bl.wfrecon__Material_Cost__c), 0);

            // Sum up hotel costs
            const hotelLines = line.budget.budgetLinesByCostType.hotel || [];
            hotelCost = hotelLines.reduce((sum, bl) => sum + parseNum(bl.wfrecon__Total_Hotel_Cost__c), 0);

            // Sum up mileage costs
            const mileageLines = line.budget.budgetLinesByCostType.mileage || [];
            mileageCost = mileageLines.reduce((sum, bl) => sum + parseNum(bl.wfrecon__Total_Mileage__c), 0);

            // Sum up per diem costs
            const perDiemLines = line.budget.budgetLinesByCostType.perdiem || [];
            perDiemCost = perDiemLines.reduce((sum, bl) => sum + parseNum(bl.wfrecon__Total_Per_Diem__c), 0);

            // Calculate unit cost (sum of all budget line costs WITHOUT quantity)
            const unitCostFromBudget = laborCost + materialCost + hotelCost + mileageCost + perDiemCost;
            
            // Check if Unit Price was manually edited
            const manuallyEditedUnitPrice = this.manuallyEditedUnitPrices?.get(line.Id);
            const unitPrice = manuallyEditedUnitPrice !== undefined ? manuallyEditedUnitPrice : unitCostFromBudget;
            
            // Calculate total cost (unit price multiplied by quantity)
            const quantity = parseNum(line.wfrecon__Quantity__c) || 1;
            const totalCost = unitPrice * quantity;

            // Calculate sales price using the formula: Total_Cost / (1 - (OH% + Profit% + Warranty%))
            const ohPer = parseNum(line.wfrecon__OH_Per__c) / 100; // Convert percentage to decimal
            const profitPer = parseNum(line.wfrecon__Profit_Per__c) / 100;
            const warrantyPer = parseNum(line.wfrecon__Warranty_Per__c) / 100;

            const denominator = 1 - (ohPer + profitPer + warrantyPer);
            const recommendedPrice = denominator !== 0 ? totalCost / denominator : totalCost;

            // Set Sales Price to Recommended Price if not manually edited or if Recommended Price is higher
            let salesPrice = parseNum(line.wfrecon__Sales_Price__c);
            const prevRecommendedPrice = parseNum(line.wfrecon__Recommended_Price__c);
            const manuallyEditedPrice = this.manuallyEditedSalesPrices.get(line.Id);

            // Update sales price only if:
            // 1. It's not set yet, OR
            // 2. User has NOT manually edited it AND recommended price changed, OR
            // 3. User HAS manually edited it BUT new recommended price is higher than their manual value
            const shouldUpdateSalesPrice = !salesPrice ||
                (!manuallyEditedPrice && Math.abs(prevRecommendedPrice - recommendedPrice) > 0.01) ||
                (manuallyEditedPrice && recommendedPrice > manuallyEditedPrice);

            if (shouldUpdateSalesPrice) {
                salesPrice = recommendedPrice;
                // Clear manual edit tracking since we're auto-updating
                this.manuallyEditedSalesPrices.delete(line.Id);
                // Mark sales price as modified when auto-updated due to recommended price change
                if (!this.modifiedProposalLines.has(line.Id)) {
                    this.modifiedProposalLines.set(line.Id, new Set());
                }
                this.modifiedProposalLines.get(line.Id).add('wfrecon__Sales_Price__c');
            } else if (manuallyEditedPrice) {
                // Use the manually edited price if it's higher than or equal to recommended price
                salesPrice = manuallyEditedPrice;
            }

            // Calculate amount fields using the actual sales price
            const ohAmount = ohPer * salesPrice;
            const profitAmount = profitPer * salesPrice;
            const warrantyAmount = warrantyPer * salesPrice;
            
            // Round all calculated values to 2 decimal places
            const roundTo2 = (num) => Math.round(num * 100) / 100;

            return {
                ...line,
                wfrecon__Labor_Cost__c: roundTo2(laborCost),
                wfrecon__Material_Cost__c: roundTo2(materialCost),
                wfrecon__Hotel_Cost__c: roundTo2(hotelCost),
                wfrecon__Mileage_Cost__c: roundTo2(mileageCost),
                wfrecon__Per_Diem_Cost__c: roundTo2(perDiemCost),
                wfrecon__Total_Cost__c: roundTo2(totalCost),
                wfrecon__Recommended_Price__c: roundTo2(recommendedPrice),
                wfrecon__Sales_Price__c: roundTo2(salesPrice),
                wfrecon__Unit_Price__c: roundTo2(unitPrice),
                wfrecon__OH_Amount__c: roundTo2(ohAmount),
                wfrecon__Profit_Amount__c: roundTo2(profitAmount),
                wfrecon__Warranty_Amount__c: roundTo2(warrantyAmount)
            };
        });
    }

    markSectionAsModified(proposalLineId, costType) {
        if (!this.hasModificationsBySection.has(proposalLineId)) {
            this.hasModificationsBySection.set(proposalLineId, new Map());
        }
        this.hasModificationsBySection.get(proposalLineId).set(costType, true);

        // Update the budget object flag
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId && line.budget) {
                const flagMap = {
                    'Labor': 'laborHasModifications',
                    'Materials': 'materialsHasModifications',
                    'Hotel': 'hotelHasModifications',
                    'Mileage': 'mileageHasModifications',
                    'Per Diem': 'perdiemHasModifications'
                };

                return {
                    ...line,
                    budget: {
                        ...line.budget,
                        [flagMap[costType]]: true
                    }
                };
            }
            return line;
        });
    }

    extractBudgetLineFields(line, costType) {
        const fields = {};
        const roundTo2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;
        const roundTo0 = (num) => Math.round(parseFloat(num) || 0);

        switch (costType) {
            case 'labor':
                fields.noOfCrewMembers = roundTo0(line.wfrecon__No_Of_Crew_Members__c);
                fields.hrsDay = roundTo2(line.wfrecon__Hrs_day__c);
                fields.burdenRateHour = roundTo2(line.wfrecon__Burden_Rate_Hour__c);
                fields.ofDays = roundTo0(line.wfrecon__of_Days__c);
                fields.estimatedHours = roundTo2(line.wfrecon__Estimated_Hours__c);
                fields.laborCost = roundTo2(line.wfrecon__Labor_Cost__c);
                fields.note = line.wfrecon__Note__c;
                break;
            case 'materials':
                fields.materials = line.wfrecon__Material__c;
                fields.qty = roundTo0(line.wfrecon__QTY__c);
                fields.materialCostEach = roundTo2(line.wfrecon__Cost_Each__c);
                fields.materialCostSubTotal = roundTo2(line.wfrecon__Material_Cost__c);
                break;
            case 'hotel':
                fields.ofNights = roundTo0(line.wfrecon__Of_Nights__c);
                fields.numberOfRooms = roundTo0(line.wfrecon__Number_Of_Rooms__c);
                fields.costsPerNight = roundTo2(line.wfrecon__Costs_Per_Night__c);
                fields.totalHotelCost = roundTo2(line.wfrecon__Total_Hotel_Cost__c);
                break;
            case 'mileage':
                fields.ofTrips = roundTo0(line.wfrecon__Of_Trips__c);
                fields.ofTrucks = roundTo0(line.wfrecon__Of_Trucks__c);
                fields.mileage = roundTo2(line.wfrecon__Mileage__c);
                fields.mileageRate = roundTo2(line.wfrecon__Mileage_Rate__c);
                fields.totalMileage = roundTo2(line.wfrecon__Total_Mileage__c);
                break;
            case 'perdiem':
                fields.perDiemOfDays = roundTo0(line.wfrecon__Per_Diem_of_Days__c);
                fields.perDiemRate = roundTo2(line.wfrecon__Per_Diem_Rate__c);
                fields.totalPerDiem = roundTo2(line.wfrecon__Total_Per_Diem__c);
                fields.ofMen = roundTo0(line.wfrecon__of_Men__c);
                break;
        }

        return fields;
    }

    handleDeleteBudgetLine(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const budgetLineId = event.currentTarget.dataset.budgetLineId;
        const costType = event.currentTarget.dataset.costType;

        // If budget line doesn't have an ID (newly added, not saved), just remove it from the list
        if (!budgetLineId || budgetLineId.startsWith('temp-')) {
            this.removeNewBudgetLine(proposalLineId, budgetLineId, costType);
            return;
        }

        // For existing budget lines, show confirmation
        this.confirmModalTitle = 'Delete Budget Line';
        this.confirmModalMessage = 'Are you sure you want to delete this budget line?';
        this.confirmModalAction = 'deleteBudgetLine';
        this.confirmModalData = { proposalLineId, budgetLineId };
        this.showConfirmModal = true;
    }

    removeNewBudgetLine(proposalLineId, budgetLineId, costType) {
        // Clear modification tracking for this budget line
        this.modifiedBudgetLineFields.delete(budgetLineId);
        
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId && line.budget) {
                // Flatten all budget lines and filter out the one to remove
                const allBudgetLines = [];
                Object.keys(line.budget.budgetLinesByCostType).forEach(type => {
                    const lines = line.budget.budgetLinesByCostType[type].filter(bl => bl.Id !== budgetLineId);
                    allBudgetLines.push(...lines);
                });

                return {
                    ...line,
                    budget: {
                        ...line.budget,
                        budgetLinesByCostType: this.organizeBudgetLinesByCostType(allBudgetLines, line.Id)
                    }
                };
            }
            return line;
        });

        // Recalculate proposal line totals
        this.recalculateProposalLineTotals(proposalLineId);
    }

    confirmDeleteBudgetLine(budgetLineId) {
        this.isLoading = true;
        deleteBudgetLine({ budgetLineId: budgetLineId })
            .then(result => {
                if (result.success) {
                    this.showToast('Success', result.message, 'success');
                    // Reload data then clear all tracking like confirmDiscardAllChanges does
                    this.loadProposalLines();
                    this.editingProposalLines.clear();
                    this.modifiedProposalLines.clear();
                    this.originalProposalLineValues.clear();
                    this.manuallyEditedSalesPrices.clear();
                    this.editingBudgetLines.clear();
                    this.hasModificationsBySection.clear();
                    this.modifiedBudgetLineFields.clear();
                    this.hasSequenceChanges = false;
                } else {
                    this.showToast('Error', result.message, 'error');
                }
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error deleting budget line:', error);
                this.showToast('Error', 'Unable to delete budget line', 'error');
                this.isLoading = false;
            });
    }

    clearSectionModifications(proposalLineId, costType) {
        if (this.hasModificationsBySection.has(proposalLineId)) {
            this.hasModificationsBySection.get(proposalLineId).delete(costType);
        }

        // Update the budget object flag
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId && line.budget) {
                const flagMap = {
                    'Labor': 'laborHasModifications',
                    'Materials': 'materialsHasModifications',
                    'Hotel': 'hotelHasModifications',
                    'Mileage': 'mileageHasModifications',
                    'Per Diem': 'perdiemHasModifications'
                };

                return {
                    ...line,
                    budget: {
                        ...line.budget,
                        [flagMap[costType]]: false
                    }
                };
            }
            return line;
        });
    }

    hasSectionModifications(proposalLineId, costType) {
        return this.hasModificationsBySection.has(proposalLineId) &&
            this.hasModificationsBySection.get(proposalLineId).get(costType);
    }

    // Check if any proposal line has any modifications in any section OR if any proposal line fields are modified
    get hasAnyModifications() {
        // Check proposal line field modifications
        if (this.modifiedProposalLines.size > 0) return true;

        // Check budget line modifications
        if (this.hasModificationsBySection.size === 0) {
            // Check sequence changes
            return this.hasSequenceChanges;
        }

        for (let [costTypeMap] of this.hasModificationsBySection) {
            for (let [hasModifications] of costTypeMap) {
                if (hasModifications) return true;
            }
        }

        // Check sequence changes
        return this.hasSequenceChanges;
    }

    // Save all modified budget sections and proposal lines
    handleSaveAllBudgetSections() {
        const allBudgetLinesToSave = [];
        const modifiedProposalLinesArray = [];

        // Validate all sales prices and profit percentages before saving
        let hasInvalidSalesPrice = false;
        let hasInvalidProfit = false;
        let errorMessage = '';

        this.modifiedProposalLines.forEach((modifiedFields, proposalLineId) => {
            const line = this.proposalLinesRaw.find(l => l.Id === proposalLineId);
            if (line) {
                // Validate profit percentage
                if (modifiedFields.has('wfrecon__Profit_Per__c')) {
                    const profit = parseFloat(line.wfrecon__Profit_Per__c) || 0;
                    if (profit < 1 || profit > 100) {
                        hasInvalidProfit = true;
                        errorMessage = 'Profit percentage must be between 1 and 100';
                    }
                }
                
                // Validate sales price
                if (modifiedFields.has('wfrecon__Sales_Price__c')) {
                    const salesPrice = parseFloat(line.wfrecon__Sales_Price__c) || 0;
                    const recommendedPrice = parseFloat(line.wfrecon__Recommended_Price__c) || 0;

                    if (salesPrice < recommendedPrice) {
                        hasInvalidSalesPrice = true;
                        errorMessage = `Sales Price ($${this.formatCurrency(salesPrice)}) cannot be less than Recommended Price ($${this.formatCurrency(recommendedPrice)}) for ${line.Name}`;
                    }
                }
            }
        });

        if (hasInvalidSalesPrice || hasInvalidProfit) {
            this.showToast('Validation Error', errorMessage, 'error');
            return;
        }

        // Collect modified proposal lines
        const roundTo2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;
        
        this.modifiedProposalLines.forEach((modifiedFields, proposalLineId) => {
            const line = this.proposalLinesRaw.find(l => l.Id === proposalLineId);
            if (line && modifiedFields.size > 0) {
                const updateData = {
                    Id: line.Id,
                    wfrecon__Quantity__c: Math.round(parseFloat(line.wfrecon__Quantity__c) || 0),
                    wfrecon__Description__c: line.wfrecon__Description__c,
                    wfrecon__OH_Per__c: roundTo2(line.wfrecon__OH_Per__c),
                    wfrecon__Warranty_Per__c: roundTo2(line.wfrecon__Warranty_Per__c),
                    wfrecon__Profit_Per__c: Math.round(parseFloat(line.wfrecon__Profit_Per__c) || 0),
                    wfrecon__Sales_Price__c: roundTo2(line.wfrecon__Sales_Price__c),
                    wfrecon__Unit_Price__c: roundTo2(line.wfrecon__Unit_Price__c),
                    wfrecon__Type__c: line.wfrecon__Type__c || 'Base Contract'
                };
                
                // Include sequence if it was modified (e.g., from swap operation)
                if (modifiedFields.has('wfrecon__Sequence__c')) {
                    updateData.wfrecon__Sequence__c = line.currentSequence;
                }
                
                modifiedProposalLinesArray.push(updateData);
            }
        });

        // Collect sequence changes
        if (this.hasSequenceChanges) {
            for (const line of this.proposalLinesRaw) {
                const originalSeq = this.originalSequences.get(line.Id);
                if (originalSeq !== line.currentSequence) {
                    // Check if this line is already in the changes
                    const existingLine = modifiedProposalLinesArray.find(l => l.Id === line.Id);
                    if (existingLine) {
                        existingLine.wfrecon__Sequence__c = line.currentSequence;
                        existingLine.wfrecon__Type__c = line.wfrecon__Type__c || 'Base Contract';
                    } else {
                        modifiedProposalLinesArray.push({
                            Id: line.Id,
                            wfrecon__Sequence__c: line.currentSequence,
                            wfrecon__Type__c: line.wfrecon__Type__c || 'Base Contract'
                        });
                    }
                }
            }
        }

        // Iterate through all proposal lines and collect modified budget lines
        this.proposalLinesRaw.forEach(proposalLine => {
            if (!proposalLine.budget) return;

            this.costTypes.forEach(costType => {
                if (this.hasSectionModifications(proposalLine.Id, costType)) {
                    const budgetLines = proposalLine.budget.budgetLinesByCostType[costType] || [];
                    const linesToSave = budgetLines
                        .filter(line => {
                            const budgetLineId = line.Id || line.tempId;
                            const hasModifiedFields = this.modifiedBudgetLineFields.has(budgetLineId) &&
                                this.modifiedBudgetLineFields.get(budgetLineId).size > 0;
                            return hasModifiedFields || line.isNew;
                        })
                        .map(line => ({
                            Id: line.Id,
                            budgetId: line.wfrecon__Budget__c,
                            costType: costType,
                            action: line.isNew ? 'insert' : 'update',
                            ...this.extractBudgetLineFields(line, costType)
                        }));

                    allBudgetLinesToSave.push(...linesToSave);
                }
            });
        });

        if (allBudgetLinesToSave.length === 0 && modifiedProposalLinesArray.length === 0) {
            this.showToast('Info', 'No changes to save', 'info');
            return;
        }

        this.isSaving = true;

        // Create single JSON object with both proposal lines and budget lines
        const changesData = {
            proposalLines: modifiedProposalLinesArray,
            budgetLines: allBudgetLinesToSave
        };

        // Make single Apex call to save all changes
        saveAllChanges({ changesJson: JSON.stringify(changesData) })
            .then(result => {
                if (result.success) {
                    this.showToast('Success', result.message, 'success');
                    this.loadProposalLines();
                    // Clear all modifications
                    this.hasModificationsBySection.clear();
                    this.modifiedProposalLines.clear();
                    this.originalProposalLineValues.clear();
                    this.modifiedBudgetLineFields.clear();
                    this.manuallyEditedSalesPrices.clear();
                    this.manuallyEditedUnitPrices.clear();
                    this.hasSequenceChanges = false;
                } else {
                    this.showToast('Error', result.message, 'error');
                }
                this.isSaving = false;
            })
            .catch(error => {
                console.error('Error saving changes:', error);
                this.showToast('Error', 'Unable to save changes', 'error');
                this.isSaving = false;
            });
    }

    // Discard all budget section changes and proposal line changes
    handleDiscardAllBudgetSections() {
        this.confirmModalTitle = 'Discard All Changes';
        this.confirmModalMessage = 'Are you sure you want to discard all unsaved changes? This action cannot be undone.';
        this.confirmModalAction = 'discardAllChanges';
        this.showConfirmModal = true;
    }

    confirmDiscardAllChanges() {
        this.loadProposalLines();
        this.editingProposalLines.clear();
        this.modifiedProposalLines.clear();
        this.originalProposalLineValues.clear();
        this.editingBudgetLines.clear();
        this.hasModificationsBySection.clear();
        this.modifiedBudgetLineFields.clear();
        this.manuallyEditedSalesPrices.clear();
        this.manuallyEditedUnitPrices.clear();
        this.hasSequenceChanges = false;
        this.showToast('Success', 'All changes have been discarded', 'success');
    }

    // Handle swap proposal line type between Base Contract and Alternate
    handleSwapProposalLineType(event) {
        const lineId = event.currentTarget.dataset.id;
        const currentType = event.currentTarget.dataset.currentType;
        const newType = currentType === 'Base Contract' ? 'Alternate' : 'Base Contract';

        // Calculate new sequence based on type
        let newSequence = 0;
        if (newType === 'Base Contract') {
            // Get the highest sequence for Base Contract lines
            const maxBaseContractSequence = this.proposalLinesRaw
                .filter(line => (line.wfrecon__Type__c || 'Base Contract') === 'Base Contract')
                .reduce((max, line) => Math.max(max, line.currentSequence || 0), 0);
            newSequence = maxBaseContractSequence + 1;
        }
        // If moving to Alternate, newSequence stays 0

        // Update the proposal line type and sequence in proposalLinesRaw
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === lineId) {
                return {
                    ...line,
                    wfrecon__Type__c: newType,
                    currentSequence: newSequence,
                    wfrecon__Sequence__c: newSequence
                };
            }
            return line;
        });

        // Mark fields as modified
        if (!this.modifiedProposalLines.has(lineId)) {
            this.modifiedProposalLines.set(lineId, new Set());
        }
        const modifiedFields = this.modifiedProposalLines.get(lineId);
        modifiedFields.add('wfrecon__Type__c');
        modifiedFields.add('wfrecon__Sequence__c');

        this.showToast('Info', `Type changed to ${newType}. Click "Save All Changes" to save.`, 'info');
    }

    // Handle accordion section toggle
    handleSectionToggle(event) {
        this.activeSectionName = event.detail.openSections;
    }

    // Drag and Drop Handlers
    handleDragStart(event) {
        this.draggedLineId = event.currentTarget.dataset.lineId;
        // Find the parent row to add dragging class
        const parentRow = event.currentTarget.closest('.proposal-line-row');
        if (parentRow) {
            // Create a custom drag image of the entire row with exact styling
            const table = parentRow.closest('table');
            const dragImageContainer = document.createElement('table');
            dragImageContainer.style.position = 'absolute';
            dragImageContainer.style.top = '-9999px';
            dragImageContainer.style.left = '-9999px';
            dragImageContainer.style.width = table.offsetWidth + 'px';
            dragImageContainer.style.borderCollapse = 'collapse';
            dragImageContainer.style.backgroundColor = 'white';
            dragImageContainer.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            dragImageContainer.style.borderRadius = '4px';
            dragImageContainer.style.overflow = 'hidden';
            
            // Clone the row with all its styles
            const rowClone = parentRow.cloneNode(true);
            rowClone.style.backgroundColor = parentRow.style.backgroundColor || 
                                            window.getComputedStyle(parentRow).backgroundColor;
            
            const tbody = document.createElement('tbody');
            tbody.appendChild(rowClone);
            dragImageContainer.appendChild(tbody);
            
            document.body.appendChild(dragImageContainer);
            
            // Set the custom drag image
            const rect = parentRow.getBoundingClientRect();
            const offsetX = event.clientX - rect.left;
            const offsetY = event.clientY - rect.top;
            event.dataTransfer.setDragImage(dragImageContainer, offsetX, offsetY);
            
            // Remove the clone after a short delay
            setTimeout(() => {
                if (document.body.contains(dragImageContainer)) {
                    document.body.removeChild(dragImageContainer);
                }
            }, 0);
            
            parentRow.classList.add('dragging');
        }
        event.dataTransfer.effectAllowed = 'move';

        // Collapse all expanded proposal lines for better drag and drop experience
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => ({
            ...line,
            isExpanded: false
        }));
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        const targetLineId = event.currentTarget.dataset.lineId;
        if (targetLineId && targetLineId !== this.draggedLineId) {
            // Remove drag-over class from all rows first
            const allRows = this.template.querySelectorAll('.proposal-line-row');
            allRows.forEach(row => row.classList.remove('drag-over'));

            // Add drag-over class to current target
            this.draggedOverLineId = targetLineId;
            event.currentTarget.classList.add('drag-over');
        }
    }

    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();

        const targetLineId = event.currentTarget.dataset.lineId;
        event.currentTarget.classList.remove('drag-over');

        if (this.draggedLineId && targetLineId && this.draggedLineId !== targetLineId) {
            this.reorderProposalLines(this.draggedLineId, targetLineId);
        }
    }

    handleDragEnd(event) {
        // Remove dragging class from all rows
        const allRows = this.template.querySelectorAll('.proposal-line-row');
        allRows.forEach(row => {
            row.classList.remove('dragging');
            row.classList.remove('drag-over');
        });

        this.draggedLineId = null;
        this.draggedOverLineId = null;
    }

    reorderProposalLines(draggedId, targetId) {
        const draggedIndex = this.proposalLinesRaw.findIndex(line => line.Id === draggedId);
        const targetIndex = this.proposalLinesRaw.findIndex(line => line.Id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const draggedLine = this.proposalLinesRaw[draggedIndex];
        const targetLine = this.proposalLinesRaw[targetIndex];

        // Get types
        const draggedType = draggedLine.wfrecon__Type__c || 'Base Contract';
        const targetType = targetLine.wfrecon__Type__c || 'Base Contract';

        // Prevent reordering within Alternate section
        if (draggedType === 'Alternate' && targetType === 'Alternate') {
            this.showToast('Warning', 'Cannot reorder within Alternate section. Drag to Base Contract to change type.', 'warning');
            return;
        }

        // Reorder the array
        const newLines = [...this.proposalLinesRaw];
        const [movedLine] = newLines.splice(draggedIndex, 1);
        
        // Update type when moving between sections
        if (draggedType !== targetType) {
            movedLine.wfrecon__Type__c = targetType;
            // Track as modified
            const modifiedFields = this.modifiedProposalLines.get(movedLine.Id) || new Set();
            modifiedFields.add('wfrecon__Type__c');
            modifiedFields.add('wfrecon__Sequence__c');
            this.modifiedProposalLines.set(movedLine.Id, modifiedFields);
        }
        
        newLines.splice(targetIndex, 0, movedLine);

        // Update sequences for all lines based on type
        let baseContractSeq = 1;
        newLines.forEach((line) => {
            const lineType = line.wfrecon__Type__c || 'Base Contract';
            if (lineType === 'Base Contract') {
                line.currentSequence = baseContractSeq;
                line.wfrecon__Sequence__c = baseContractSeq;
                baseContractSeq++;
            } else {
                // Alternate lines get sequence 0
                line.currentSequence = 0;
                line.wfrecon__Sequence__c = 0;
            }
        });

        this.proposalLinesRaw = newLines;

        // Check if sequences differ from original
        this.checkSequenceChanges();
    }

    checkSequenceChanges() {
        let hasChanges = false;
        for (const line of this.proposalLinesRaw) {
            const originalSeq = this.originalSequences.get(line.Id);
            if (originalSeq !== line.currentSequence) {
                hasChanges = true;
                break;
            }
        }
        this.hasSequenceChanges = hasChanges;
    }
}
