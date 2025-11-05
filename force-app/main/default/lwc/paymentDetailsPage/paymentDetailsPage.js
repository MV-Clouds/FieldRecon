import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getPaymentData from '@salesforce/apex/PaymentDetailsPageController.getPaymentData';
import updatePaymentDetails from '@salesforce/apex/PaymentDetailsPageController.updatePaymentDetails';
import savePaymentLineItems from '@salesforce/apex/PaymentDetailsPageController.savePaymentLineItems';

export default class PaymentDetailsPage extends NavigationMixin(LightningElement) {
    @api recordId;
    @track isLoading = true;
    @track paymentRecord;
    @track contractLineItems = [];
    @track changeOrderLineItems = [];
    @track originalContractItems = [];
    @track originalChangeOrderItems = [];
    @track modifiedContractItems = new Map();
    @track modifiedChangeOrderItems = new Map();
    @track editingCells = new Set();
    @track hasContractModifications = false;
    @track hasChangeOrderModifications = false;
    @track isSavingContract = false;
    @track isSavingChangeOrder = false;
    @track contractTotals = {};
    @track changeOrderTotals = {};
    @track paymentDetails = {};
    @track originalPaymentDetails = {};
    @track isSavingPaymentInfo = false;
    @track hasPaymentChanges = false;

    get isSavePaymentDisabled() {
        return !this.hasPaymentChanges || this.isSavingPaymentInfo;
    }

    get isContractSaveDisabled() {
        return !this.hasContractModifications || this.isSavingContract;
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

    get formattedTotalPaidAmount() {
        return this.formatCurrency(this.paymentDetails.TotalPaidAmount);
    }

    get savePaymentButtonLabel() {
        return this.isSavingPaymentInfo ? 'Saving...' : 'Save Changes';
    }

    /** 
     * Method Name: connectedCallback
     * @description: LWC lifecycle hook that initializes the component and loads payment data.
     */
    connectedCallback() {
        console.log('PaymentDetailsPage connected with recordId:', this.recordId);
        if (this.recordId) {
            this.loadPaymentData();
        }
    }

    /** 
     * Method Name: loadPaymentData
     * @description: Fetches payment data from Apex controller and processes the response.
     */
    loadPaymentData() {
        try {
            this.isLoading = true;
            getPaymentData({ paymentId: this.recordId })
                .then(result => {
                    console.log('Payment data loaded:', result);
                    this.paymentRecord = result;
                    this.processPaymentDetails(result.paymentDetails);
                    this.processLineItems(result.paymentLineItems);
                    this.calculateTotals();
                    this.isLoading = false;
                })
                .catch(error => {
                    console.error('Error loading payment data:', error);
                    this.showToast('Error', 'Failed to load payment data: ' + error.body.message, 'error');
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error loading payment data:', error);
            this.showToast('Error', 'Failed to load payment data: ' + error.body.message, 'error');
            this.isLoading = false;
        }
    }

    /** 
     * Method Name: processPaymentDetails
     * @description: Processes payment details from server response and handles null values.
     */
    processPaymentDetails(payDetails) {
        this.paymentDetails = {
            Id: payDetails.Id || '',
            Name: payDetails.Name || '--',
            AccountName: payDetails.AccountName || '--',
            Address: payDetails.Address || '--',
            BillingId: payDetails.BillingId || '',
            BillingNumber: payDetails.BillingNumber || '--',
            JobId: payDetails.JobId || '',
            JobName: payDetails.JobName || '--',
            JobNumber: payDetails.JobNumber || '--',
            PaymentReceivedDate: payDetails.PaymentReceivedDate || null,
            PaymentReference: payDetails.PaymentReference || '',
            TotalPaidAmount: payDetails.TotalPaidAmount || 0.00
        };

        // Store original values for comparison
        this.originalPaymentDetails = { ...this.paymentDetails };
        this.hasPaymentChanges = false;
    }

    /** 
     * Method Name: processLineItems
     * @description: Processes line items and separates them into contract and change order items.
     */
    processLineItems(paymentLineItems) {
        const contractItems = [];
        const changeOrderItems = [];

        paymentLineItems.forEach(item => {
            const processedItem = this.processLineItem(item);
            
            // Separate based on line item type
            if (item.wfrecon__Billing_Line_Item__r && 
                item.wfrecon__Billing_Line_Item__r.wfrecon__Scope_Entry_Type__c === 'Change Order') {
                changeOrderItems.push(processedItem);
            } else {
                contractItems.push(processedItem);
            }
        });

        // Add serial numbers to each group individually
        contractItems.forEach((item, index) => {
            item.SerialNumber = index + 1;
        });

        changeOrderItems.forEach((item, index) => {
            item.SerialNumber = index + 1;
        });

        this.contractLineItems = contractItems;
        this.changeOrderLineItems = changeOrderItems;
        
        // Store original values for comparison
        this.originalContractItems = JSON.parse(JSON.stringify(contractItems));
        this.originalChangeOrderItems = JSON.parse(JSON.stringify(changeOrderItems));
        
        this.hasContractModifications = false;
        this.hasChangeOrderModifications = false;
    }

    /** 
     * Method Name: processLineItem
     * @description: Transforms a single line item into display format with formatted values.
     */
    processLineItem(item) {
        return {
            Id: item.Id,
            ScopeEntryName: item.wfrecon__Billing_Line_Item__r?.wfrecon__Scope_Entry__r?.Name || '--',
            ContractValue: item.wfrecon__Billing_Line_Item__r?.wfrecon__Scope_Contract_Amount__c || 0,
            TotalBilledAmount: item.wfrecon__Billing_Line_Item__r.wfrecon__Bill_Item_Type__c == 'Regular' ? item.wfrecon__Billing_Line_Item__r?.wfrecon__This_Billing_Value__c || 0 : item.wfrecon__Billing_Line_Item__r?.wfrecon__Total_Retainage_Amount__c || 0,
            AmountReceived: item.wfrecon__Amount_Received__c || 0,
            FormattedContractValue: this.formatCurrency(item.wfrecon__Billing_Line_Item__r?.wfrecon__Scope_Contract_Amount__c || 0),
            FormattedTotalBilledAmount: item.wfrecon__Billing_Line_Item__r.wfrecon__Bill_Item_Type__c == 'Regular' ? this.formatCurrency(item.wfrecon__Billing_Line_Item__r?.wfrecon__This_Billing_Value__c || 0) : this.formatCurrency(item.wfrecon__Billing_Line_Item__r?.wfrecon__Total_Retainage_Amount__c || 0),
            FormattedAmountReceived: this.formatCurrency(item.wfrecon__Amount_Received__c || 0),
            IsEditingAmountReceived: false
        };
    }

    /** 
     * Method Name: calculateTotals
     * @description: Calculates totals for both contract and change order line items.
     */
    calculateTotals() {
        this.contractTotals = this.calculateTableTotals(this.contractLineItems);
        this.changeOrderTotals = this.calculateTableTotals(this.changeOrderLineItems);
    }

    /** 
     * Method Name: calculateTableTotals
     * @description: Calculates and formats totals for a given set of line items.
     */
    calculateTableTotals(items) {
        const totals = {
            ContractValue: 0,
            TotalBilledAmount: 0,
            AmountReceived: 0
        };

        items.forEach(item => {
            totals.ContractValue += item.ContractValue || 0;
            totals.TotalBilledAmount += item.TotalBilledAmount || 0;
            totals.AmountReceived += item.AmountReceived || 0;
        });

        return {
            ...totals,
            FormattedContractValue: this.formatCurrency(totals.ContractValue),
            FormattedTotalBilledAmount: this.formatCurrency(totals.TotalBilledAmount),
            FormattedAmountReceived: this.formatCurrency(totals.AmountReceived)
        };
    }

    /** 
     * Method Name: handlePaymentFieldChange
     * @description: Handles changes to various payment form fields and updates the payment details object.
     */
    handlePaymentFieldChange(event) {
        const fieldName = event.target.dataset.fieldName;
        const newValue = event.target.value;
        
        // Map field names to payment details properties
        let propertyName;
        if (fieldName === 'paymentReference') {
            propertyName = 'PaymentReference';
        } else if (fieldName === 'paymentReceivedDate') {
            propertyName = 'PaymentReceivedDate';
        }

        if (propertyName) {
            // Update the payment details object
            this.paymentDetails = {
                ...this.paymentDetails,
                [propertyName]: newValue
            };

            // Check if there are changes
            this.checkPaymentChanges();
        }
    }

    /** 
     * Method Name: checkPaymentChanges
     * @description: Compares current payment details with original values to detect changes.
     */
    checkPaymentChanges() {
        this.hasPaymentChanges = Object.keys(this.originalPaymentDetails).some(key => {
            return this.originalPaymentDetails[key] !== this.paymentDetails[key];
        });
    }

    /** 
     * Method Name: handleSavePaymentInfo
     * @description: Saves payment information changes to the server by calling Apex method.
     */
    handleSavePaymentInfo() {
        this.isSavingPaymentInfo = true;

        // Prepare field values for update
        const fieldValues = {};
        
        if (this.originalPaymentDetails.PaymentReference !== this.paymentDetails.PaymentReference) {
            fieldValues.PaymentReference = this.paymentDetails.PaymentReference;
        }
        if (this.originalPaymentDetails.PaymentReceivedDate !== this.paymentDetails.PaymentReceivedDate) {
            fieldValues.PaymentReceivedDate = this.paymentDetails.PaymentReceivedDate;
        }

        updatePaymentDetails({ 
            paymentId: this.recordId, 
            fieldValues: fieldValues 
        })
        .then(result => {
            if (result === 'SUCCESS') {
                this.showToast('Success', 'Payment information updated successfully', 'success');
                
                // Update original values
                this.originalPaymentDetails = { ...this.paymentDetails };
                this.hasPaymentChanges = false;
                
                // Optionally reload data to ensure consistency
                this.loadPaymentData();
            }
        })
        .catch(error => {
            console.error('Error saving payment info:', error);
            this.showToast('Error', 'Failed to save payment information: ' + error.body.message, 'error');
        })
        .finally(() => {
            this.isSavingPaymentInfo = false;
        });
    }

    /** 
     * Method Name: handleCellClick
     * @description: Handles cell click events to enable inline editing for editable cells.
     */
    handleCellClick(event) {
        const recordId = event.currentTarget.dataset.recordId;
        const fieldName = event.currentTarget.dataset.field;
        
        if (!recordId || !fieldName) return;
        
        // Enable editing for this cell
        this.updateItemEditingState(recordId, fieldName, true);
        
        // Focus the input after a short delay
        setTimeout(() => {
            const input = this.template.querySelector(`input[data-record-id="${recordId}"][data-field="${fieldName}"]`);
            if (input) {
                input.focus();
                input.select();
            }
        }, 10);
    }

    /** 
     * Method Name: handleCellMouseEnter
     * @description: Adds hover styling when mouse enters an editable cell.
     */
    handleCellMouseEnter(event) {
        event.currentTarget.classList.add('hover-edit');
    }

    /** 
     * Method Name: handleCellMouseLeave
     * @description: Removes hover styling when mouse leaves an editable cell.
     */
    handleCellMouseLeave(event) {
        event.currentTarget.classList.remove('hover-edit');
    }

    /** 
     * Method Name: handleCellInputChange
     * @description: Handles input changes in editable cells, tracks modifications, and updates totals.
     */
    handleCellInputChange(event) {
        const recordId = event.target.dataset.recordId;
        const fieldName = event.target.dataset.field;
        const newValue = event.target.value;
        
        // Update the item value
        this.updateItemValue(recordId, fieldName, newValue);
        
        // Track modification
        const originalValue = this.getOriginalValue(recordId, fieldName);
        if (this.areValuesEqual(newValue, originalValue)) {
            this.removeModification(recordId, fieldName);
        } else {
            this.trackModification(recordId, fieldName, newValue);
        }
        
        // Recalculate totals
        this.calculateTotals();
    }

    /** 
     * Method Name: areValuesEqual
     * @description: Compares two values for equality with special handling for null and numeric values.
     */
    areValuesEqual(value1, value2) {
        // Handle null/undefined
        if (value1 == null && value2 == null) return true;
        if (value1 == null || value2 == null) return false;
        
        // Convert to numbers for comparison if both are numeric
        const num1 = parseFloat(value1);
        const num2 = parseFloat(value2);
        
        if (!isNaN(num1) && !isNaN(num2)) {
            return Math.abs(num1 - num2) < 0.01; // Allow for small floating point differences
        }
        
        return String(value1) === String(value2);
    }

    /** 
     * Method Name: getOriginalValue
     * @description: Retrieves the original value for a field from the initial data load.
     */
    getOriginalValue(recordId, fieldName) {
        // Check contract items first
        const contractItem = this.originalContractItems.find(item => item.Id === recordId);
        if (contractItem) {
            if (fieldName === 'AmountReceived') return contractItem.AmountReceived;
        }
        
        // Check change order items
        const changeOrderItem = this.originalChangeOrderItems.find(item => item.Id === recordId);
        if (changeOrderItem) {
            if (fieldName === 'AmountReceived') return changeOrderItem.AmountReceived;
        }
        
        return null;
    }

    /** 
     * Method Name: handleCellInputBlur
     * @description: Handles input blur events to exit editing mode for cells.
     */
    handleCellInputBlur(event) {
        const recordId = event.target.dataset.recordId;
        const fieldName = event.target.dataset.field;
        
        // Disable editing for this cell
        this.updateItemEditingState(recordId, fieldName, false);
    }

    /** 
     * Method Name: updateItemEditingState
     * @description: Updates the editing state for a specific line item and field.
     */
    updateItemEditingState(recordId, fieldName, isEditing) {
        // Update contract items
        this.contractLineItems = this.contractLineItems.map(item => {
            if (item.Id === recordId) {
                if (fieldName === 'AmountReceived') {
                    return { ...item, IsEditingAmountReceived: isEditing };
                }
            }
            return item;
        });
        
        // Update change order items
        this.changeOrderLineItems = this.changeOrderLineItems.map(item => {
            if (item.Id === recordId) {
                if (fieldName === 'AmountReceived') {
                    return { ...item, IsEditingAmountReceived: isEditing };
                }
            }
            return item;
        });
    }

    /** 
     * Method Name: updateItemValue
     * @description: Updates the value of a specific field in a line item and applies styling.
     */
    updateItemValue(recordId, fieldName, newValue) {
        const numericValue = newValue ? parseFloat(newValue) : 0;
        
        // Update contract items
        this.contractLineItems = this.contractLineItems.map(item => {
            if (item.Id === recordId) {
                if (fieldName === 'AmountReceived') {
                    return {
                        ...item,
                        AmountReceived: numericValue,
                        FormattedAmountReceived: this.formatCurrency(numericValue)
                    };
                }
            }
            return item;
        });
        
        // Update change order items  
        this.changeOrderLineItems = this.changeOrderLineItems.map(item => {
            if (item.Id === recordId) {
                if (fieldName === 'AmountReceived') {
                    return {
                        ...item,
                        AmountReceived: numericValue,
                        FormattedAmountReceived: this.formatCurrency(numericValue)
                    };
                }
            }
            return item;
        });

        // Apply modified styling to the cell
        setTimeout(() => {
            const cell = this.template.querySelector(`td[data-record-id="${recordId}"][data-field="${fieldName}"]`);
            if (cell) {
                const originalValue = this.getOriginalValue(recordId, fieldName);
                if (!this.areValuesEqual(newValue, originalValue)) {
                    cell.classList.add('modified-cell');
                } else {
                    cell.classList.remove('modified-cell');
                }
            }
        }, 10);
    }

    /** 
     * Method Name: removeModification
     * @description: Removes a field modification from the tracking maps when value is reverted.
     */
    removeModification(recordId, fieldName) {
        // Check if this is a contract item
        if (this.originalContractItems.find(item => item.Id === recordId)) {
            if (this.modifiedContractItems.has(recordId)) {
                const modifications = this.modifiedContractItems.get(recordId);
                delete modifications[fieldName];
                
                if (Object.keys(modifications).length === 0) {
                    this.modifiedContractItems.delete(recordId);
                } else {
                    this.modifiedContractItems.set(recordId, modifications);
                }
            }
            this.hasContractModifications = this.modifiedContractItems.size > 0;
        }
        
        // Check if this is a change order item
        if (this.originalChangeOrderItems.find(item => item.Id === recordId)) {
            if (this.modifiedChangeOrderItems.has(recordId)) {
                const modifications = this.modifiedChangeOrderItems.get(recordId);
                delete modifications[fieldName];
                
                if (Object.keys(modifications).length === 0) {
                    this.modifiedChangeOrderItems.delete(recordId);
                } else {
                    this.modifiedChangeOrderItems.set(recordId, modifications);
                }
            }
            this.hasChangeOrderModifications = this.modifiedChangeOrderItems.size > 0;
        }
    }

    /** 
     * Method Name: trackModification
     * @description: Tracks field modifications for contract and change order items.
     */
    trackModification(recordId, fieldName, newValue) {
        // Check if this is a contract item
        if (this.originalContractItems.find(item => item.Id === recordId)) {
            if (!this.modifiedContractItems.has(recordId)) {
                this.modifiedContractItems.set(recordId, {});
            }
            const modifications = this.modifiedContractItems.get(recordId);
            modifications[fieldName] = newValue;
            this.modifiedContractItems.set(recordId, modifications);
            this.hasContractModifications = true;
        }
        
        // Check if this is a change order item
        if (this.originalChangeOrderItems.find(item => item.Id === recordId)) {
            if (!this.modifiedChangeOrderItems.has(recordId)) {
                this.modifiedChangeOrderItems.set(recordId, {});
            }
            const modifications = this.modifiedChangeOrderItems.get(recordId);
            modifications[fieldName] = newValue;
            this.modifiedChangeOrderItems.set(recordId, modifications);
            this.hasChangeOrderModifications = true;
        }
    }

    /** 
     * Method Name: handleSaveContractChanges
     * @description: Saves contract line item changes to the server and refreshes data.
     */
    handleSaveContractChanges() {
        this.isSavingContract = true;
        
        const updates = [];
        this.modifiedContractItems.forEach((modifications, recordId) => {
            updates.push({
                Id: recordId,
                ...modifications
            });
        });

        savePaymentLineItems({ 
            paymentId: 'a0dKY000003BE76YAG', 
            lineItemUpdates: updates 
        })
        .then(result => {
            if (result === 'SUCCESS') {
                this.showToast('Success', 'Contract line items updated successfully', 'success');
                this.modifiedContractItems.clear();
                this.hasContractModifications = false;
                this.clearModifiedStyling('contract');
                this.loadPaymentData(); // Reload to ensure data consistency
            }
        })
        .catch(error => {
            console.error('Error saving contract changes:', error);
            this.showToast('Error', 'Failed to save contract changes: ' + error.body.message, 'error');
        })
        .finally(() => {
            this.isSavingContract = false;
        });
    }

    /** 
     * Method Name: handleSaveChangeOrderChanges
     * @description: Saves change order line item changes to the server and refreshes data.
     */
    handleSaveChangeOrderChanges() {
        this.isSavingChangeOrder = true;
        
        const updates = [];
        this.modifiedChangeOrderItems.forEach((modifications, recordId) => {
            updates.push({
                Id: recordId,
                ...modifications
            });
        });

        savePaymentLineItems({ 
            paymentId: 'a0dKY000003BE76YAG', 
            lineItemUpdates: updates 
        })
        .then(result => {
            if (result === 'SUCCESS') {
                this.showToast('Success', 'Change order line items updated successfully', 'success');
                this.modifiedChangeOrderItems.clear();
                this.hasChangeOrderModifications = false;
                this.clearModifiedStyling('changeorder');
                this.loadPaymentData(); // Reload to ensure data consistency
            }
        })
        .catch(error => {
            console.error('Error saving change order changes:', error);
            this.showToast('Error', 'Failed to save change order changes: ' + error.body.message, 'error');
        })
        .finally(() => {
            this.isSavingChangeOrder = false;
        });
    }

    /** 
     * Method Name: clearModifiedStyling
     * @description: Clears modified styling from table rows and cells for specified table type.
     */
    clearModifiedStyling(tableType) {
        setTimeout(() => {
            const modifiedCells = this.template.querySelectorAll('.modified-cell');
            modifiedCells.forEach(cell => {
                cell.classList.remove('modified-cell');
            });
        }, 100);
    }

    /** 
     * Method Name: formatCurrency
     * @description: Formats a numeric value as USD currency string.
     */
    formatCurrency(value) {
        if (value == null || value === '') return '$0.00';
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue)) return '$0.00';
        
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(numValue);
    }

    /** 
     * Method Name: navigateToRecord
     * @description: Navigates to the specified record page.
     */
    navigateToRecord(event) {
        const recordId = event.target.dataset.val;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                actionName: 'view'
            }
        });
    }

    /** 
     * Method Name: showToast
     * @description: Displays a toast notification with specified title, message, and variant.
     */
    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(evt);
    }
}