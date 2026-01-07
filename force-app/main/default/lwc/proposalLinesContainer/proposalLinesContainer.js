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
    @track showConfirmModal = false;
    @track confirmModalTitle = '';
    @track confirmModalMessage = '';
    @track confirmModalAction = null;
    @track confirmModalData = null;

    costTypes = ['labor', 'materials', 'hotel', 'mileage', 'perdiem'];

    // Helper method to safely get field value (avoid undefined)
    safeValue(value, defaultValue = '') {
        return (value !== undefined && value !== null) ? value : defaultValue;
    }

    safeNumber(value, defaultValue = 0) {
        const num = parseFloat(value);
        return (!isNaN(num)) ? num : defaultValue;
    }

    getBudgetCellClass(isModified, baseClass = 'editable-cell') {
        return isModified ? `${baseClass} modified-cell` : baseClass;
    }

    connectedCallback() {
        this.loadProposalDefaults();
        this.loadProposalLines();
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
                console.log('Fetched proposal lines result:', result);
                if (result.success && result.data) {
                    this.proposalLinesRaw = result.data.proposalLines || [];
                    console.log('Raw proposal lines:', this.proposalLinesRaw);
                    // Process and organize budget lines by cost type
                    this.proposalLinesRaw.forEach(line => {
                        line.isExpanded = false;
                        line.budgetRowKey = `budget-${line.Id}`;
                        line.recordLink = `/${line.Id}`;
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
            return {
                ...line,
                serialNumber: index + 1,
                totalAmount: this.safeNumber(line.wfrecon__Total_Cost__c, 0).toFixed(2),
                isOddRow: (index % 2 === 0),
                isModified: modifiedFields.size > 0,
                isEditingQuantity: this.editingProposalLines.has(`${line.Id}_wfrecon__Quantity__c`),
                isEditingDescription: this.editingProposalLines.has(`${line.Id}_wfrecon__Description__c`),
                isEditingProfit: this.editingProposalLines.has(`${line.Id}_wfrecon__Profit_Per__c`),
                isEditingSalesPrice: this.editingProposalLines.has(`${line.Id}_wfrecon__Sales_Price__c`),
                // CSS classes for each field
                quantityCellClass: modifiedFields.has('wfrecon__Quantity__c')
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
                // Safe values for display
                displayQuantity: this.safeNumber(line.wfrecon__Quantity__c, 0),
                displayDescription: this.safeValue(line.wfrecon__Description__c, ''),
                displayOH: this.safeNumber(line.wfrecon__OH_Per__c, 0),
                displayWarranty: this.safeNumber(line.wfrecon__Warranty_Per__c, 0),
                displayProfit: this.safeNumber(line.wfrecon__Profit_Per__c, 0),
                displayOHAmount: this.safeNumber(line.wfrecon__OH_Amount__c, 0).toFixed(2),
                displayWarrantyAmount: this.safeNumber(line.wfrecon__Warranty_Amount__c, 0).toFixed(2),
                displayProfitAmount: this.safeNumber(line.wfrecon__Profit_Amount__c, 0).toFixed(2),
                displayTotalCost: this.safeNumber(line.wfrecon__Total_Cost__c, 0).toFixed(2),
                displayRecommendedPrice: this.safeNumber(line.wfrecon__Recommended_Price__c, 0).toFixed(2),
                displaySalesPrice: this.safeNumber(line.wfrecon__Sales_Price__c, 0).toFixed(2),
                displayLaborCost: this.safeNumber(line.wfrecon__Labor_Cost__c, 0).toFixed(2),
                displayMaterialCost: this.safeNumber(line.wfrecon__Material_Cost__c, 0).toFixed(2),
                displayHotelCost: this.safeNumber(line.wfrecon__Hotel_Cost__c, 0).toFixed(2),
                displayMileageCost: this.safeNumber(line.wfrecon__Mileage_Cost__c, 0).toFixed(2),
                displayPerDiemCost: this.safeNumber(line.wfrecon__Per_Diem_Cost__c, 0).toFixed(2)
            };
        });
    }

    // Get grand total of all proposal lines
    get grandTotal() {
        if (!this.proposalLinesRaw || this.proposalLinesRaw.length === 0) return '0.00';

        const total = this.proposalLinesRaw.reduce((sum, line) => {
            return sum + this.safeNumber(line.wfrecon__Total_Cost__c, 0);
        }, 0);

        return total.toFixed(2);
    }

    // Get total sales price of all proposal lines
    get totalSalesPrice() {
        if (!this.proposalLinesRaw || this.proposalLinesRaw.length === 0) return '0.00';

        const total = this.proposalLinesRaw.reduce((sum, line) => {
            return sum + this.safeNumber(line.wfrecon__Sales_Price__c, 0);
        }, 0);

        return total.toFixed(2);
    }

    // Get margin (Total Sales Price - Grand Total Cost)
    get margin() {
        const totalSales = parseFloat(this.totalSalesPrice) || 0;
        const totalCost = parseFloat(this.grandTotal) || 0;
        const marginValue = totalSales - totalCost;

        return marginValue.toFixed(2);
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
                return {
                    ...line,
                    [field]: field === 'quantity' || field === 'oh' || field === 'warranty' || field === 'profit'
                        ? parseFloat(value) || 0
                        : value
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
        // Validate
        const hasInvalidLines = this.newProposalLines.some(line =>
            !line.pricebookId || !line.productId || !line.quantity || line.quantity <= 0
        );

        if (hasInvalidLines) {
            this.showToast('Validation Error', 'Please fill all required fields (Pricebook, Product, Quantity)', 'warning');
            return;
        }

        this.isSaving = true;

        const proposalLinesData = this.newProposalLines.map(line => {
            // Limit product name to 80 characters for proposal line name
            const proposalLineName = line.productName ? line.productName.substring(0, 80) : '';

            return {
                productId: line.productId,
                pricebookId: line.pricebookId,
                quantity: line.quantity,
                oh: line.oh,
                warranty: line.warranty,
                profit: line.profit,
                proposalLineName: proposalLineName,
                description: line.description || ''
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
                    this.loadProposalLines();
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
        const value = event.target.value;

        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId) {
                // Handle text fields (like Description) vs numeric fields
                let fieldValue = fieldName === 'wfrecon__Description__c' 
                    ? value 
                    : (parseFloat(value) || 0);
                
                // Track manually edited sales price
                if (fieldName === 'wfrecon__Sales_Price__c') {
                    this.manuallyEditedSalesPrices.set(proposalLineId, fieldValue);
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

        // Recalculate totals if Quantity or Profit percentage changed
        if (fieldName === 'wfrecon__Quantity__c' || 
            fieldName === 'wfrecon__Profit_Per__c') {
            this.recalculateProposalLineTotals(proposalLineId);
        }
    }

    // Handle proposal line field blur to exit edit mode (no auto-save)
    handleProposalLineFieldBlur(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const fieldName = event.currentTarget.dataset.field;

        // Validate Sales Price on blur
        if (fieldName === 'wfrecon__Sales_Price__c') {
            const line = this.proposalLinesRaw.find(l => l.Id === proposalLineId);
            if (line) {
                const salesPrice = parseFloat(line.wfrecon__Sales_Price__c) || 0;
                const recommendedPrice = parseFloat(line.wfrecon__Recommended_Price__c) || 0;
                
                if (salesPrice < recommendedPrice) {
                    // Reset to recommended price and show error
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
                    this.showToast('Error', `Sales Price cannot be less than Recommended Price ($${recommendedPrice.toFixed(2)})`, 'error');
                }
            }
        }

        const editKey = `${proposalLineId}_${fieldName}`;
        this.editingProposalLines.delete(editKey);
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
            const costType = event.currentTarget.dataset.costType;
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
        const fieldName = event.currentTarget.dataset.field;

        const editKey = `${proposalLineId}_${budgetLineId}_${fieldName}`;
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

            // Calculate total cost (sum of all costs multiplied by quantity)
            const quantity = parseNum(line.wfrecon__Quantity__c) || 1;
            const totalCost = (laborCost + materialCost + hotelCost + mileageCost + perDiemCost) * quantity;

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

            return {
                ...line,
                wfrecon__Labor_Cost__c: laborCost,
                wfrecon__Material_Cost__c: materialCost,
                wfrecon__Hotel_Cost__c: hotelCost,
                wfrecon__Mileage_Cost__c: mileageCost,
                wfrecon__Per_Diem_Cost__c: perDiemCost,
                wfrecon__Total_Cost__c: totalCost,
                wfrecon__Recommended_Price__c: recommendedPrice,
                wfrecon__Sales_Price__c: salesPrice,
                wfrecon__OH_Amount__c: ohAmount,
                wfrecon__Profit_Amount__c: profitAmount,
                wfrecon__Warranty_Amount__c: warrantyAmount
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

        switch (costType) {
            case 'labor':
                fields.noOfCrewMembers = line.wfrecon__No_Of_Crew_Members__c;
                fields.hrsDay = line.wfrecon__Hrs_day__c;
                fields.burdenRateHour = line.wfrecon__Burden_Rate_Hour__c;
                fields.ofDays = line.wfrecon__of_Days__c;
                fields.estimatedHours = line.wfrecon__Estimated_Hours__c;
                fields.laborCost = line.wfrecon__Labor_Cost__c;
                fields.note = line.wfrecon__Note__c;
                break;
            case 'materials':
                fields.materials = line.wfrecon__Material__c;
                fields.qty = line.wfrecon__QTY__c;
                fields.materialCostEach = line.wfrecon__Cost_Each__c;
                fields.materialCostSubTotal = line.wfrecon__Material_Cost__c;
                break;
            case 'hotel':
                fields.ofNights = line.wfrecon__Of_Nights__c;
                fields.numberOfRooms = line.wfrecon__Number_Of_Rooms__c;
                fields.costsPerNight = line.wfrecon__Costs_Per_Night__c;
                fields.totalHotelCost = line.wfrecon__Total_Hotel_Cost__c;
                break;
            case 'mileage':
                fields.ofTrips = line.wfrecon__Of_Trips__c;
                fields.ofTrucks = line.wfrecon__Of_Trucks__c;
                fields.mileage = line.wfrecon__Mileage__c;
                fields.mileageRate = line.wfrecon__Mileage_Rate__c;
                fields.totalMileage = line.wfrecon__Total_Mileage__c;
                break;
            case 'perdiem':
                fields.perDiemOfDays = line.wfrecon__Per_Diem_of_Days__c;
                fields.perDiemRate = line.wfrecon__Per_Diem_Rate__c;
                fields.totalPerDiem = line.wfrecon__Total_Per_Diem__c;
                fields.ofMen = line.wfrecon__of_Men__c;
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
                    this.loadProposalLines();
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
        if (this.hasModificationsBySection.size === 0) return false;

        for (let [costTypeMap] of this.hasModificationsBySection) {
            for (let [hasModifications] of costTypeMap) {
                if (hasModifications) return true;
            }
        }
        return false;
    }

    // Save all modified budget sections and proposal lines
    handleSaveAllBudgetSections() {
        const allBudgetLinesToSave = [];
        const modifiedProposalLinesArray = [];

        // Validate all sales prices before saving
        let hasInvalidSalesPrice = false;
        let errorMessage = '';
        
        this.modifiedProposalLines.forEach((modifiedFields, proposalLineId) => {
            if (modifiedFields.has('wfrecon__Sales_Price__c')) {
                const line = this.proposalLinesRaw.find(l => l.Id === proposalLineId);
                if (line) {
                    const salesPrice = parseFloat(line.wfrecon__Sales_Price__c) || 0;
                    const recommendedPrice = parseFloat(line.wfrecon__Recommended_Price__c) || 0;
                    
                    if (salesPrice < recommendedPrice) {
                        hasInvalidSalesPrice = true;
                        errorMessage = `Sales Price ($${salesPrice.toFixed(2)}) cannot be less than Recommended Price ($${recommendedPrice.toFixed(2)}) for ${line.Name}`;
                    }
                }
            }
        });

        if (hasInvalidSalesPrice) {
            this.showToast('Validation Error', errorMessage, 'error');
            return;
        }

        // Collect modified proposal lines
        this.modifiedProposalLines.forEach((modifiedFields, proposalLineId) => {
            const line = this.proposalLinesRaw.find(l => l.Id === proposalLineId);
            if (line && modifiedFields.size > 0) {
                modifiedProposalLinesArray.push({
                    Id: line.Id,
                    wfrecon__Quantity__c: line.wfrecon__Quantity__c,
                    wfrecon__Description__c: line.wfrecon__Description__c,
                    wfrecon__OH_Per__c: line.wfrecon__OH_Per__c,
                    wfrecon__Warranty_Per__c: line.wfrecon__Warranty_Per__c,
                    wfrecon__Profit_Per__c: line.wfrecon__Profit_Per__c,
                    wfrecon__Sales_Price__c: line.wfrecon__Sales_Price__c
                });
            }
        });

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
        this.loadProposalLines();
        this.hasModificationsBySection.clear();
        this.editingBudgetLines.clear();
        this.modifiedProposalLines.clear();
        this.originalProposalLineValues.clear();
        this.modifiedBudgetLineFields.clear();
        this.editingProposalLines.clear();
        this.showToast('Success', 'All changes discarded', 'info');
    }
}
