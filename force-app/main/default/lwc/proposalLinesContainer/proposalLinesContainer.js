import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getProposalLinesWithBudgets from '@salesforce/apex/ProposalLinesContainerController.getProposalLinesWithBudgets';
import getPricebooks from '@salesforce/apex/ProposalLinesContainerController.getPricebooks';
import getProductsByPricebook from '@salesforce/apex/ProposalLinesContainerController.getProductsByPricebook';
import saveProposalLines from '@salesforce/apex/ProposalLinesContainerController.saveProposalLines';
import deleteProposalLine from '@salesforce/apex/ProposalLinesContainerController.deleteProposalLine';
import saveBudgetLineEdits from '@salesforce/apex/ProposalLinesContainerController.saveBudgetLineEdits';

export default class ProposalLinesContainer extends NavigationMixin(LightningElement) {
    @api recordId;
    @track isLoading = false;
    @track proposalLinesRaw = [];
    @track proposalData = null;
    @track showAddModal = false;
    @track isModalLoading = false;
    @track isSaving = false;

    // Proposal Line fields
    @track proposalLineName = '';
    @track proposalLineDescription = '';

    // Modal data for Budget Lines
    @track pricebookOptions = [];
    @track selectedPricebookId = '';
    @track newBudgetLines = [];
    tempIdCounter = 1;

    // Inline editing properties
    @track modifiedBudgetLinesByProposal = new Map(); // Map<proposalLineId, Map<budgetLineId, changes>>
    @track hasModificationsByProposal = new Map(); // Map<proposalLineId, boolean>
    @track isSavingByProposal = new Map(); // Map<proposalLineId, boolean>
    @track editingCells = new Set(); // Track which cells are currently being edited
    
    // Add to existing budget tracking
    @track currentBudgetId = null;
    @track currentProposalLineId = null;
    @track isAddingToBudget = false;
    
    // Confirmation modal tracking
    @track showConfirmModal = false;
    @track confirmModalTitle = '';
    @track confirmModalMessage = '';
    @track confirmModalAction = null;
    @track confirmModalData = null;
    
    // Modified cells tracking for highlighting
    modifiedCells = new Set();

    connectedCallback() {
        this.loadProposalLines();
    }

    // Load proposal lines with budgets and budget lines
    loadProposalLines() {
        this.isLoading = true;
        getProposalLinesWithBudgets({ proposalId: this.recordId })
            .then(result => {
                if (result.success && result.data) {
                    // Store proposal data
                    this.proposalData = result.data.proposal;
                    
                    // Process proposal lines
                    this.proposalLinesRaw = result.data.proposalLines.map((line, index) => ({
                        ...line,
                        serialNumber: index + 1,
                        recordLink: `/${line.Id}`,
                        budgetRowKey: `budget-${line.Id}`,
                        isExpanded: false,
                        budgetLineCount: line.wfrecon__Budgets__r && line.wfrecon__Budgets__r.length > 0 &&
                            line.wfrecon__Budgets__r[0].wfrecon__Budget_Lines__r ?
                            line.wfrecon__Budgets__r[0].wfrecon__Budget_Lines__r.length : 0,
                        totalAmount: this.calculateBudgetTotal(
                            line.wfrecon__Budgets__r && line.wfrecon__Budgets__r.length > 0 ?
                                line.wfrecon__Budgets__r[0].wfrecon__Budget_Lines__r : []
                        ),
                        budget: line.wfrecon__Budgets__r && line.wfrecon__Budgets__r.length > 0 ? {
                            ...line.wfrecon__Budgets__r[0],
                            budgetLines: line.wfrecon__Budgets__r[0].wfrecon__Budget_Lines__r ?
                                line.wfrecon__Budgets__r[0].wfrecon__Budget_Lines__r.map((bl, blIndex) => ({
                                    ...bl,
                                    serialNumber: blIndex + 1,
                                    productName: bl.wfrecon__Product__r?.Name || '',
                                    pricebookName: bl.wfrecon__Price_Book__r?.Name || '',
                                    total: this.calculateTotal(bl.wfrecon__Quantity__c, bl.wfrecon__Unit_Cost__c),
                                    isEditingQuantity: false,
                                    isEditingUnitCost: false,
                                    isEditingDescription: false
                                })) : [],
                            totalBudgetAmount: this.calculateBudgetTotal(line.wfrecon__Budgets__r[0].wfrecon__Budget_Lines__r),
                            hasBudgetModifications: false,
                            isSavingBudget: false
                        } : null
                    }));
                } else {
                    console.error('Error loading proposal lines:', result.error || result.message);
                    this.showToast('Error', result.message, 'error');
                }
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error loading proposal lines:', error);
                this.showToast('Error', 'Unable to load proposal lines. Please try again.', 'error');
                this.isLoading = false;
            });
    }

    // Calculate total for a line
    calculateTotal(quantity, unitCost) {
        const qty = parseFloat(quantity) || 0;
        const cost = parseFloat(unitCost) || 0;
        return (qty * cost).toFixed(2);
    }

    // Calculate budget total
    calculateBudgetTotal(budgetLines) {
        if (!budgetLines || budgetLines.length === 0) return '0.00';
        const total = budgetLines.reduce((sum, line) => {
            return sum + (parseFloat(line.wfrecon__Quantity__c || 0) * parseFloat(line.wfrecon__Unit_Cost__c || 0));
        }, 0);
        return total.toFixed(2);
    }

    // Get formatted proposal lines
    get proposalLines() {
        if (!this.modifiedCells) {
            this.modifiedCells = new Set();
        }
        
        return this.proposalLinesRaw.map(line => {
            if (line.budget && line.budget.budgetLines) {
                const budgetLines = line.budget.budgetLines.map(bl => {
                    const isQuantityModified = this.modifiedCells.has(`${bl.Id}-quantity`);
                    const isUnitCostModified = this.modifiedCells.has(`${bl.Id}-unitCost`);
                    
                    // Check if cells are being edited
                    const isEditingQuantity = this.editingCells.has(`${bl.Id}-quantity`);
                    const isEditingUnitCost = this.editingCells.has(`${bl.Id}-unitCost`);
                    
                    return {
                        ...bl,
                        isQuantityModified,
                        isUnitCostModified,
                        isEditingQuantity,
                        isEditingUnitCost,
                        quantityCellClass: isQuantityModified 
                            ? 'center-trancate-text editable-cell modified-cell' 
                            : 'center-trancate-text editable-cell',
                        unitCostCellClass: isUnitCostModified 
                            ? 'center-trancate-text editable-cell modified-cell' 
                            : 'center-trancate-text editable-cell'
                    };
                });
                
                return {
                    ...line,
                    budget: {
                        ...line.budget,
                        budgetLines
                    }
                };
            }
            return line;
        });
    }

    // Get proposal amounts from proposal data
    get proposalAmount() {
        return this.proposalData?.wfrecon__Proposal_Amount__c 
            ? parseFloat(this.proposalData.wfrecon__Proposal_Amount__c).toFixed(2) 
            : '0.00';
    }

    get salesPrice() {
        return this.proposalData?.wfrecon__Sales_Price__c 
            ? parseFloat(this.proposalData.wfrecon__Sales_Price__c).toFixed(2) 
            : '0.00';
    }

    get ohAmount() {
        return this.proposalData?.wfrecon__OH_Amount__c 
            ? parseFloat(this.proposalData.wfrecon__OH_Amount__c).toFixed(2) 
            : '0.00';
    }

    get warrantyAmount() {
        return this.proposalData?.wfrecon__Warranty_Amount__c 
            ? parseFloat(this.proposalData.wfrecon__Warranty_Amount__c).toFixed(2) 
            : '0.00';
    }

    get profitAmount() {
        return this.proposalData?.wfrecon__Profit_Amount__c 
            ? parseFloat(this.proposalData.wfrecon__Profit_Amount__c).toFixed(2) 
            : '0.00';
    }

    // Handle toggle expand/collapse
    handleToggleExpand(event) {
        const lineId = event.currentTarget.dataset.id;
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === lineId) {
                return { ...line, isExpanded: !line.isExpanded };
            }
            return line;
        });
    }

    // Handle Add Proposal Line button click
    handleAddProposalLine() {
        this.showAddModal = true;
        this.proposalLineName = '';
        this.proposalLineDescription = '';
        this.selectedPricebookId = '';
        this.isAddingToBudget = false;
        this.currentBudgetId = null;
        this.currentProposalLineId = null;
        this.loadPricebooks();
        this.initializeNewBudgetLines();
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
                } else {
                    console.error('Error loading pricebooks:', result.error || result.message);
                    this.showToast('Error', result.message, 'error');
                }
                this.isModalLoading = false;
            })
            .catch(error => {
                console.error('Error loading pricebooks:', error);
                this.showToast('Error', 'Unable to load pricebooks. Please try again.', 'error');
                this.isModalLoading = false;
            });
    }

    // Initialize new budget lines
    initializeNewBudgetLines() {
        this.newBudgetLines = [{
            tempId: `temp-${this.tempIdCounter++}`,
            lineNumber: 1,
            pricebookId: '',
            productId: '',
            quantity: 1,
            unitCost: 0,
            description: '',
            productOptions: [],
            lineTotal: '0.00',
            canDelete: false
        }];
    }

    // Handle proposal line name change
    handleProposalLineNameChange(event) {
        this.proposalLineName = event.target.value;
    }

    // Handle proposal line description change
    handleProposalLineDescriptionChange(event) {
        this.proposalLineDescription = event.target.value;
    }

    // Handle row pricebook change
    handleRowPricebookChange(event) {
        const tempId = event.currentTarget.dataset.id;
        const pricebookId = event.target.value;

        if (pricebookId) {
            this.loadProductsForRow(tempId, pricebookId);
        }

        // Update the pricebook ID for this row and reset product selection
        this.newBudgetLines = this.newBudgetLines.map(line => {
            if (line.tempId === tempId) {
                return {
                    ...line,
                    pricebookId: pricebookId,
                    productId: '',
                    unitCost: 0,
                    productOptions: [],
                    lineTotal: this.calculateTotal(line.quantity, 0)
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
                    const productOpts = result.data.map(pbe => ({
                        label: pbe.Product2.Name,
                        value: pbe.Product2Id,
                        unitPrice: pbe.UnitPrice
                    }));

                    // Update only this specific budget line with product options
                    this.newBudgetLines = this.newBudgetLines.map(line => {
                        if (line.tempId === tempId) {
                            return {
                                ...line,
                                productOptions: productOpts
                            };
                        }
                        return line;
                    });
                } else {
                    console.error('Error loading products:', result.error || result.message);
                    this.showToast('Error', result.message, 'error');
                }
                this.isModalLoading = false;
            })
            .catch(error => {
                console.error('Error loading products:', error);
                this.showToast('Error', 'Unable to load products. Please try again.', 'error');
                this.isModalLoading = false;
            });
    }

    // Handle product change
    handleProductChange(event) {
        const tempId = event.currentTarget.dataset.id;
        const productId = event.target.value;

        this.newBudgetLines = this.newBudgetLines.map(line => {
            if (line.tempId === tempId) {
                const selectedProduct = line.productOptions.find(opt => opt.value === productId);
                const unitCost = selectedProduct ? selectedProduct.unitPrice : 0;
                const lineTotal = this.calculateTotal(line.quantity, unitCost);

                return {
                    ...line,
                    productId: productId,
                    unitCost: unitCost,
                    lineTotal: lineTotal
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

        this.newBudgetLines = this.newBudgetLines.map(line => {
            if (line.tempId === tempId) {
                const updatedLine = { ...line, [field]: value };
                updatedLine.lineTotal = this.calculateTotal(updatedLine.quantity, updatedLine.unitCost);
                return updatedLine;
            }
            return line;
        });
    }

    // Handle add another line
    handleAddAnotherLine() {
        const newLine = {
            tempId: `temp-${this.tempIdCounter++}`,
            lineNumber: this.newBudgetLines.length + 1,
            pricebookId: '',
            productId: '',
            quantity: 1,
            unitCost: 0,
            description: '',
            productOptions: [],
            lineTotal: '0.00',
            canDelete: true
        };

        this.newBudgetLines = [...this.newBudgetLines, newLine];
        
        // Scroll to bottom of table container
        setTimeout(() => {
            const tableContainer = this.template.querySelector('[data-id="tableContainer"]');
            if (tableContainer) {
                tableContainer.scrollTop = tableContainer.scrollHeight;
            }
        }, 100);
    }

    // Handle remove line
    handleRemoveLine(event) {
        const tempId = event.currentTarget.dataset.id;
        this.newBudgetLines = this.newBudgetLines.filter(line => line.tempId !== tempId);
        
        // Re-number lines
        this.newBudgetLines = this.newBudgetLines.map((line, index) => ({
            ...line,
            lineNumber: index + 1,
            canDelete: index > 0
        }));
    }

    handleSaveProposalLines() {
        // Validate budget lines
        const hasInvalidLines = this.newBudgetLines.some(line =>
            !line.pricebookId || !line.productId || !line.quantity || line.quantity <= 0
        );

        if (hasInvalidLines) {
            this.showToast('Error', 'Please fill in all required fields (Pricebook, Product, Quantity) for all budget lines', 'error');
            return;
        }

        this.isSaving = true;

        // Check if we're adding to an existing budget or creating a new proposal line
        if (this.isAddingToBudget && this.currentBudgetId) {
            // Adding budget lines to existing budget
            const budgetLinesToAdd = this.newBudgetLines.map(line => ({
                budgetId: this.currentBudgetId,
                pricebookId: line.pricebookId,
                productId: line.productId,
                quantity: parseFloat(line.quantity),
                unitCost: parseFloat(line.unitCost),
                description: line.description,
                action: 'insert'
            }));

            saveBudgetLineEdits({ budgetLinesJson: JSON.stringify(budgetLinesToAdd) })
                .then(result => {
                    if (result.success) {
                        this.showToast('Success', 'Budget lines added successfully', 'success');
                        this.handleCloseModal();
                        this.loadProposalLines();
                    } else {
                        console.error('Error adding budget lines:', result.error || result.message);
                        this.showToast('Error', result.message, 'error');
                        this.isSaving = false;
                    }
                })
                .catch(error => {
                    console.error('Error adding budget lines:', error);
                    this.showToast('Error', 'Unable to add budget lines. Please try again.', 'error');
                    this.isSaving = false;
                });
        } else {
            // Creating new proposal line with budget
            // Validate proposal line name
            if (!this.proposalLineName || this.proposalLineName.trim() === '') {
                this.showToast('Error', 'Please enter a Proposal Line Name', 'error');
                this.isSaving = false;
                return;
            }

            const proposalLineData = {
                proposalId: this.recordId,
                proposalLineName: this.proposalLineName,
                proposalLineDescription: this.proposalLineDescription,
                budgetLines: this.newBudgetLines.map(line => ({
                    pricebookId: line.pricebookId,
                    productId: line.productId,
                    quantity: parseFloat(line.quantity),
                    unitCost: parseFloat(line.unitCost),
                    description: line.description
                }))
            };

            saveProposalLines({ linesData: JSON.stringify(proposalLineData) })
                .then(result => {
                    if (result.success) {
                        this.showToast('Success', result.message, 'success');
                        this.handleCloseModal();
                        this.loadProposalLines();
                    } else {
                        console.error('Error saving proposal line:', result.error || result.message);
                        this.showToast('Error', result.message, 'error');
                        this.isSaving = false;
                    }
                })
                .catch(error => {
                    console.error('Error saving proposal line:', error);
                    this.showToast('Error', 'Unable to save proposal line. Please try again.', 'error');
                    this.isSaving = false;
                });
        }
    }

    // Handle close modal
    handleCloseModal() {
        this.showAddModal = false;
        this.proposalLineName = '';
        this.proposalLineDescription = '';
        this.selectedPricebookId = '';
        this.newBudgetLines = [];
        this.isSaving = false;
        this.currentBudgetId = null;
        this.currentProposalLineId = null;
        this.isAddingToBudget = false;
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
                    console.error('Error deleting proposal line:', result.error || result.message);
                    this.showToast('Error', result.message, 'error');
                    this.isLoading = false;
                }
            })
            .catch(error => {
                console.error('Error deleting proposal line:', error);
                this.showToast('Error', 'Unable to delete proposal line. Please try again.', 'error');
                this.isLoading = false;
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

    // Inline editing handlers for budget lines
    handleBudgetLineCellClick(event) {
        const budgetLineId = event.currentTarget.dataset.budgetLineId;
        const fieldName = event.currentTarget.dataset.field;
        const cellKey = `${budgetLineId}-${fieldName}`;
        
        // Don't open editor if already editing this cell
        if (this.editingCells.has(cellKey)) {
            return;
        }
        
        // Close all other editing cells first
        this.editingCells.clear();
        this.editingCells.add(cellKey);
        
        // Trigger reactivity to close all editing states
        this.proposalLinesRaw = [...this.proposalLinesRaw];
        
        // Auto-focus the input after DOM update
        setTimeout(() => {
            const input = this.template.querySelector(
                `input[data-budget-line-id="${budgetLineId}"][data-field="${fieldName}"]`
            );
            if (input) {
                input.focus();
                input.select();
            }
        }, 50);
    }

    handleBudgetLineFieldChange(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const budgetLineId = event.currentTarget.dataset.budgetLineId;
        const fieldName = event.currentTarget.dataset.field;
        let newValue = event.target.value;
        
        // Type conversion
        if (fieldName === 'quantity' || fieldName === 'unitCost') {
            newValue = parseFloat(newValue) || 0;
        }
        
        // Get original value
        const proposalLine = this.proposalLinesRaw.find(line => line.Id === proposalLineId);
        const budgetLine = proposalLine?.budget?.budgetLines?.find(bl => bl.Id === budgetLineId);
        
        if (!budgetLine) return;
        
        const fieldMapping = {
            'quantity': 'wfrecon__Quantity__c',
            'unitCost': 'wfrecon__Unit_Cost__c'
        };
        
        const originalValue = budgetLine[fieldMapping[fieldName]];
        
        // Track modifications
        if (!this.modifiedBudgetLinesByProposal.has(proposalLineId)) {
            this.modifiedBudgetLinesByProposal.set(proposalLineId, new Map());
        }
        
        const proposalModifications = this.modifiedBudgetLinesByProposal.get(proposalLineId);
        
        if (!proposalModifications.has(budgetLineId)) {
            proposalModifications.set(budgetLineId, {});
        }
        
        const budgetLineModifications = proposalModifications.get(budgetLineId);
        
        // Check if value changed
        if (newValue !== originalValue) {
            budgetLineModifications[fieldName] = newValue;
        } else {
            delete budgetLineModifications[fieldName];
            if (Object.keys(budgetLineModifications).length === 0) {
                proposalModifications.delete(budgetLineId);
            }
        }
        
        if (proposalModifications.size === 0) {
            this.modifiedBudgetLinesByProposal.delete(proposalLineId);
        }
        
        // Update hasModifications flag
        this.hasModificationsByProposal.set(
            proposalLineId, 
            proposalModifications.size > 0
        );
        
        // Track which cells are modified for highlighting
        if (!this.modifiedCells) {
            this.modifiedCells = new Set();
        }
        const cellKey = `${budgetLineId}-${fieldName}`;
        if (newValue !== originalValue) {
            this.modifiedCells.add(cellKey);
        } else {
            this.modifiedCells.delete(cellKey);
        }
        
        // Update the proposal lines to recalculate totals
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId && line.budget && line.budget.budgetLines) {
                const updatedBudgetLines = line.budget.budgetLines.map(bl => {
                    if (bl.Id === budgetLineId) {
                        const updatedBL = { ...bl };
                        if (fieldName === 'quantity') updatedBL.wfrecon__Quantity__c = newValue;
                        if (fieldName === 'unitCost') updatedBL.wfrecon__Unit_Cost__c = newValue;
                        updatedBL.total = this.calculateTotal(updatedBL.wfrecon__Quantity__c, updatedBL.wfrecon__Unit_Cost__c);
                        return updatedBL;
                    }
                    return bl;
                });
                
                return {
                    ...line,
                    budget: {
                        ...line.budget,
                        budgetLines: updatedBudgetLines,
                        totalBudgetAmount: this.calculateBudgetTotal(updatedBudgetLines),
                        hasBudgetModifications: this.hasModificationsByProposal.get(proposalLineId) || false
                    },
                    totalAmount: this.calculateBudgetTotal(updatedBudgetLines)
                };
            }
            return line;
        });
    }

    handleBudgetLineFieldBlur(event) {
        const budgetLineId = event.currentTarget.dataset.budgetLineId;
        const fieldName = event.currentTarget.dataset.field;
        const cellKey = `${budgetLineId}-${fieldName}`;
        
        setTimeout(() => {
            this.editingCells.delete(cellKey);
            this.proposalLinesRaw = [...this.proposalLinesRaw];
        }, 100);
    }

    handleSaveBudgetChanges(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        
        if (!this.modifiedBudgetLinesByProposal.has(proposalLineId)) {
            this.showToast('Info', 'No changes to save', 'info');
            return;
        }
        
        // Set saving state
        this.isSavingByProposal.set(proposalLineId, true);
        this.proposalLinesRaw = this.proposalLinesRaw.map(line => {
            if (line.Id === proposalLineId && line.budget) {
                return {
                    ...line,
                    budget: {
                        ...line.budget,
                        isSavingBudget: true
                    }
                };
            }
            return line;
        });
        
        // Prepare data for save
        const modifications = this.modifiedBudgetLinesByProposal.get(proposalLineId);
        const budgetLinesToSave = [];
        
        modifications.forEach((changes, budgetLineId) => {
            const budgetLineData = {
                Id: budgetLineId,
                quantity: null,
                unitCost: null
            };
            
            // Get the current values from UI
            const proposalLine = this.proposalLinesRaw.find(line => line.Id === proposalLineId);
            const budgetLine = proposalLine?.budget?.budgetLines?.find(bl => bl.Id === budgetLineId);
            
            if (budgetLine) {
                budgetLineData.quantity = budgetLine.wfrecon__Quantity__c;
                budgetLineData.unitCost = budgetLine.wfrecon__Unit_Cost__c;
            }
            
            budgetLinesToSave.push(budgetLineData);
        });
        
        saveBudgetLineEdits({ budgetLinesJson: JSON.stringify(budgetLinesToSave) })
            .then(result => {
                if (result.success) {
                    this.showToast('Success', result.message, 'success');
                    
                    // Clear modifications for this proposal line
                    this.modifiedBudgetLinesByProposal.delete(proposalLineId);
                    this.hasModificationsByProposal.set(proposalLineId, false);
                    if (this.modifiedCells) {
                        this.modifiedCells.clear();
                    }
                    
                    // Reload data
                    this.loadProposalLines();
                } else {
                    this.showToast('Error', result.message, 'error');
                }
                
                this.isSavingByProposal.set(proposalLineId, false);
            })
            .catch(error => {
                console.error('Error saving budget lines:', error);
                this.showToast('Error', 'Unable to save budget lines. Please try again.', 'error');
                this.isSavingByProposal.set(proposalLineId, false);
            });
    }

    handleDiscardBudgetChanges(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        
        if (!this.modifiedBudgetLinesByProposal.has(proposalLineId)) {
            return;
        }
        
        // Clear modifications
        this.modifiedBudgetLinesByProposal.delete(proposalLineId);
        this.hasModificationsByProposal.set(proposalLineId, false);
        this.editingCells.clear();
        if (this.modifiedCells) {
            this.modifiedCells.clear();
        }
        
        // Reload data to reset UI
        this.loadProposalLines();
    }

    handleAddBudgetLine(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        
        // Find the proposal line
        const proposalLine = this.proposalLinesRaw.find(line => line.Id === proposalLineId);
        if (!proposalLine || !proposalLine.budget) {
            this.showToast('Error', 'Budget not found for this proposal line', 'error');
            return;
        }
        
        // Store the budget ID and proposal line ID for adding budget lines
        this.currentBudgetId = proposalLine.budget.Id;
        this.currentProposalLineId = proposalLineId;
        this.isAddingToBudget = true;
        
        // Open modal to add budget line
        this.proposalLineName = proposalLine.Name;
        this.proposalLineDescription = proposalLine.wfrecon__Description__c;
        this.selectedPricebookId = '';
        this.loadPricebooks();
        this.initializeNewBudgetLines();
        this.showAddModal = true;
    }

    handleDeleteBudgetLine(event) {
        const proposalLineId = event.currentTarget.dataset.proposalLineId;
        const budgetLineId = event.currentTarget.dataset.budgetLineId;
        
        this.confirmModalTitle = 'Delete Budget Line';
        this.confirmModalMessage = 'Are you sure you want to delete this budget line? This action cannot be undone.';
        this.confirmModalAction = 'deleteBudgetLine';
        this.confirmModalData = { proposalLineId, budgetLineId };
        this.showConfirmModal = true;
    }
    
    confirmDeleteBudgetLine(proposalLineId, budgetLineId) {
        this.isLoading = true;
        
        // Track as modification
        if (!this.modifiedBudgetLinesByProposal.has(proposalLineId)) {
            this.modifiedBudgetLinesByProposal.set(proposalLineId, new Map());
        }
        
        const proposalModifications = this.modifiedBudgetLinesByProposal.get(proposalLineId);
        proposalModifications.set(budgetLineId, { action: 'delete' });
        this.hasModificationsByProposal.set(proposalLineId, true);
        
        // Prepare data
        const budgetLinesToSave = [{
            Id: budgetLineId,
            action: 'delete'
        }];
        
        saveBudgetLineEdits({ budgetLinesJson: JSON.stringify(budgetLinesToSave) })
            .then(result => {
                if (result.success) {
                    this.showToast('Success', result.message, 'success');
                    
                    // Clear modifications
                    this.modifiedBudgetLinesByProposal.delete(proposalLineId);
                    this.hasModificationsByProposal.set(proposalLineId, false);
                    
                    // Reload data
                    this.loadProposalLines();
                } else {
                    this.showToast('Error', result.message, 'error');
                    this.isLoading = false;
                }
            })
            .catch(error => {
                console.error('Error deleting budget line:', error);
                this.showToast('Error', 'Unable to delete budget line. Please try again.', 'error');
                this.isLoading = false;
            });
    }
}