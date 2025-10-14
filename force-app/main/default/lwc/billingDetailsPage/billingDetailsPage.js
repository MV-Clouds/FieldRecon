import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getBillingsData from '@salesforce/apex/BillingDetailsPageController.getBillingsData';
import updateBillingDetails from '@salesforce/apex/BillingDetailsPageController.updateBillingDetails';
import saveBillingLineItems from '@salesforce/apex/BillingDetailsPageController.saveBillingLineItems';

export default class BillingDetailsPage extends LightningElement {
    @api recordId;
    @track isLoading = true;
    @track billingRecord;
    @track contractLineItems = [];
    @track changeOrderLineItems = [];
    @track originalContractItems = [];
    @track originalChangeOrderItems = [];
    @track modifiedContractItems = new Map();
    @track modifiedChangeOrderItems = new Map();
    @track editingCells = new Set();
    @track modifiedChangeOrderItems = new Map();
    @track editingCells = new Set();
    @track hasContractModifications = false;
    @track hasChangeOrderModifications = false;
    @track isSavingContract = false;
    @track isSavingChangeOrder = false;
    @track contractTotals = {};
    @track changeOrderTotals = {};
    @track billingDetails = {};
    @track originalBillingDetails = {};
    @track isEditingStatus = false;
    @track isSavingBillingInfo = false;
    @track hasBillingChanges = false;
    
    // Status options for combobox
    @track statusOptions = [
        { label: 'Draft', value: 'Draft' },
        { label: 'Sent', value: 'Sent' },
        { label: 'Approved', value: 'Approved' },
        { label: 'Paid', value: 'Paid' }
    ];

    get isSaveBillingDisabled() {
        return !this.hasBillingChanges || this.isSavingBillingInfo;
    }

    get isContractButtonsDisabled() {
        return !this.hasContractModifications || this.isSavingContract;
    }

    get isContractSaveDisabled() {
        return !this.hasContractModifications || this.isSavingContract;
    }

    get isChangeOrderButtonsDisabled() {
        return !this.hasChangeOrderModifications || this.isSavingChangeOrder;
    }

    get isChangeOrderSaveDisabled() {
        return !this.hasChangeOrderModifications || this.isSavingChangeOrder;
    }

    get contractSaveButtonLabel() {
        return this.isSavingContract ? 'Saving...' : 'Save Changes';
    }

    get changeOrderSaveButtonLabel() {
        return this.isSavingChangeOrder ? 'Saving...' : 'Save Changes';
    }

    get isDraftSelected() {
        return this.billingDetails.wfrecon__Status__c === 'Draft';
    }

    get isSentSelected() {
        return this.billingDetails.wfrecon__Status__c === 'Sent';
    }

    get isApprovedSelected() {
        return this.billingDetails.wfrecon__Status__c === 'Approved';
    }

    get isPaidSelected() {
        return this.billingDetails.wfrecon__Status__c === 'Paid';
    }

    get formattedCurrentPaymentDue() {
        return this.formatCurrency(this.billingDetails.totalDueThisBilling);
    }

    get formattedJobRetainage() {
        return `${(this.billingDetails.jobRetainage || 0).toFixed(2)}%`;
    }

    get formattedJobTotalContractPrice() {
        return this.formatCurrency(this.billingDetails.jobTotalContractPrice);
    }

    get formattedJobTotalChangeOrderValue() {
        return this.formatCurrency(this.billingDetails.jobTotalChangeOrderValue);
    }

    get formattedContractSumToDate() {
        return this.formatCurrency(this.billingDetails.ContractSumToDate);
    }

    get formattedTotalCompleted() {
        return this.formatCurrency(this.billingDetails.TotalCompletedAndStoredToDate);
    }

    get formattedRetainageCompleted() {
        return this.formatCurrency(this.billingDetails.RetainageCompletedToDate);
    }

    get formattedTotalEarnedLessRetainage() {
        return this.formatCurrency(this.billingDetails.TotalEarnedLessRetainage);
    }

    get formattedBalanceToFinish() {
        return this.formatCurrency(this.billingDetails.BalanceToFinishRetainage);
    }

    get saveBillingButtonLabel() {
        return this.isSavingBillingInfo ? 'Saving...' : 'Save';
    }

    /** 
     * Method Name: connectedCallback
     * @description: LWC lifecycle hook that initializes the component and loads billing data.
     */
    connectedCallback() {
        try {
            console.log('Record Id in Billing Details Page: ' + this.recordId);
            this.loadBillingData();
        } catch (error) {
            console.error('Error in connectedCallback:', error);
        }
    }

    /** 
     * Method Name: loadBillingData
     * @description: Fetches billing data from Apex controller and processes the response.
     */
    loadBillingData() {
        try {
            this.isLoading = true;
            getBillingsData({ billingId: this.recordId })
                .then(result => {
                    console.log('getBillingsData result: ', result);
                    
                    this.billingRecord = result;
                    console.log('Billing Record: ', this.billingRecord);

                    this.processBillingDetails(result.billDetails);
                    this.processLineItems(result.billLineItems);
                })
                .catch(error => {
                    console.error('Error fetching billing data: ', error);
                    this.showToast('Error', 'Failed to load billing data', 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error fetching billing data: ', error);
            this.isLoading = false;
        }
    }

    /** 
     * Method Name: processBillingDetails
     * @description: Processes billing details from server response and handles null values.
     */
    processBillingDetails(billDetails) {
        try {
            console.log('billDetails:', billDetails);
            
            // Process billing details and handle null values
            const processedDetails = {};
            Object.keys(billDetails).forEach(key => {
                if (billDetails[key] === null || billDetails[key] === undefined) {
                    processedDetails[key] = '';
                } else {
                    processedDetails[key] = billDetails[key];
                }
            });
            
            this.billingDetails = { ...processedDetails };
            this.originalBillingDetails = { ...processedDetails };
        } catch (error) {
            console.error('Error in processBillingDetails:', error);
        }
    }

    /** 
     * Method Name: processLineItems
     * @description: Processes line items and separates them into contract and change order items.
     */
    processLineItems(billLineItems) {
        try {
            console.log('billLineItems:', billLineItems);
            
            const contractItems = [];
            const changeOrderItems = [];

            billLineItems.forEach(item => {
                const processedItem = this.processLineItem(item);
                if (item.wfrecon__Scope_Entry_Type__c === 'Contract') {
                    contractItems.push(processedItem);
                } else if (item.wfrecon__Scope_Entry_Type__c === 'Change Order') {
                    changeOrderItems.push(processedItem);
                }
            });

            this.contractLineItems = contractItems;
            this.changeOrderLineItems = changeOrderItems;
            
            // Store original values for comparison
            this.originalContractItems = JSON.parse(JSON.stringify(contractItems));
            this.originalChangeOrderItems = JSON.parse(JSON.stringify(changeOrderItems));

            console.log('Contract Items: ', this.contractLineItems);
            console.log('Change Order Items: ', this.changeOrderLineItems);
            
            this.calculateTotals();
        } catch (error) {
            console.error('Error in processLineItems:', error);
        }
    }

    /** 
     * Method Name: processLineItem
     * @description: Transforms a single line item into display format with formatted values.
     */
    processLineItem(item) {
        return {
            Id: item.Id,
            scopeEntryName: item.wfrecon__Scope_Entry__r.Name || '-',
            contractValue: this.formatCurrency(item.wfrecon__Scope_Contract_Value__c),
            previousBilledPercent: this.formatPercent(item.wfrecon__Prev_Billed_Percent__c),
            previousBilledAmount: this.formatCurrency(item.wfrecon__Previous_Billed_Amount__c),
            currentCompletePercent: this.formatPercent(item.wfrecon__Current_Billing_Complete__c),
            thisBillingCompletePercent: this.formatPercent(item.wfrecon__This_Billing_Percent__c),
            totalCompleteAmount: this.formatCurrency(item.wfrecon__Total_Complete_Amount__c),
            thisBillingAmount: this.formatCurrency(item.wfrecon__This_Billing_Amount__c),
            retainageAmount: this.formatCurrency(item.wfrecon__Retainage_Amount_on_Bill_Line_Item__c),
            dueThisBilling: this.formatCurrency(item.wfrecon__Due_This_Billing__c),
            isEditingThisBillingPercent: false,
            rowClass: '',
            thisBillingPercentCellClass: 'editable-cell',
            
            // Raw values for calculations
            rawScopeContractValue: item.wfrecon__Scope_Contract_Value__c || 0,
            rawPreviousBilledAmount: item.wfrecon__Previous_Billed_Amount__c || 0,
            rawTotalCompleteAmount: item.wfrecon__Total_Complete_Amount__c || 0,
            rawThisBillingAmount: item.wfrecon__This_Billing_Amount__c || 0,
            rawRetainageAmount: item.wfrecon__Retainage_Amount_on_Bill_Line_Item__c || 0,
            rawDueThisBilling: item.wfrecon__Due_This_Billing__c || 0,
            rawThisBillingPercent: item.wfrecon__This_Billing_Percent__c || 0
        };
    }

    /** 
     * Method Name: calculateTotals
     * @description: Calculates totals for both contract and change order line items.
     */
    calculateTotals() {
        try {
            // Calculate Contract totals
            this.contractTotals = this.calculateTableTotals(this.contractLineItems);
            
            // Calculate Change Order totals
            this.changeOrderTotals = this.calculateTableTotals(this.changeOrderLineItems);
        } catch (error) {
            console.error('Error in calculateTotals:', error);
        }
    }

    /** 
     * Method Name: calculateTableTotals
     * @description: Calculates and formats totals for a given set of line items.
     */
    calculateTableTotals(items) {
        const totals = items.reduce((acc, item) => {
            acc.contractValue += item.rawScopeContractValue;
            acc.previousBilledAmount += item.rawPreviousBilledAmount;
            acc.totalCompleteAmount += item.rawTotalCompleteAmount;
            acc.thisBillingAmount += item.rawThisBillingAmount;
            acc.retainageAmount += item.rawRetainageAmount;
            acc.dueThisBilling += item.rawDueThisBilling;
            return acc;
        }, {
            contractValue: 0,
            previousBilledAmount: 0,
            totalCompleteAmount: 0,
            thisBillingAmount: 0,
            retainageAmount: 0,
            dueThisBilling: 0
        });

        // Format the totals
        return {
            contractValue: this.formatCurrency(totals.contractValue),
            previousBilledAmount: this.formatCurrency(totals.previousBilledAmount),
            totalCompleteAmount: this.formatCurrency(totals.totalCompleteAmount),
            thisBillingAmount: this.formatCurrency(totals.thisBillingAmount),
            retainageAmount: this.formatCurrency(totals.retainageAmount),
            dueThisBilling: this.formatCurrency(totals.dueThisBilling)
        };
    }

    /** 
     * Method Name: handleStatusChange
     * @description: Handles changes to the billing status dropdown and checks for modifications.
     */
    handleStatusChange(event) {
        try {
            this.billingDetails.Status = event.detail.value;
            this.checkBillingChanges();

            console.log('Updated Billing Details:', this.billingDetails);
        } catch (error) {
            console.error('Error in handleStatusChange:', error);
        }
    }

    /** 
     * Method Name: handleBillingFieldChange
     * @description: Handles changes to various billing form fields and updates the billing details object.
     */
    handleBillingFieldChange(event) {
        try {
            const fieldName = event.target.dataset.fieldName || event.currentTarget.dataset.fieldName;
            const value = event.detail ? event.detail.value : 
                (event.target.type === 'number' ? 
                    (parseFloat(event.target.value) || 0) : 
                    event.target.value);

            console.log('Field Name:', fieldName);
            console.log('Value:', value);
            
            // Update the billing details object
            switch(fieldName) {
                case 'retainage':
                    this.billingDetails.RetainageOnBill = value;
                    break;
                case 'billRef':
                    this.billingDetails.BillingReferenceNumber = value || '';
                    break;
                case 'applicationNumber':
                    this.billingDetails.ApplicationNumber = value || '';
                    break;
                case 'startDate':
                    this.billingDetails.StartDate = value || '';
                    break;
                case 'endDate':
                    this.billingDetails.EndDate = value || '';
                    break;
                case 'paymentDueDate':
                    this.billingDetails.PaymentDueDate = value || '';
                    break;
                case 'sentDate':
                    this.billingDetails.SentDate = value || '';
                    break;
            }

            console.log('Updated Billing Details:', this.billingDetails);
            
            this.checkBillingChanges();
        } catch (error) {
            console.error('Error in handleBillingFieldChange:', error);
        }
    }

    /** 
     * Method Name: checkBillingChanges
     * @description: Compares current billing details with original values to detect changes.
     */
    checkBillingChanges() {
        try {
            this.hasBillingChanges = JSON.stringify(this.billingDetails) !== JSON.stringify(this.originalBillingDetails);
        } catch (error) {
            console.error('Error in checkBillingChanges:', error);
        }
    }

    /** 
     * Method Name: handleSaveBillingInfo
     * @description: Saves billing information changes to the server by calling Apex method.
     */
    handleSaveBillingInfo() {
        try {
            if (!this.hasBillingChanges) return;

            this.isSavingBillingInfo = true;

            // Create field values map
            const fieldValues = {};
            
            if (this.billingDetails.Status !== this.originalBillingDetails.Status) {
                fieldValues['Status'] = this.billingDetails.Status;
            }
            if (this.billingDetails.RetainageOnBill !== this.originalBillingDetails.RetainageOnBill) {
                fieldValues['RetainageOnBill'] = this.billingDetails.RetainageOnBill;
            }
            if (this.billingDetails.wfrecon__Sent_Date__c !== this.originalBillingDetails.wfrecon__Sent_Date__c) {
                fieldValues['wfrecon__Sent_Date__c'] = this.billingDetails.wfrecon__Sent_Date__c;
            }
            if (this.billingDetails.BillingReferenceNumber !== this.originalBillingDetails.BillingReferenceNumber) {
                fieldValues['BillingReferenceNumber'] = this.billingDetails.BillingReferenceNumber;
            }
            if (this.billingDetails.ApplicationNumber !== this.originalBillingDetails.ApplicationNumber) {
                fieldValues['ApplicationNumber'] = this.billingDetails.ApplicationNumber;
            }
            if (this.billingDetails.StartDate !== this.originalBillingDetails.StartDate) {
                fieldValues['StartDate'] = this.billingDetails.StartDate;
            }
            if (this.billingDetails.EndDate !== this.originalBillingDetails.EndDate) {
                fieldValues['EndDate'] = this.billingDetails.EndDate;
            }
            if (this.billingDetails.PaymentDueDate !== this.originalBillingDetails.PaymentDueDate) {
                fieldValues['PaymentDueDate'] = this.billingDetails.PaymentDueDate;
            }

            console.log('Field Values to Update:', fieldValues);
            
            updateBillingDetails({
                billingId: this.recordId,
                fieldValues: fieldValues
            })
                .then(() => {
                    this.showToast('Success', 'Billing information updated successfully', 'success');
                    this.loadBillingData(); // Refresh data
                })
                .catch(error => {
                    console.error('Error updating billing details:', error);
                    this.showToast('Error', 'Failed to update billing information', 'error');
                })
                .finally(() => {
                    this.isSavingBillingInfo = false;
                });
        } catch (error) {
            console.error('Error in handleSaveBillingInfo:', error);
            this.isSavingBillingInfo = false;
        }
    }

    /** 
     * Method Name: handleCellClick
     * @description: Handles cell click events to enable inline editing for editable cells.
     */
    handleCellClick(event) {
        try {
            const recordId = event.currentTarget.dataset.recordId;
            const fieldName = event.currentTarget.dataset.fieldName;
            const cellKey = `${recordId}-${fieldName}`;
            
            if (this.editingCells.has(cellKey)) return;
            
            this.editingCells.add(cellKey);
            this.updateItemEditingState(recordId, fieldName, true);
            
            // Focus the input after DOM update
            setTimeout(() => {
                const input = this.template.querySelector(`input[data-record-id="${recordId}"][data-field-name="${fieldName}"]`);
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 50);
        } catch (error) {
            console.error('Error in handleCellClick:', error);
        }
    }

    /** 
     * Method Name: handleCellMouseEnter
     * @description: Adds hover styling when mouse enters an editable cell.
     */
    handleCellMouseEnter(event) {
        const cell = event.currentTarget;
        cell.classList.add('hover-edit');
    }

    /** 
     * Method Name: handleCellMouseLeave
     * @description: Removes hover styling when mouse leaves an editable cell.
     */
    handleCellMouseLeave(event) {
        const cell = event.currentTarget;
        cell.classList.remove('hover-edit');
    }

    /** 
     * Method Name: handleCellInputChange
     * @description: Handles input changes in editable cells, tracks modifications, and updates totals.
     */
    handleCellInputChange(event) {
        try {
            const recordId = event.target.dataset.recordId;
            const fieldName = event.target.dataset.fieldName;
            const newValue = parseFloat(event.target.value) || 0;
            
            // Update the value in the appropriate array
            this.updateItemValue(recordId, fieldName, newValue);
            
            // Track modification and add/remove highlighting
            const originalValue = this.getOriginalValue(recordId, fieldName);
            const cell = event.target.closest('.data-cell');
            
            if (!this.areValuesEqual(newValue, originalValue)) {
                this.trackModification(recordId, fieldName, newValue);
                // Add highlighting
                if (cell) {
                    cell.classList.add('modified-cell');
                }
            } else {
                this.removeModification(recordId, fieldName);
                // Remove highlighting
                if (cell) {
                    cell.classList.remove('modified-cell');
                }
            }
            
            // Update totals
            this.calculateTotals();
        } catch (error) {
            console.error('Error in handleCellInputChange:', error);
        }
    }

    /** 
     * Method Name: areValuesEqual
     * @description: Compares two values for equality with special handling for null and numeric values.
     */
    areValuesEqual(value1, value2) {
        // Handle null/undefined comparisons
        if (value1 == null && value2 == null) return true;
        if (value1 == null || value2 == null) return false;
        
        // For numeric values, compare with small tolerance
        if (typeof value1 === 'number' && typeof value2 === 'number') {
            return Math.abs(value1 - value2) < 0.001;
        }
        
        // For other values, use strict equality
        return value1 === value2;
    }

    /** 
     * Method Name: getOriginalValue
     * @description: Retrieves the original value for a field from the initial data load.
     */
    getOriginalValue(recordId, fieldName) {
        // Find original value from the initial data load
        const originalContractItem = this.originalContractItems?.find(item => item.Id === recordId);
        const originalChangeOrderItem = this.originalChangeOrderItems?.find(item => item.Id === recordId);
        
        if (originalContractItem) {
            return originalContractItem.rawThisBillingPercent;
        } else if (originalChangeOrderItem) {
            return originalChangeOrderItem.rawThisBillingPercent;
        }
        
        return 0;
    }

    /** 
     * Method Name: handleCellInputBlur
     * @description: Handles input blur events to exit editing mode for cells.
     */
    handleCellInputBlur(event) {
        const recordId = event.target.dataset.recordId;
        const fieldName = event.target.dataset.fieldName;
        const cellKey = `${recordId}-${fieldName}`;
        
        setTimeout(() => {
            this.editingCells.delete(cellKey);
            this.updateItemEditingState(recordId, fieldName, false);
        }, 100);
    }

    /** 
     * Method Name: updateItemEditingState
     * @description: Updates the editing state for a specific line item and field.
     */
    updateItemEditingState(recordId, fieldName, isEditing) {
        const contractItem = this.contractLineItems.find(item => item.Id === recordId);
        const changeOrderItem = this.changeOrderLineItems.find(item => item.Id === recordId);
        
        if (contractItem) {
            contractItem.isEditingThisBillingPercent = isEditing;
            this.contractLineItems = [...this.contractLineItems];
        } else if (changeOrderItem) {
            changeOrderItem.isEditingThisBillingPercent = isEditing;
            this.changeOrderLineItems = [...this.changeOrderLineItems];
        }
    }

    /** 
     * Method Name: updateItemValue
     * @description: Updates the value of a specific field in a line item and applies styling.
     */
    updateItemValue(recordId, fieldName, newValue) {
        const contractItem = this.contractLineItems.find(item => item.Id === recordId);
        const changeOrderItem = this.changeOrderLineItems.find(item => item.Id === recordId);
        
        const isModified = !this.areValuesEqual(newValue, this.getOriginalValue(recordId, fieldName));
        const cellClass = isModified ? 'editable-cell modified-cell' : 'editable-cell';
        
        if (contractItem) {
            contractItem.thisBillingCompletePercent = this.formatPercent(newValue);
            contractItem.rawThisBillingPercent = newValue;
            contractItem.thisBillingPercentCellClass = cellClass;
            this.contractLineItems = [...this.contractLineItems];
        } else if (changeOrderItem) {
            changeOrderItem.thisBillingCompletePercent = this.formatPercent(newValue);
            changeOrderItem.rawThisBillingPercent = newValue;
            changeOrderItem.thisBillingPercentCellClass = cellClass;
            this.changeOrderLineItems = [...this.changeOrderLineItems];
        }

        console.log('Updated item:', contractItem || changeOrderItem);
        console.log('Contract items:', this.contractLineItems);
        console.log('Change order items:', this.changeOrderLineItems);
        console.log('Modified contract items:', this.modifiedContractItems);
        console.log('Modified change order items:', this.modifiedChangeOrderItems);
    }

    /** 
     * Method Name: removeModification
     * @description: Removes a field modification from the tracking maps when value is reverted.
     */
    removeModification(recordId, fieldName) {
        if (this.modifiedContractItems.has(recordId)) {
            const modifications = this.modifiedContractItems.get(recordId);
            delete modifications[fieldName];
            
            if (Object.keys(modifications).length === 0) {
                this.modifiedContractItems.delete(recordId);
            } else {
                this.modifiedContractItems.set(recordId, modifications);
            }
            
            this.hasContractModifications = this.modifiedContractItems.size > 0;
        }
        
        if (this.modifiedChangeOrderItems.has(recordId)) {
            const modifications = this.modifiedChangeOrderItems.get(recordId);
            delete modifications[fieldName];
            
            if (Object.keys(modifications).length === 0) {
                this.modifiedChangeOrderItems.delete(recordId);
            } else {
                this.modifiedChangeOrderItems.set(recordId, modifications);
            }
            
            this.hasChangeOrderModifications = this.modifiedChangeOrderItems.size > 0;
        }
    }

    /** 
     * Method Name: trackModification
     * @description: Tracks field modifications for contract and change order items.
     */
    trackModification(recordId, fieldName, newValue) {
        const contractItem = this.contractLineItems.find(item => item.Id === recordId);
        const changeOrderItem = this.changeOrderLineItems.find(item => item.Id === recordId);
        
        if (contractItem) {
            this.modifiedContractItems.set(recordId, { [fieldName]: newValue });
            this.hasContractModifications = this.modifiedContractItems.size > 0;
        } else if (changeOrderItem) {
            this.modifiedChangeOrderItems.set(recordId, { [fieldName]: newValue });
            this.hasChangeOrderModifications = this.modifiedChangeOrderItems.size > 0;
        }
    }

    /** 
     * Method Name: handleSaveContractChanges
     * @description: Saves contract line item changes to the server and refreshes data.
     */
    handleSaveContractChanges() {
        try {
            if (this.modifiedContractItems.size === 0) return;
            
            this.isSavingContract = true;
            
            // Prepare line item updates
            const lineItemUpdates = [];
            for (let [recordId, modifications] of this.modifiedContractItems) {
                const update = { Id: recordId };
                for (let [fieldName, value] of Object.entries(modifications)) {
                    if (fieldName === 'thisBillingPercent') {
                        update['wfrecon__This_Billing_Percent__c'] = value;
                    }
                }
                lineItemUpdates.push(update);
            }

            console.log('lineItemUpdates:', lineItemUpdates);

            
            saveBillingLineItems({
                billingId: this.recordId,
                lineItemUpdates: lineItemUpdates
            })
                .then(() => {
                    this.modifiedContractItems.clear();
                    this.hasContractModifications = false;
                    this.clearModifiedStyling('contract');
                    this.showToast('Success', 'Contract changes saved successfully', 'success');
                    this.loadBillingData(); // Refresh data
                })
                .catch(error => {
                    console.error('Error saving contract changes:', error);
                    this.showToast('Error', 'Failed to save contract changes', 'error');
                })
                .finally(() => {
                    this.isSavingContract = false;
                });
        } catch (error) {
            console.error('Error in handleSaveContractChanges :: ', error);
        }
    }

    /** 
     * Method Name: handleDiscardContractChanges
     * @description: Discards contract line item changes and reverts to original values.
     */
    handleDiscardContractChanges() {
        this.modifiedContractItems.clear();
        this.hasContractModifications = false;
        this.editingCells.clear();
        this.clearModifiedStyling('contract');
        this.loadBillingData(); // Refresh to original values
        this.showToast('Success', 'Contract changes discarded', 'success');
    }

    /** 
     * Method Name: handleSaveChangeOrderChanges
     * @description: Saves change order line item changes to the server and refreshes data.
     */
    handleSaveChangeOrderChanges() {
        try {
            if (this.modifiedChangeOrderItems.size === 0) return;
            
            this.isSavingChangeOrder = true;
            
            // Prepare line item updates
            const lineItemUpdates = [];
            for (let [recordId, modifications] of this.modifiedChangeOrderItems) {
                const update = { Id: recordId };
                for (let [fieldName, value] of Object.entries(modifications)) {
                    if (fieldName === 'thisBillingPercent') {
                        update['wfrecon__This_Billing_Percent__c'] = value;
                    }
                }
                lineItemUpdates.push(update);
            }

            console.log('lineItemUpdates:', lineItemUpdates);
            
            
            saveBillingLineItems({
                billingId: this.recordId,
                lineItemUpdates: lineItemUpdates
            })
                .then(() => {
                    this.modifiedChangeOrderItems.clear();
                    this.hasChangeOrderModifications = false;
                    this.clearModifiedStyling('changeorder');
                    this.showToast('Success', 'Change Order changes saved successfully', 'success');
                    this.loadBillingData(); // Refresh data
                })
                .catch(error => {
                    console.error('Error saving change order changes:', error);
                    this.showToast('Error', 'Failed to save change order changes', 'error');
                })
                .finally(() => {
                    this.isSavingChangeOrder = false;
                });
        } catch (error) {
            console.error('Error in handleSaveChangeOrderChanges:', error);
        }
    }

    /** 
     * Method Name: handleDiscardChangeOrderChanges
     * @description: Discards change order line item changes and reverts to original values.
     */
    handleDiscardChangeOrderChanges() {
        this.modifiedChangeOrderItems.clear();
        this.hasChangeOrderModifications = false;
        this.editingCells.clear();
        this.clearModifiedStyling('changeorder');
        this.loadBillingData(); // Refresh to original values
        this.showToast('Success', 'Change Order changes discarded', 'success');
    }

    /** 
     * Method Name: clearModifiedStyling
     * @description: Clears modified styling from table rows and cells for specified table type.
     */
    clearModifiedStyling(tableType) {
        try {
            const items = tableType === 'contract' ? this.contractLineItems : this.changeOrderLineItems;
            items.forEach(item => {
                item.rowClass = '';
            });
            
            if (tableType === 'contract') {
                this.contractLineItems = [...this.contractLineItems];
            } else {
                this.changeOrderLineItems = [...this.changeOrderLineItems];
            }

            // Also clear DOM styling
            setTimeout(() => {
                const tables = this.template.querySelectorAll('table');
                tables.forEach(table => {
                    const rows = table.querySelectorAll('tr');
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        cells.forEach(cell => {
                            cell.classList.remove('modified-cell');
                        });
                    });
                });
            }, 0);
        } catch (error) {
            console.error('Error in clearModifiedStyling:', error);
        }
    }

    /** 
     * Method Name: formatCurrency
     * @description: Formats a numeric value as USD currency string.
     */
    formatCurrency(value) {
        if (value === null || value === undefined) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(value);
    }

    /** 
     * Method Name: formatPercent
     * @description: Formats a numeric value as a percentage string with two decimal places.
     */
    formatPercent(value) {
        if (value === null || value === undefined) return '0.00%';
        return `${parseFloat(value).toFixed(2)}%`;
    }

    /** 
     * Method Name: showToast
     * @description: Displays a toast notification with specified title, message, and variant.
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