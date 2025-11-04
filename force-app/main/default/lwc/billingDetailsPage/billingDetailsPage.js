import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import BILLING_OBJECT from '@salesforce/schema/Billing__c';
import STATUS_FIELD from '@salesforce/schema/Billing__c.Status__c';
import getBillingsData from '@salesforce/apex/BillingDetailsPageController.getBillingsData';
import updateBillingDetails from '@salesforce/apex/BillingDetailsPageController.updateBillingDetails';
import saveBillingLineItems from '@salesforce/apex/BillingDetailsPageController.saveBillingLineItems';

export default class BillingDetailsPage extends NavigationMixin(LightningElement) {
    @api recordId;
    @track isLoading = true;
    @track billingRecord;
    @track isRegularBilling = true;
    @track contractLineItems = [];
    @track changeOrderLineItems = [];
    @track originalContractItems = [];
    @track originalChangeOrderItems = [];
    @track modifiedContractItems = new Map();
    @track modifiedChangeOrderItems = new Map();
    @track editingCells = new Set();
    @track hasContractModifications = false;
    @track hasChangeOrderModifications = false;
    @track isSavingLineItems = false;
    @track contractTotals = {};
    @track changeOrderTotals = {};
    @track billingDetails = {};
    @track originalBillingDetails = {};
    @track isEditingStatus = false;
    @track isSavingBillingInfo = false;
    @track hasBillingChanges = false;
    @track statusOptions = [];
    @track pdfTemplate = false;

    // Get object metadata (to access record type ID)
    @wire(getObjectInfo, { objectApiName: BILLING_OBJECT })
    objectInfo;

    // Get picklist values for Status__c
    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: STATUS_FIELD
    })

    /** 
     * Method Name: wiredStatusValues
     * @description: Wires picklist values for Status__c and prepares options including 'All'.
     */
    wiredStatusValues({ data, error }) {
        if (data) {
            this.statusOptions = [
                { label: 'All', value: 'All' },
                ...data.values
                    .filter(item => item.value !== 'Approved')
                    .map(item => ({
                        label: item.label,
                        value: item.value
                    }))
            ];
        } else if (error) {
            console.error('Error fetching picklist values:', error);
        }
    }

    get isSaveBillingDisabled() {
        return !this.hasBillingChanges || this.isSavingBillingInfo;
    }

    get isBillingButtonsDisabled() {
        return !this.hasBillingChanges || this.isSavingBillingInfo;
    }

    get hasAnyLineItemModifications() {
        return this.hasContractModifications || this.hasChangeOrderModifications;
    }

    get isLineItemButtonsDisabled() {
        return !this.hasAnyLineItemModifications || this.isSavingLineItems;
    }

    get isLineItemSaveDisabled() {
        return !this.hasAnyLineItemModifications || this.isSavingLineItems;
    }

    get lineItemSaveButtonLabel() {
        return this.isSavingLineItems ? 'Saving...' : 'Save';
    }

    get isBillingApproved() {
        const status = this.billingDetails && this.billingDetails.Status ? this.billingDetails.Status : '';
        return status === 'Approved';
    }

    get isBillingApprovedOrRegular() {
        const status = this.billingDetails && this.billingDetails.Status ? this.billingDetails.Status : '';
        return status === 'Approved' || this.isRegularBilling === false;
    }

    get lineItemActionsClass() {
        return this.isBillingApproved ? 'table-actions hidden' : 'table-actions';
    }

    get contractTableContainerClass() {
        return this.isBillingApproved ? 'data-table-container read-only-table' : 'data-table-container';
    }

    get changeOrderTableContainerClass() {
        return this.isBillingApproved ? 'data-table-container read-only-table' : 'data-table-container';
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
        return this.formatCurrency(this.billingDetails.CurrentPaymentDue);
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

    get formattedLessPreviousCertificatedforPayment() {
        return this.formatCurrency(this.billingDetails.LessPreviousCertificatedforPayment);
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
            this.isRegularBilling = this.billingDetails.BillType === 'Regular';
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
        const contractValue = item.wfrecon__Scope_Contract_Amount__c || 0;
        const previousBilledAmount = item.wfrecon__Previous_Billed_Value__c || 0;
        const thisBillingAmountValue = item.wfrecon__This_Billing_Value__c || 0;
        const retainagePercentValue = item.wfrecon__Retainage_Percent_on_Bill_Line_Item__c || 0;
        const thisRetainageAmountValue = item.wfrecon__This_Retainage_Amount__c || 0;
        const totalRetainageAmountValue = item.wfrecon__Total_Retainage_Amount__c || 0;
        const previousRetainageAmount = Math.max(0, totalRetainageAmountValue - thisRetainageAmountValue);

        const totalBilledWithRetainage = previousBilledAmount + thisBillingAmountValue + previousRetainageAmount + thisRetainageAmountValue;
        const billingPercentValue = item.wfrecon__This_Billing_Percent__c != null
            ? item.wfrecon__This_Billing_Percent__c
            : (contractValue > 0 ? (totalBilledWithRetainage / contractValue) * 100 : 0);
        const totalCompleteAmountValue = totalBilledWithRetainage;
        const dueThisBillingValue = item.wfrecon__Due_This_Billing__c != null
            ? item.wfrecon__Due_This_Billing__c
            : (thisBillingAmountValue - thisRetainageAmountValue);

        return {
            Id: item.Id,
            scopeEntryName: item.wfrecon__Scope_Entry__r?.Name || '--',
            contractValue: this.formatCurrency(contractValue),
            previousBilledPercent: this.formatPercent(item.wfrecon__Previous_Billed_Percent__c),
            previousBilledAmount: this.formatCurrency(previousBilledAmount),
            currentCompletePercent: this.formatPercent(item.wfrecon__Scope_Complete__c),
            thisBillingCompletePercent: this.formatPercent(billingPercentValue),
            totalCompleteAmount: this.formatCurrency(totalCompleteAmountValue),
            thisBillingAmount: this.formatCurrency(thisBillingAmountValue),
            retainagePercent: this.formatPercent(retainagePercentValue),
            retainageAmount: this.formatCurrency(thisRetainageAmountValue),
            dueThisBilling: this.formatCurrency(dueThisBillingValue),
            thisBillRetainageAmount: this.formatCurrency(totalRetainageAmountValue),
            isEditingThisBillingPercent: false,
            isEditingRetainagePercent: false,
            isEditingThisBillingAmount: false,
            rowClass: '',
            thisBillingPercentCellClass: 'editable-cell',
            retainagePercentCellClass: 'editable-cell',
            thisBillingAmountCellClass: 'editable-cell',
            
            // Raw values for calculations
            rawScopeContractValue: contractValue,
            rawPreviousBilledAmount: previousBilledAmount,
            rawTotalCompleteAmount: totalCompleteAmountValue,
            rawThisBillingAmount: thisBillingAmountValue,
            rawThisBillRetainageAmount: totalRetainageAmountValue,
            rawRetainagePercent: retainagePercentValue,
            rawRetainageAmount: thisRetainageAmountValue,
            rawDueThisBilling: dueThisBillingValue,
            rawThisBillingPercent: billingPercentValue,
            rawPreviousBilledPercent: item.wfrecon__Previous_Billed_Percent__c || 0,
            rawCurrentCompletePercent: item.wfrecon__Scope_Complete__c || 0,
            baseRetainageBeforeCurrent: previousRetainageAmount
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
            acc.thisBillRetainageAmount += item.rawThisBillRetainageAmount;
            acc.retainageAmount += item.rawRetainageAmount;
            acc.dueThisBilling += item.rawDueThisBilling;
            return acc;
        }, {
            contractValue: 0,
            previousBilledAmount: 0,
            totalCompleteAmount: 0,
            thisBillingAmount: 0,
            thisBillRetainageAmount: 0,
            retainageAmount: 0,
            dueThisBilling: 0
        });

        // Format the totals
        return {
            contractValue: this.formatCurrency(totals.contractValue),
            previousBilledAmount: this.formatCurrency(totals.previousBilledAmount),
            totalCompleteAmount: this.formatCurrency(totals.totalCompleteAmount),
            thisBillingAmount: this.formatCurrency(totals.thisBillingAmount),
            thisBillRetainageAmount: this.formatCurrency(totals.thisBillRetainageAmount),
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
                fieldValues['RetainageOnBill'] = parseFloat(this.billingDetails.RetainageOnBill);
            }
            if (this.billingDetails.SentDate !== this.originalBillingDetails.SentDate) {
                fieldValues['SentDate'] = this.billingDetails.SentDate;
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
     * Method Name: handleDiscardBillingChanges
     * @description: Discards billing information changes and reverts to original values.
     */
    handleDiscardBillingChanges() {
        try {
            // Revert billing details to original values
            this.billingDetails = { ...this.originalBillingDetails };
            this.hasBillingChanges = false;
            this.showToast('Success', 'Billing changes discarded', 'success');
        } catch (error) {
            console.error('Error in handleDiscardBillingChanges:', error);
            this.showToast('Error', 'Error discarding billing changes', 'error');
        }
    }

    /** 
     * Method Name: handleCellClick
     * @description: Handles cell click events to enable inline editing for editable cells.
     */
    handleCellClick(event) {
        try {
            if (this.isBillingApproved) {
                return;
            }
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
            if (this.isBillingApproved) {
                return;
            }
            const recordId = event.target.dataset.recordId;
            const fieldName = event.target.dataset.fieldName;
            const numericValue = parseFloat(event.target.value);
            const safeValue = Number.isNaN(numericValue) ? 0 : numericValue;

            switch (fieldName) {
                case 'This_Billing_Value__c':
                    this.applyBillingAmountChange(recordId, safeValue, event.target);
                    break;
                case 'This_Billing_Percent__c':
                    this.applyBillingPercentChange(recordId, safeValue, event.target);
                    break;
                case 'Retainage_Percent_on_Bill_Line_Item__c':
                    this.applyRetainagePercentChange(recordId, safeValue, event.target);
                    break;
                default:
                    break;
            }

            this.calculateTotals();
        } catch (error) {
            console.error('Error in handleCellInputChange:', error);
        }
    }

    /**
     * Method Name: applyBillingAmountChange
     * @description: Handles recalculations and validations when This Billing Amount is edited.
     */
    applyBillingAmountChange(recordId, newValue, inputElement) {
        const context = this.getItemContext(recordId);
        if (!context) {
            return;
        }

        const baseline = this.getItemBaseline(context.item);
        const retainagePercent = context.item.rawRetainagePercent || 0;

        let amount = newValue;
        if (amount < 0) {
            amount = 0;
            inputElement.value = amount;
            this.showToast('Warning', 'This Billing Amount cannot be negative.', 'warning');
        }

        const bounds = this.calculateAmountBounds(baseline, retainagePercent);

        if (baseline.contractValue > 0 && bounds.maxAmount !== Number.POSITIVE_INFINITY && amount > bounds.maxAmount) {
            amount = bounds.maxAmount;
            inputElement.value = amount;
            this.showToast('Warning', 'This Billing Amount adjusted to stay within contract value.', 'warning');
        }

        if (baseline.contractValue > 0 && amount < bounds.minAmount) {
            amount = bounds.minAmount;
            inputElement.value = amount;
            if (baseline.minPercent > 0) {
                this.showToast('Warning', `This Billing Amount adjusted to meet minimum completion of ${baseline.minPercent.toFixed(2)}%.`, 'warning');
            } else {
                this.showToast('Warning', 'This Billing Amount adjusted to meet minimum completion requirements.', 'warning');
            }
        }

        const result = this.computeValuesFromAmount(baseline, amount, retainagePercent);
        this.applyComputedValues(context, baseline, result, retainagePercent);

        inputElement.value = result.amount;

        this.markCellAsModified(context, 'This_Billing_Value__c', result.amount, inputElement.closest('.data-cell'));
        this.markCellAsModified(context, 'This_Billing_Percent__c', result.percent, this.getCellElement(recordId, 'This_Billing_Percent__c'));

        this.commitItemChanges(context);
    }

    /**
     * Method Name: applyBillingPercentChange
     * @description: Handles recalculations and validations when This Billing Complete % is edited.
     */
    applyBillingPercentChange(recordId, newValue, inputElement) {
        const context = this.getItemContext(recordId);
        if (!context) {
            return;
        }

        const baseline = this.getItemBaseline(context.item);
        const retainagePercent = context.item.rawRetainagePercent || 0;

        let percent = newValue;
        if (percent < 0) {
            percent = 0;
            this.showToast('Warning', 'This Billing Complete % cannot be less than 0%.', 'warning');
        }
        if (percent > 100) {
            percent = 100;
            this.showToast('Warning', 'This Billing Complete % cannot exceed 100%.', 'warning');
        }

        if (percent < baseline.minPercent) {
            percent = this.roundPercent(baseline.minPercent);
            this.showToast('Warning', `This Billing Complete % must be at least ${baseline.minPercent.toFixed(2)}%.`, 'warning');
        }

        let result = this.computeValuesFromPercent(baseline, percent, retainagePercent);

        // Ensure the derived amount also respects contract bounds
        const bounds = this.calculateAmountBounds(baseline, retainagePercent);
        if (baseline.contractValue > 0 && bounds.maxAmount !== Number.POSITIVE_INFINITY && result.amount > bounds.maxAmount) {
            const cappedResult = this.computeValuesFromAmount(baseline, bounds.maxAmount, retainagePercent);
            result = cappedResult;
            percent = cappedResult.percent;
            this.showToast('Warning', 'This Billing Complete % adjusted to stay within contract value.', 'warning');
        }

        if (baseline.contractValue > 0 && result.amount < bounds.minAmount) {
            const raisedResult = this.computeValuesFromAmount(baseline, bounds.minAmount, retainagePercent);
            result = raisedResult;
            percent = raisedResult.percent;
            if (baseline.minPercent > 0) {
                this.showToast('Warning', `This Billing Complete % adjusted to meet minimum completion of ${baseline.minPercent.toFixed(2)}%.`, 'warning');
            }
        }

        this.applyComputedValues(context, baseline, result, retainagePercent);

        inputElement.value = result.percent;

        this.markCellAsModified(context, 'This_Billing_Percent__c', result.percent, inputElement.closest('.data-cell'));
        this.markCellAsModified(context, 'This_Billing_Value__c', result.amount, this.getCellElement(recordId, 'This_Billing_Value__c'));

        this.commitItemChanges(context);
    }

    /**
     * Method Name: applyRetainagePercentChange
     * @description: Handles recalculations and validations when Retainage % is edited.
     */
    applyRetainagePercentChange(recordId, newValue, inputElement) {
        const context = this.getItemContext(recordId);
        if (!context) {
            return;
        }

        let retainagePercent = newValue;
        if (retainagePercent < 0) {
            retainagePercent = 0;
            this.showToast('Warning', 'Retainage % cannot be less than 0%.', 'warning');
        }
        if (retainagePercent > 100) {
            retainagePercent = 100;
            this.showToast('Warning', 'Retainage % cannot exceed 100%.', 'warning');
        }

        retainagePercent = this.roundPercent(retainagePercent);

        const baseline = this.getItemBaseline(context.item);
        const existingPercent = this.roundPercent(context.item.rawThisBillingPercent || 0);
        const bounds = this.calculateAmountBounds(baseline, retainagePercent);

        let result = this.computeValuesFromPercent(baseline, existingPercent, retainagePercent);
        let adjustmentApplied = false;

        if (baseline.contractValue > 0 && bounds.maxAmount !== Number.POSITIVE_INFINITY && result.amount > bounds.maxAmount) {
            result = this.computeValuesFromAmount(baseline, bounds.maxAmount, retainagePercent);
            adjustmentApplied = true;
        }

        if (baseline.contractValue > 0 && result.amount < bounds.minAmount) {
            result = this.computeValuesFromAmount(baseline, bounds.minAmount, retainagePercent);
            adjustmentApplied = true;
        }

        this.applyComputedValues(context, baseline, result, retainagePercent);

        inputElement.value = retainagePercent;

        this.markCellAsModified(context, 'Retainage_Percent_on_Bill_Line_Item__c', retainagePercent, inputElement.closest('.data-cell'));
        this.markCellAsModified(context, 'This_Billing_Value__c', result.amount, this.getCellElement(recordId, 'This_Billing_Value__c'));
        this.markCellAsModified(context, 'This_Billing_Percent__c', result.percent, this.getCellElement(recordId, 'This_Billing_Percent__c'));

        if (adjustmentApplied) {
            this.showToast('Warning', 'Retainage % change adjusted This Billing Amount to maintain contract limits. Please review.', 'warning');
        }

        this.commitItemChanges(context);
    }

    /**
     * Method Name: getItemContext
     * @description: Retrieves metadata about the line item for updates.
     */
    getItemContext(recordId) {
        const contractIndex = this.contractLineItems.findIndex(item => item.Id === recordId);
        if (contractIndex > -1) {
            return {
                item: this.contractLineItems[contractIndex],
                listName: 'contract',
                index: contractIndex
            };
        }

        const changeOrderIndex = this.changeOrderLineItems.findIndex(item => item.Id === recordId);
        if (changeOrderIndex > -1) {
            return {
                item: this.changeOrderLineItems[changeOrderIndex],
                listName: 'changeOrder',
                index: changeOrderIndex
            };
        }

        return null;
    }

    /**
     * Method Name: commitItemChanges
     * @description: Commits array changes to trigger component re-render.
     */
    commitItemChanges(context) {
        if (!context) {
            return;
        }
        if (context.listName === 'contract') {
            this.contractLineItems = [...this.contractLineItems];
        } else if (context.listName === 'changeOrder') {
            this.changeOrderLineItems = [...this.changeOrderLineItems];
        }
    }

    /**
     * Method Name: getItemBaseline
     * @description: Builds baseline values used for calculations and validation.
     */
    getItemBaseline(item) {
        const contractValue = item.rawScopeContractValue || 0;
        const previousBilledAmount = item.rawPreviousBilledAmount || 0;
        const previousRetainage = item.baseRetainageBeforeCurrent != null
            ? item.baseRetainageBeforeCurrent
            : Math.max(0, (item.rawThisBillRetainageAmount || 0) - (item.rawRetainageAmount || 0));

        if (item.baseRetainageBeforeCurrent == null) {
            item.baseRetainageBeforeCurrent = previousRetainage;
        }

        return {
            contractValue,
            previousBilledAmount,
            previousRetainage,
            minPercent: Math.max(item.rawPreviousBilledPercent || 0, item.rawCurrentCompletePercent || 0)
        };
    }

    /**
     * Method Name: calculateAmountBounds
     * @description: Calculates minimum and maximum allowable amounts for a line item.
     */
    calculateAmountBounds(baseline, retainagePercent) {
        const factor = 1 + (retainagePercent / 100);

        let maxAmount = Number.POSITIVE_INFINITY;
        let minAmount = 0;

        if (baseline.contractValue > 0) {
            const availableGross = baseline.contractValue - baseline.previousBilledAmount - baseline.previousRetainage;
            maxAmount = availableGross > 0 ? availableGross / factor : 0;

            const requiredGross = baseline.contractValue * (baseline.minPercent / 100);
            const remainingGrossNeeded = requiredGross - baseline.previousBilledAmount - baseline.previousRetainage;
            minAmount = remainingGrossNeeded > 0 ? remainingGrossNeeded / factor : 0;
        }

        return {
            minAmount: this.roundCurrency(Math.max(0, minAmount)),
            maxAmount: baseline.contractValue > 0 ? this.roundCurrency(Math.max(0, maxAmount)) : Number.POSITIVE_INFINITY,
            factor
        };
    }

    /**
     * Method Name: computeValuesFromAmount
     * @description: Computes derived values when using This Billing Amount as source of truth.
     */
    computeValuesFromAmount(baseline, amount, retainagePercent) {
        const roundedAmount = this.roundCurrency(amount);
        const retainageValue = this.roundCurrency(roundedAmount * retainagePercent / 100);
        const totalRetainage = this.roundCurrency(baseline.previousRetainage + retainageValue);
        const totalBilled = this.roundCurrency(baseline.previousBilledAmount + roundedAmount);
        const grossToDate = this.roundCurrency(totalBilled + totalRetainage);
        const percent = baseline.contractValue > 0 ? this.roundPercent((grossToDate / baseline.contractValue) * 100) : 0;

        return {
            amount: roundedAmount,
            retainageValue,
            totalRetainage,
            totalBilled,
            grossToDate,
            percent
        };
    }

    /**
     * Method Name: computeValuesFromPercent
     * @description: Computes derived values when using This Billing Complete % as source of truth.
     */
    computeValuesFromPercent(baseline, percent, retainagePercent) {
        const safePercent = this.roundPercent(percent);

        if (baseline.contractValue <= 0) {
            return this.computeValuesFromAmount(baseline, 0, retainagePercent);
        }

        const grossToDate = this.roundCurrency((baseline.contractValue * safePercent) / 100);
        const previousGross = this.roundCurrency(baseline.previousBilledAmount + baseline.previousRetainage);
        let grossContribution = this.roundCurrency(grossToDate - previousGross);
        if (grossContribution < 0) {
            grossContribution = 0;
        }

        const factor = 1 + (retainagePercent / 100);
        const amount = factor !== 0 ? grossContribution / factor : grossContribution;

        return this.computeValuesFromAmount(baseline, amount, retainagePercent);
    }

    /**
     * Method Name: applyComputedValues
     * @description: Applies calculated values back to the line item instance.
     */
    applyComputedValues(context, baseline, result, retainagePercent) {
        const { item } = context;
        item.rawThisBillingAmount = result.amount;
        item.thisBillingAmount = this.formatCurrency(result.amount);
        item.rawRetainageAmount = result.retainageValue;
        item.retainageAmount = this.formatCurrency(result.retainageValue);
        item.rawThisBillRetainageAmount = result.totalRetainage;
        item.thisBillRetainageAmount = this.formatCurrency(result.totalRetainage);
        item.rawTotalCompleteAmount = result.grossToDate;
        item.totalCompleteAmount = this.formatCurrency(result.grossToDate);
        item.rawThisBillingPercent = result.percent;
        item.thisBillingCompletePercent = result.percent;
        item.rawDueThisBilling = this.roundCurrency(result.amount - result.retainageValue);
        item.dueThisBilling = this.formatCurrency(item.rawDueThisBilling);
        item.baseRetainageBeforeCurrent = baseline.previousRetainage;

        if (retainagePercent != null) {
            item.rawRetainagePercent = retainagePercent;
            item.retainagePercent = this.formatPercent(retainagePercent);
        }
    }

    /**
     * Method Name: getCellElement
     * @description: Retrieves the table cell element for a record and field.
     */
    getCellElement(recordId, fieldName) {
        return this.template.querySelector(`td[data-record-id="${recordId}"][data-field-name="${fieldName}"]`);
    }

    /**
     * Method Name: markCellAsModified
     * @description: Applies modification tracking and styling for a specific field.
     */
    markCellAsModified(context, fieldName, newValue, cellElement) {
        const originalValue = this.getOriginalValue(context.item.Id, fieldName);
        const isModified = !this.areValuesEqual(newValue, originalValue);

        if (isModified) {
            this.trackModification(context.item.Id, fieldName, newValue);
            if (cellElement) {
                cellElement.classList.add('modified-cell');
            }
        } else {
            this.removeModification(context.item.Id, fieldName);
            if (cellElement) {
                cellElement.classList.remove('modified-cell');
            }
        }

        const className = isModified ? 'editable-cell modified-cell' : 'editable-cell';
        if (fieldName === 'This_Billing_Percent__c') {
            context.item.thisBillingPercentCellClass = className;
        } else if (fieldName === 'Retainage_Percent_on_Bill_Line_Item__c') {
            context.item.retainagePercentCellClass = className;
        } else if (fieldName === 'This_Billing_Value__c') {
            context.item.thisBillingAmountCellClass = className;
        }
    }

    /**
     * Method Name: roundCurrency
     * @description: Rounds a numeric value to currency precision (2 decimal places).
     */
    roundCurrency(value) {
        if (value == null || Number.isNaN(value) || !Number.isFinite(value)) {
            return 0;
        }
        return Math.round(value * 100) / 100;
    }

    /**
     * Method Name: roundPercent
     * @description: Rounds a numeric value to percentage precision (2 decimal places).
     */
    roundPercent(value) {
        if (value == null || Number.isNaN(value) || !Number.isFinite(value)) {
            return 0;
        }
        return Math.round(value * 100) / 100;
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
            if (fieldName === 'This_Billing_Percent__c') {
                return originalContractItem.rawThisBillingPercent;
            } else if (fieldName === 'This_Billing_Value__c') {
                return originalContractItem.rawThisBillingAmount;
            } else if (fieldName === 'Retainage_Percent_on_Bill_Line_Item__c') {
                return originalContractItem.rawRetainagePercent;
            }
        } else if (originalChangeOrderItem) {
            if (fieldName === 'This_Billing_Percent__c') {
                return originalChangeOrderItem.rawThisBillingPercent;
            } else if (fieldName === 'This_Billing_Value__c') {
                return originalChangeOrderItem.rawThisBillingAmount;
            } else if (fieldName === 'Retainage_Percent_on_Bill_Line_Item__c') {
                return originalChangeOrderItem.rawRetainagePercent;
            }
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
            if (fieldName === 'This_Billing_Percent__c') {
                contractItem.isEditingThisBillingPercent = isEditing;
            } else if (fieldName === 'This_Billing_Value__c') {
                contractItem.isEditingThisBillingAmount = isEditing;
            } else if (fieldName === 'Retainage_Percent_on_Bill_Line_Item__c') {
                contractItem.isEditingRetainagePercent = isEditing;
            }
            this.contractLineItems = [...this.contractLineItems];
        } else if (changeOrderItem) {
            if (fieldName === 'This_Billing_Percent__c') {
                changeOrderItem.isEditingThisBillingPercent = isEditing;
            } else if (fieldName === 'This_Billing_Value__c') {
                changeOrderItem.isEditingThisBillingAmount = isEditing;
            } else if (fieldName === 'Retainage_Percent_on_Bill_Line_Item__c') {
                changeOrderItem.isEditingRetainagePercent = isEditing;
            }
            this.changeOrderLineItems = [...this.changeOrderLineItems];
        }
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
            const existingModifications = this.modifiedContractItems.get(recordId) || {};
            existingModifications[fieldName] = newValue;
            this.modifiedContractItems.set(recordId, existingModifications);
            this.hasContractModifications = this.modifiedContractItems.size > 0;
        } else if (changeOrderItem) {
            const existingModifications = this.modifiedChangeOrderItems.get(recordId) || {};
            existingModifications[fieldName] = newValue;
            this.modifiedChangeOrderItems.set(recordId, existingModifications);
            this.hasChangeOrderModifications = this.modifiedChangeOrderItems.size > 0;
        }
    }

    /** 
     * Method Name: handleSaveLineItemChanges
     * @description: Saves line item changes to the server for both tables and refreshes data.
     */
    handleSaveLineItemChanges() {
        try {
            if (this.isBillingApproved) {
                this.showToast('Info', 'Billing is approved; line items are read-only.', 'info');
                return;
            }
            if (!this.hasAnyLineItemModifications) {
                return;
            }

            this.isSavingLineItems = true;
            this.isLoading = true;
            
            // Prepare line item updates
            const lineItemUpdates = [];
            for (let [recordId, modifications] of this.modifiedContractItems) {
                lineItemUpdates.push(this.buildLineItemUpdate(recordId, modifications));
            }
            for (let [recordId, modifications] of this.modifiedChangeOrderItems) {
                lineItemUpdates.push(this.buildLineItemUpdate(recordId, modifications));
            }

            if (lineItemUpdates.length === 0) {
                this.isSavingLineItems = false;
                this.isLoading = false;
                return;
            }

            saveBillingLineItems({
                billingId: this.recordId,
                lineItemUpdates: lineItemUpdates
            })
                .then(() => {
                    this.modifiedContractItems.clear();
                    this.hasContractModifications = false;
                    this.modifiedChangeOrderItems.clear();
                    this.hasChangeOrderModifications = false;
                    this.editingCells.clear();
                    this.clearModifiedStyling('contract');
                    this.clearModifiedStyling('changeorder');
                    this.showToast('Success', 'Line item changes saved successfully', 'success');
                    this.loadBillingData();
                })
                .catch(error => {
                    console.error('Error saving line item changes:', error);
                    this.showToast('Error', 'Failed to save line item changes', 'error');
                })
                .finally(() => {
                    this.isSavingLineItems = false;
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in handleSaveLineItemChanges:', error);
            this.showToast('Error', 'Failed to save line item changes', 'error');
            this.isSavingLineItems = false;
            this.isLoading = false;
        }
    }

    /** 
     * Method Name: handleDiscardLineItemChanges
     * @description: Discards line item changes for both tables and reverts to original values.
     */
    handleDiscardLineItemChanges() {
        this.modifiedChangeOrderItems.clear();
        this.hasChangeOrderModifications = false;
        this.modifiedContractItems.clear();
        this.hasContractModifications = false;
        this.editingCells.clear();
        this.clearModifiedStyling('contract');
        this.clearModifiedStyling('changeorder');
        this.loadBillingData();
        this.showToast('Success', 'Line item changes discarded', 'success');
    }

    buildLineItemUpdate(recordId, modifications) {
        const update = { Id: recordId };
        for (let [fieldName, value] of Object.entries(modifications)) {
            if (fieldName === 'This_Billing_Percent__c') {
                update['wfrecon__This_Billing_Percent__c'] = value;
            } else if (fieldName === 'This_Billing_Value__c') {
                update['wfrecon__This_Billing_Value__c'] = value;
            } else if (fieldName === 'Retainage_Percent_on_Bill_Line_Item__c') {
                update['wfrecon__Retainage_Percent_on_Bill_Line_Item__c'] = value;
            }
        }
        return update;
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
        if (value === null || value === undefined) return '0.00';
        return `${parseFloat(value).toFixed(2)}`;
    }

    openAIAForm(){
        // Replace 'MyVfPage' with your actual Visualforce page name
        // const vfPageUrl = '/apex/AIA702FormPage?id=' + this.recordId;

        // Opens in a new browser tab
        // window.open(vfPageUrl, '_blank');
        this.pdfTemplate = true;
    }

    handleClose() {
        this.pdfTemplate = false;
    }

    /** 
     * Method Name: navigateToRecord
     * @description: Navigates to the specified record page.
     */
    navigateToRecord(event) {
        const recordId = event.currentTarget.dataset.val;
        if (recordId) {
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: recordId,
                    actionName: 'view'
                }
            });
        }
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