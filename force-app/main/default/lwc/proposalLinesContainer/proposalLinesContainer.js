import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import getProposalLinesWithBudgets from '@salesforce/apex/ProposalLinesContainerController.getProposalLinesWithBudgets';
import getPricebooks from '@salesforce/apex/ProposalLinesContainerController.getPricebooks';
import getProductsByPricebook from '@salesforce/apex/ProposalLinesContainerController.getProductsByPricebook';
import saveProposalLines from '@salesforce/apex/ProposalLinesContainerController.saveProposalLines';
import deleteProposalLine from '@salesforce/apex/ProposalLinesContainerController.deleteProposalLine';
import saveBudgetLineEdits from '@salesforce/apex/ProposalLinesContainerController.saveBudgetLineEdits';
import deleteBudgetLine from '@salesforce/apex/ProposalLinesContainerController.deleteBudgetLine';
import getProposalDefaults from '@salesforce/apex/ProposalLinesContainerController.getProposalDefaults';

export default class ProposalLinesContainer extends NavigationMixin(LightningElement) {
    @api recordId;
    @track isLoading = false;
    @track proposalLinesRaw = [];
    @track showAddModal = false;
    @track isModalLoading = false;
    @track isSaving = false;

    // Proposal defaults from parent
    @track proposalDefaults = { oh: 0, warranty: 0, profit: 0 };

    // Modal data for Proposal Lines
    @track pricebookOptions = [];
    @track newProposalLines = [];
    tempIdCounter = 1;

    // Budget line editing by section
    @track editingBudgetLines = new Map(); // Map<proposalLineId, Map<costType, Array<budgetLines>>>
    @track hasModificationsBySection = new Map(); // Map<proposalLineId, Map<costType, boolean>>
    @track isSavingBySection = new Map(); // Map<proposalLineId, Map<costType, boolean>>
    @track editingProposalLines = new Set(); // Set of proposal line IDs being edited
    @track editingBudgetCells = new Set(); // Set of budget cell keys being edited "proposalLineId-budgetLineId-fieldName"
    
    // Confirmation modal tracking
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
                        line.totalAmount = this.safeNumber(line.wfrecon__Sales_Price__c);
                        if (line.wfrecon__Budgets__r && line.wfrecon__Budgets__r.length > 0) {
                            const budget = line.wfrecon__Budgets__r[0];
                            line.budget = {
                                Id: budget.Id,
                                Name: budget.Name,
                                budgetLinesByCostType: this.organizeBudgetLinesByCostType(budget.wfrecon__Budget_Lines__r || [], line.Id),
                                laborHasModifications: false,
                                materialHasModifications: false,
                                hotelHasModifications: false,
                                mileageHasModifications: false,
                                perdiemHasModifications: false
                            };
                        }
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
            const costType = (line.wfrecon__Cost_Type__c || '').toLowerCase();
            if (organized[costType]) {
                // Ensure all fields have safe values
                line.wfrecon__No_Of_Crew_Members__c = this.safeNumber(line.wfrecon__No_Of_Crew_Members__c);
                line.wfrecon__Hrs_day__c = this.safeNumber(line.wfrecon__Hrs_day__c);
                line.wfrecon__Burden_Rate_Hour__c = this.safeNumber(line.wfrecon__Burden_Rate_Hour__c);
                line.wfrecon__of_Days__c = this.safeNumber(line.wfrecon__of_Days__c);
                line.wfrecon__Estimated_Hours__c = this.safeNumber(line.wfrecon__Estimated_Hours__c);
                line.wfrecon__Labor_Cost__c = this.safeNumber(line.wfrecon__Labor_Cost__c);
                line.wfrecon__Note__c = this.safeValue(line.wfrecon__Note__c);
                
                line.wfrecon__Material__c = this.safeValue(line.wfrecon__Material__c);
                line.wfrecon__QTY__c = this.safeNumber(line.wfrecon__QTY__c);
                line.wfrecon__Material_Cost_Each__c = this.safeNumber(line.wfrecon__Material_Cost_Each__c);
                line.wfrecon__Material_Cost_SubTotal__c = this.safeNumber(line.wfrecon__Material_Cost_SubTotal__c);
                
                line.wfrecon__Of_Nights__c = this.safeNumber(line.wfrecon__Of_Nights__c);
                line.wfrecon__Number_Of_Rooms__c = this.safeNumber(line.wfrecon__Number_Of_Rooms__c);
                line.wfrecon__Costs_Per_Night__c = this.safeNumber(line.wfrecon__Costs_Per_Night__c);
                line.wfrecon__Total_Hotel_Cost__c = this.safeNumber(line.wfrecon__Total_Hotel_Cost__c);
                
                line.wfrecon__Of_Trips__c = this.safeNumber(line.wfrecon__Of_Trips__c);
                line.wfrecon__Of_Trucks__c = this.safeNumber(line.wfrecon__Of_Trucks__c);
                line.wfrecon__Mileage__c = this.safeNumber(line.wfrecon__Mileage__c);
                line.wfrecon__Mileage_Rate__c = this.safeNumber(line.wfrecon__Mileage_Rate__c);
                line.wfrecon__Total_Mileage__c = this.safeNumber(line.wfrecon__Total_Mileage__c);
                
                line.wfrecon__Per_Diem_of_Days__c = this.safeNumber(line.wfrecon__Per_Diem_of_Days__c);
                line.wfrecon__Per_Diem_Rate__c = this.safeNumber(line.wfrecon__Per_Diem_Rate__c);
                line.wfrecon__Total_Per_Diem__c = this.safeNumber(line.wfrecon__Total_Per_Diem__c);
                line.wfrecon__of_Men__c = this.safeNumber(line.wfrecon__of_Men__c);
                
                organized[costType].push(line);
            }
        });

        // Add displayIndex to each budget line
        Object.keys(organized).forEach(costType => {
            organized[costType].forEach((line, index) => {
                line.displayIndex = index + 1;
                line.isBeingEdited = false;
                
                // Add field-specific editing flags based on editingBudgetCells
                const budgetLineId = line.Id;
                
                // Labor fields
                line.isEditingCrew = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__No_Of_Crew_Members__c`);
                line.isEditingHrsDay = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Hrs_day__c`);
                line.isEditingBurdenRate = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Burden_Rate_Hour__c`);
                line.isEditingDays = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__of_Days__c`);
                line.isEditingNote = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Note__c`);
                
                // Materials fields
                line.isEditingMaterial = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Material__c`);
                line.isEditingQty = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__QTY__c`);
                line.isEditingCostEach = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Material_Cost_Each__c`);
                
                // Hotel fields
                line.isEditingNights = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Of_Nights__c`);
                line.isEditingRooms = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Number_Of_Rooms__c`);
                line.isEditingCostPerNight = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Costs_Per_Night__c`);
                
                // Mileage fields
                line.isEditingTrips = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Of_Trips__c`);
                line.isEditingTrucks = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Of_Trucks__c`);
                line.isEditingMileage = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Mileage__c`);
                line.isEditingMileageRate = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Mileage_Rate__c`);
                
                // Per Diem fields
                line.isEditingPerDiemDays = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Per_Diem_of_Days__c`);
                line.isEditingMen = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__of_Men__c`);
                line.isEditingPerDiemRate = this.editingBudgetCells.has(`${proposalLineId}_${budgetLineId}_wfrecon__Per_Diem_Rate__c`);
            });
        });

        return organized;
    }

    // Get formatted proposal lines
    get proposalLines() {
        return this.proposalLinesRaw.map((line, index) => ({
            ...line,
            serialNumber: index + 1,
            budgetLineCount: this.getTotalBudgetLineCount(line),
            totalAmount: this.safeNumber(line.wfrecon__Total_Cost__c, 0).toFixed(2),
            isOddRow: (index % 2 === 0),
            isEditingQuantity: this.editingProposalLines.has(`${line.Id}_wfrecon__Quantity__c`),
            isEditingOH: this.editingProposalLines.has(`${line.Id}_wfrecon__OH_Per__c`),
            isEditingWarranty: this.editingProposalLines.has(`${line.Id}_wfrecon__Warranty_Per__c`),
            isEditingProfit: this.editingProposalLines.has(`${line.Id}_wfrecon__Profit_Per__c`),
            // Safe values for display
            displayQuantity: this.safeNumber(line.wfrecon__Quantity__c, 0),
            displayOH: this.safeNumber(line.wfrecon__OH_Per__c, 0),
            displayWarranty: this.safeNumber(line.wfrecon__Warranty_Per__c, 0),
            displayProfit: this.safeNumber(line.wfrecon__Profit_Per__c, 0)
        }));
    }

    // Get total budget line count for a proposal line
    getTotalBudgetLineCount(line) {
        if (!line.budget || !line.budget.budgetLinesByCostType) return 0;
        
        const costTypeCounts = this.costTypes.map(type => 
            (line.budget.budgetLinesByCostType[type] || []).length
        );
        
        return costTypeCounts.reduce((sum, count) => sum + count, 0);
    }

    // Get grand total of all proposal lines
    get grandTotal() {
        if (!this.proposalLinesRaw || this.proposalLinesRaw.length === 0) return '0.00';
        
        const total = this.proposalLinesRaw.reduce((sum, line) => {
            return sum + this.safeNumber(line.wfrecon__Total_Cost__c, 0);
        }, 0);
        
        return total.toFixed(2);
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
            tempId: `temp-${this.tempIdCounter++}`,
            lineNumber: 1,
            pricebookId: '',
            productId: '',
            quantity: 1,
            oh: this.proposalDefaults.oh,
            warranty: this.proposalDefaults.warranty,
            profit: this.proposalDefaults.profit,
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
                        value: entry.Product2Id
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
                // Find the product name from productOptions
                const selectedProduct = line.productOptions.find(opt => opt.value === productId);
                const productName = selectedProduct ? selectedProduct.label : '';
                
                return {
                    ...line,
                    productId: productId,
                    productName: productName
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
            tempId: `temp-${this.tempIdCounter++}`,
            lineNumber: this.newProposalLines.length + 1,
            pricebookId: '',
            productId: '',
            quantity: 1,
            oh: this.proposalDefaults.oh,
            warranty: this.proposalDefaults.warranty,
            profit: this.proposalDefaults.profit,
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
                quantity: line.quantity,
                oh: line.oh,
                warranty: line.warranty,
                profit: line.profit,
                proposalLineName: proposalLineName
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
                return {
                    ...line,
                    [fieldName]: parseFloat(value) || 0,
                    isModified: true
                };
            }
            return line;
        });
    }

    // Handle proposal line field blur to save and exit edit mode
    handleProposalLineFieldBlur(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const fieldName = event.currentTarget.dataset.field;
        const line = this.proposalLinesRaw.find(l => l.Id === proposalLineId);
        
        if (line && line.isModified) {
            this.saveProposalLineEdit(line);
        }
        
        const editKey = `${proposalLineId}_${fieldName}`;
        this.editingProposalLines.delete(editKey);
        this.proposalLinesRaw = [...this.proposalLinesRaw];
    }

    saveProposalLineEdit(line) {
        // You'll need to add an Apex method for updating individual proposal line fields
        // For now, just remove the isModified flag
        this.proposalLinesRaw = this.proposalLinesRaw.map(l => {
            if (l.Id === line.Id) {
                return {
                    ...l,
                    isModified: false
                };
            }
            return l;
        });
        
        this.showToast('Success', 'Proposal line updated', 'success');
        this.loadProposalLines();
    }

    // Handle budget line cell click to enter edit mode
    handleBudgetLineCellClick(event) {
        // If clicking on an input, don't interfere
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
        this.proposalLinesRaw = [...this.proposalLinesRaw];
        
        // Focus the input in the next tick
        setTimeout(() => {
            const input = this.template.querySelector(`input[data-proposal-line-id="${proposalLineId}"][data-budget-line-id="${budgetLineId}"][data-field="${fieldName}"]`);
            if (input) {
                input.focus();
                input.select();
            }
        }, 10);
    }

    // Handle budget line field blur to exit edit mode
    handleBudgetLineCellBlur(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const budgetLineId = event.currentTarget.dataset.budgetLineId;
        const fieldName = event.currentTarget.dataset.field;
        
        const editKey = `${proposalLineId}_${budgetLineId}_${fieldName}`;
        this.editingBudgetCells.delete(editKey);
        this.proposalLinesRaw = [...this.proposalLinesRaw];
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
            this.confirmDeleteBudgetLine(this.confirmModalData.proposalLineId, this.confirmModalData.budgetLineId);
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
    }

    createEmptyBudgetLine(budgetId, costType) {
        const baseLine = {
            tempId: `temp-${this.tempIdCounter++}`,
            wfrecon__Budget__c: budgetId,
            wfrecon__Cost_Type__c: costType,
            isNew: true
        };

        switch(costType) {
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
                    wfrecon__Material_Cost_Each__c: 0,
                    wfrecon__Material_Cost_SubTotal__c: 0
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
                                [fieldName]: newValue,
                                isModified: true
                            };
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
    }

    calculateFormulaFields(budgetLine, costType) {
        const parseNum = (val) => parseFloat(val) || 0;
        
        switch(costType) {
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
                budgetLine.wfrecon__Material_Cost_SubTotal__c = parseNum(budgetLine.wfrecon__QTY__c) * 
                                                                 parseNum(budgetLine.wfrecon__Material_Cost_Each__c);
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

    handleSaveBudgetSection(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const costType = event.currentTarget.dataset.costType;

        const proposalLine = this.proposalLinesRaw.find(line => line.Id === proposalLineId);
        if (!proposalLine || !proposalLine.budget) return;

        const budgetLines = proposalLine.budget.budgetLinesByCostType[costType] || [];
        const budgetLinesToSave = budgetLines
            .filter(line => line.isModified || line.isNew)
            .map(line => ({
                Id: line.Id,
                budgetId: line.wfrecon__Budget__c,
                costType: costType,
                action: line.isNew ? 'insert' : 'update',
                ...this.extractBudgetLineFields(line, costType)
            }));

        if (budgetLinesToSave.length === 0) {
            this.showToast('Info', 'No changes to save', 'info');
            return;
        }

        this.setSavingState(proposalLineId, costType, true);

        saveBudgetLineEdits({ budgetLinesJson: JSON.stringify(budgetLinesToSave) })
            .then(result => {
                if (result.success) {
                    this.showToast('Success', result.message, 'success');
                    this.loadProposalLines();
                    this.clearSectionModifications(proposalLineId, costType);
                } else {
                    this.showToast('Error', result.message, 'error');
                }
                this.setSavingState(proposalLineId, costType, false);
            })
            .catch(error => {
                console.error('Error saving budget lines:', error);
                this.showToast('Error', 'Unable to save budget lines', 'error');
                this.setSavingState(proposalLineId, costType, false);
            });
    }

    extractBudgetLineFields(line, costType) {
        const fields = {};
        
        switch(costType) {
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
                fields.materialCostEach = line.wfrecon__Material_Cost_Each__c;
                fields.materialCostSubTotal = line.wfrecon__Material_Cost_SubTotal__c;
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

    handleDiscardBudgetSection(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const costType = event.currentTarget.dataset.costType;
        
        this.loadProposalLines();
        this.clearSectionModifications(proposalLineId, costType);
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
    }

    confirmDeleteBudgetLine(proposalLineId, budgetLineId) {
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

    setSavingState(proposalLineId, costType, isSaving) {
        if (!this.isSavingBySection.has(proposalLineId)) {
            this.isSavingBySection.set(proposalLineId, new Map());
        }
        this.isSavingBySection.get(proposalLineId).set(costType, isSaving);
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

    isSectionSaving(proposalLineId, costType) {
        return this.isSavingBySection.has(proposalLineId) &&
               this.isSavingBySection.get(proposalLineId).get(costType);
    }

    // Check if any proposal line has any modifications in any section
    get hasAnyModifications() {
        if (this.hasModificationsBySection.size === 0) return false;
        
        for (let [proposalLineId, costTypeMap] of this.hasModificationsBySection) {
            for (let [costType, hasModifications] of costTypeMap) {
                if (hasModifications) return true;
            }
        }
        return false;
    }

    // Save all modified budget sections across all proposal lines
    handleSaveAllBudgetSections() {
        const allBudgetLinesToSave = [];
        
        // Iterate through all proposal lines and collect modified budget lines
        this.proposalLinesRaw.forEach(proposalLine => {
            if (!proposalLine.budget) return;
            
            this.costTypes.forEach(costType => {
                if (this.hasSectionModifications(proposalLine.Id, costType)) {
                    const budgetLines = proposalLine.budget.budgetLinesByCostType[costType] || [];
                    const linesToSave = budgetLines
                        .filter(line => line.isModified || line.isNew)
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

        if (allBudgetLinesToSave.length === 0) {
            this.showToast('Info', 'No changes to save', 'info');
            return;
        }

        this.isSaving = true;

        saveBudgetLineEdits({ budgetLinesJson: JSON.stringify(allBudgetLinesToSave) })
            .then(result => {
                if (result.success) {
                    this.showToast('Success', 'All changes saved successfully', 'success');
                    this.loadProposalLines();
                    // Clear all modifications
                    this.hasModificationsBySection.clear();
                } else {
                    this.showToast('Error', result.message, 'error');
                }
                this.isSaving = false;
            })
            .catch(error => {
                console.error('Error saving all budget sections:', error);
                this.showToast('Error', 'Unable to save budget lines', 'error');
                this.isSaving = false;
            });
    }

    // Discard all budget section changes across all proposal lines
    handleDiscardAllBudgetSections() {
        this.loadProposalLines();
        this.hasModificationsBySection.clear();
        this.editingBudgetLines.clear();
        this.showToast('Success', 'All changes discarded', 'info');
    }
}
