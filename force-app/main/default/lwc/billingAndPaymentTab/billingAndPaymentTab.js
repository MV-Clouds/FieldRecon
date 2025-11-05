import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import BILLING_OBJECT from '@salesforce/schema/Billing__c';
import STATUS_FIELD from '@salesforce/schema/Billing__c.Status__c';
import getJobData from '@salesforce/apex/BillingAndPaymentTabController.getJobData';
import getBillingsData from '@salesforce/apex/BillingAndPaymentTabController.getBillingsData';
import getPaymentsData from '@salesforce/apex/BillingAndPaymentTabController.getPaymentsData';
import createBilling from '@salesforce/apex/BillingAndPaymentTabController.createBilling';
import deleteRecordApex from '@salesforce/apex/BillingAndPaymentTabController.deleteRecord';
import approveBillingRecord from '@salesforce/apex/BillingAndPaymentTabController.approveBilling';
import createPayment from '@salesforce/apex/BillingAndPaymentTabController.createPayment';
import cloneBillingRecord from '@salesforce/apex/BillingAndPaymentTabController.cloneBilling';
import checkPermissionSetsAssigned from '@salesforce/apex/PermissionsUtility.checkPermissionSetsAssigned';

export default class BillingAndPaymentTab extends NavigationMixin(LightningElement) {
    @api recordId;
    @track isFullAccess = false;
    @track accountId;
    @track isLoading = false;
    @track activeTab = 'billings';
    @track isBillCreatable = false;
    @track isPaymentCreatable = false;
    @track billingListRaw = [];
    @track filteredBillingList = [];
    @track paymentListRaw = [];
    @track filteredPaymentList = [];
    @track approvedBillingOptions = [];
    @track approvedBillingOptionsForNew = [];
    @track statusOptions = [];
    @track billingTypeOptions = [
        { label: 'Regular Bill', value: 'Regular Bill' },
        { label: 'Retainage Bill', value: 'Retainage Bill' }
    ];
    @track selectedStatus = 'All';
    @track searchTerm = '';
    @track jobDetailsMap = {
        jobName: '',
        jobNumber: '',
        jobRetainage: ''
    };
    @track newBill = {
        Start_Date__c: null,
        End_Date__c: null,
        prevBillId: null,
        billingType: 'Regular Bill'
    };
    @track newPayment = {
        Payment_Received_Date__c: null,
        Payment_Reference__c: null,
        billId: null
    }
    @track createNewBillModal = false;
    @track createNewPaymentModal = false;
    @track showConfirmModal = false;
    @track billId;
    @track paymentId;
    @track deleteRecordId;
    @track deleteSObjectApiName;
    @track popupProperties = {
        heading: '',
        body: '',
        buttonLabel: '',
        action: ''
    }

    @track billingsColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { label: 'Actions', fieldName: 'actions', style: 'width: 12rem' },
        { 
            label: 'Bill Number', 
            fieldName: 'Name',
            isLink: true,
            recordIdField: 'Id', 
            style: 'width: 10rem'
        },
        { 
            label: 'Previous Billing', 
            fieldName: 'wfrecon__Previous_Bill__r.Name',
            isLink: true,
            recordIdField: 'wfrecon__Previous_Bill__c', 
            style: 'width: 12rem'
        },
        { label: 'Status', fieldName: 'wfrecon__Status__c', style: 'width: 15rem' },
        { label: 'Bill Type', fieldName: 'wfrecon__Bill_Type__c', style: 'width: 10rem' },
        { label: 'Bill Reference Number', fieldName: 'wfrecon__Billing_Reference_Number__c', style: 'width: 15rem' },
        { label: 'Bill Amount', fieldName: 'wfrecon__Current_Payment_Due_FM__c', style: 'width: 15rem' },
        { label: 'Start Date', fieldName: 'wfrecon__Start_Date__c', style: 'width: 10rem' },
        { label: 'End Date', fieldName: 'wfrecon__End_Date__c', style: 'width: 10rem' },
        { label: 'Sent Date', fieldName: 'wfrecon__Sent_Date__c', style: 'width: 10rem' }
    ];

    @track paymentsColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { label: 'Actions', fieldName: 'actions', style: 'width: 10rem' },
        { 
            label: 'Payment Number', 
            fieldName: 'Name',
            isLink: true,
            recordIdField: 'Id', 
            style: 'width: 10rem'
        },
        { label: 'Payment Reference Number', fieldName: 'wfrecon__Payment_Reference__c', style: 'width: 15rem' },
        { label: 'Payable Amount Received', fieldName: 'wfrecon__Payable_Amount_Received__c', style: 'width: 15rem' },
        { label: 'Payment Received Date', fieldName: 'wfrecon__Payment_Received_Date__c', style: 'width: 15rem' }
    ];

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
                ...data.values.map(item => ({
                    label: item.label,
                    value: item.value
                }))
            ];
        } else if (error) {
            console.error('Error fetching picklist values:', error);
        }
    }

    get isBillingsTabActive(){
        return this.activeTab === 'billings';
    }
    
    get isPaymentsTabActive(){
        return this.activeTab === 'payments';
    }

    get billingsTabClass() {
        return this.activeTab === 'billings' ? 'active' : '';
    }
    
    get paymentsTabClass() {
        return this.activeTab === 'payments' ? 'active' : '';
    }

    /** 
     * Method Name: billDetails
     * @description: Getter that transforms filtered billing list into a table-friendly structure.
     */
    get billDetails() {
        try {
            if (!this.filteredBillingList) {
                return [];
            }

            let visibleColumns = this.billingsColumns.filter(col => {
                if (col.fieldName === 'wfrecon__Billing_Reference_Number__c') {
                    return this.selectedStatus === 'Approved' || this.selectedStatus === 'All';
                }
                return true;
            });

            return this.filteredBillingList.map((bill, index) => {
                // determine if approve should be disabled for this billing
                const isApproved = bill.wfrecon__Status__c ? String(bill.wfrecon__Status__c).trim().toLowerCase() === 'approved' : false;

                return {
                    key: bill.Id,
                    billId: bill.Id,
                    disableApprove: isApproved,
                    values: visibleColumns.map(col => {
                        let cell = {
                            key: col.fieldName,
                            value: '',
                            recordLink: null,
                            isActions: false,
                            style: col.style
                        };

                        if (col.fieldName === 'srNo') {
                            cell.value = index + 1;
                        } else if (col.fieldName === 'actions') {
                            cell.isActions = true;
                        } else if (col.fieldName.includes('.')) {
                            let parts = col.fieldName.split('.');
                            let value = bill;
                            parts.forEach(p => value = value ? value[p] : null);
                            cell.value = value || '';
                        } else if (col.fieldName === 'wfrecon__Previous_Bill__c') {
                            // Handle Previous Billing field specially
                            if (bill.wfrecon__Previous_Bill__c) {
                                // Try to get the name from the relationship field, fall back to a generic name
                                if (bill.wfrecon__Previous_Bill__r && bill.wfrecon__Previous_Bill__r.Name) {
                                    cell.value = bill.wfrecon__Previous_Bill__r.Name;
                                } else {
                                    // If no relationship data, create a display name from the ID
                                    cell.value = `Previous Bill (${bill.wfrecon__Previous_Bill__c.substring(0, 8)}...)`;
                                }
                                if (col.isLink) {
                                    cell.recordLink = `/${bill.wfrecon__Previous_Bill__c}`;
                                }
                            } else {
                                cell.value = '--';
                            }
                        } else {
                            cell.value = bill[col.fieldName] || '';
                            if (col.isLink && col.recordIdField) {
                                cell.recordLink = `/${bill[col.recordIdField]}`;
                            }
                        }

                        if (['wfrecon__Start_Date__c', 'wfrecon__End_Date__c', 'wfrecon__Sent_Date__c'].includes(col.fieldName)) {
                            cell.value = cell.value.slice(0, 16).replace('T', ' ');
                        }

                        if(col.fieldName === 'wfrecon__Current_Payment_Due_FM__c') {
                            if(bill.wfrecon__Bill_Type__c === 'Retainage') {
                                cell.value = bill.wfrecon__Retainage_Completed_to_Date__c || '';
                            } else {
                                cell.value = bill.wfrecon__Current_Payment_Due_FM__c || '';
                            }
                            if(cell.value != '') {
                                cell.value = '$' + cell.value
                            } else {
                                cell.value = '$0.00';
                            }
                        }

                        if (!cell.value && cell.value !== 0) {
                            cell.value = '--';
                        }

                        return cell;
                    })
                };
            });
        } catch (error) {
            console.error('Error in billDetails ::', error);
        }
    }

    get visibleBillingsColumns() {
        return this.billingsColumns.filter(col => {
            if (col.fieldName === 'wfrecon__Billing_Reference_Number__c') {
                return this.selectedStatus === 'Approved' || this.selectedStatus === 'All';
            }
            return true;
        });
    }

    /** 
     * Method Name: paymentDetails
     * @description: Getter that transforms filtered payment list into a table-friendly structure.
     */
    get paymentDetails() {
        try {
            if (!this.filteredPaymentList) {
                return [];
            }

            return this.filteredPaymentList.map((payment, index) => {
                return {
                    key: payment.Id,
                    paymentId: payment.Id,
                    values: this.paymentsColumns.map(col => {
                        let cell = { 
                            key: col.fieldName, 
                            value: '', 
                            recordLink: null, 
                            isActions: false, 
                            style: col.style 
                        };

                        if (col.fieldName === 'srNo') {
                            cell.value = index + 1;
                        } else if (col.fieldName === 'actions') {
                            cell.isActions = true; 
                        } else if (col.fieldName.includes('.')) {
                            let parts = col.fieldName.split('.');
                            let value = payment;
                            parts.forEach(p => value = value ? value[p] : null);
                            cell.value = value || '';
                        } else {
                            cell.value = payment[col.fieldName] || '';
                            if (col.isLink && col.recordIdField) {
                                cell.recordLink = `/${payment[col.recordIdField]}`;
                            }
                        }

                        if(col.fieldName === 'wfrecon__Payable_Amount_Received__c') {
                            if(cell.value != '') {
                                cell.value = '$' + cell.value
                            } else {
                                cell.value = '$0.00';
                            }
                        }

                        if (col.fieldName === 'wfrecon__Payment_Received_Date__c') {
                            cell.value = cell.value.slice(0, 16).replace('T', ' ');
                        }

                        if (!cell.value && cell.value !== 0) {
                            cell.value = '--';
                        }

                        return cell;
                    })
                };
            });
        } catch (error) {
            console.error('Error in paymentDetails ::', error);
        }
    }

    /** 
     * Method Name: connectedCallback
     * @description: LWC lifecycle hook to initialize loading, job details and billing data.
     */
    connectedCallback() {
        try {
            this.isLoading = true;
            this.checkUserPermissions();
        } catch (error) {
            console.error('Error in connectedCallback:', error);
            this.isLoading = false;
        }
    }

    /** 
     * Method Name: checkUserPermissions
     * @description: Checks user permissions based on permission sets.
     */
    checkUserPermissions() {
        try {
            this.isLoading = true;
            const permissionSetsToCheck = ['FR_Finance'];

            checkPermissionSetsAssigned({ psNames: permissionSetsToCheck })
                .then(result => {
                    if (result.error) {
                        console.error('Error checking permission sets:', result.error);
                        this.setDefaultPermissions();
                        return;
                    }

                    console.log('Permission check result ==> ', result);
                    
                    const assignedMap = result.assignedMap || {};
                    const isAdmin = result.isAdmin || false;
                    const hasFRFinance = assignedMap['FR_Finance'] || false;
                    console.log('User permissions ==> ', { isAdmin, hasFRFinance });
                    
                    if (isAdmin || hasFRFinance) {
                        // Admin or FR_Finance → Full access
                        this.isFullAccess = true;
                        this.loadJobData();
                        this.loadBillingData();
                    } else {
                        // No specific permissions - no access
                        this.setDefaultPermissions();
                    }
                })
                .catch(error => {
                    console.error('Error in checkUserPermissions:', error);
                    this.setDefaultPermissions();
                })
                .finally(() => {
                    this.isLoading = false;
                });
        }
        catch (error) {
            console.error('Error in outer block:', error);
            this.setDefaultPermissions();
            this.isLoading = false;
        }
    }

    /** 
     * Method Name: setDefaultPermissions
     * @description: Sets default permissions (no access)
     */
    setDefaultPermissions() {
        this.isFullAccess = false;
    }

    /** 
     * Method Name: loadJobData
     * @description: Loads job data including job name, number, and retainage information.
     */
    loadJobData() {
        try {
            getJobData({ jobId: this.recordId })
                .then((res) => {
                    console.log('getJobData apex res :: ', res);
                    
                    if (res && res.length > 0) {
                        const job = res[0];
                        this.jobDetailsMap = {
                            jobName: job.wfrecon__Job_Name__c || '--',
                            jobNumber: job.Name || '',
                            jobRetainage: job?.wfrecon__Retainage__c || '0.00%'
                        };
                        this.accountId = job?.wfrecon__Account__c || null;
                    }
                })
                .catch((e) => {
                    console.error('Error in getJobData :: ', e);
                    this.showToast('Error', 'Failed to load job data. Please contact system admin.', 'error');
                });
        } catch (error) {
            console.error('Error in loadJobData :: ', error);
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
        }
    }

    /** 
     * Method Name: loadBillingData
     * @description: Calls Apex to fetch billing records for the job and stores filtered/raw lists.
     */
    loadBillingData() {
        try {
            this.isLoading = true;
            getBillingsData({jobId: this.recordId})
                .then((result) => {
                    console.log('getBillingsData apex result :: ', result);
                    if(result && result.hasApprovedScopeEntries == true) {
                        this.isBillCreatable = true;
                        this.billingListRaw = result.billings;
                        this.filteredBillingList = result.billings;
                        
                        // Prepare approved billing options for new billing creation
                        this.approvedBillingOptionsForNew = [
                            { label: 'None', value: null }
                        ];
                        if (result.billings && result.billings.length > 0) {
                            const approvedBillings = result.billings.filter(bill => 
                                bill.wfrecon__Status__c === 'Approved'
                            );
                            approvedBillings.forEach(bill => {
                                this.approvedBillingOptionsForNew.push({
                                    label: bill.Name,
                                    value: bill.Id
                                });
                            });
                        }
                    } else if(result && result.hasApprovedScopeEntries == false) {
                        this.isBillCreatable = false;
                        this.billingListRaw = [];
                        this.filteredBillingList = [];
                        this.approvedBillingOptionsForNew = [{ label: 'None', value: null }];
                    } else {
                        this.billingListRaw = [];
                        this.filteredBillingList = [];
                        this.approvedBillingOptionsForNew = [{ label: 'None', value: null }];
                        this.isBillCreatable = false;
                        this.showToast('Error', 'Failed to load billing data. Please contact system admin.', 'error');
                    }
                })
                .catch((error) => {
                    console.error('Error in getBillingsData :: ', error);
                    this.showToast('Error', 'Failed to load billing data. Please contact system admin.', 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in loadBillingData :: ', error);
            this.isLoading = false;
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
        }
    }

    /** 
     * Method Name: handleBillingsTab
     * @description: Activates the Billings tab and reloads billing data.
     */
    handleBillingsTab() {
        try {
            this.activeTab = 'billings';
            this.loadBillingData();
        } catch (error) {
            console.error('Error in handleBillingsTab :: ', error);
        }
    }

    /** 
     * Method Name: handleSearch
     * @description: Handles search input and triggers filtering for billings or payments.
     */
    handleSearch(event) {
        try {
            let recordType = event.target.dataset.field;
            this.searchTerm = event.target.value ? event.target.value.toLowerCase() : '';
    
            if(recordType == 'billing') {
                this.filterBills();
            } else if (recordType == 'payment') {
                this.filterPayments();
            }
        } catch (error) {
            console.error('Error in handleSearch :: ', error);
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
        }
    }

    /** 
     * Method Name: handleStatusChange
     * @description: Updates selected status and re-filters billing list.
     */
    handleStatusChange(event) {
        try {
            this.selectedStatus = event.detail.value;
            this.filterBills();
        } catch (error) {
            console.error('Error in handleStatusChange :: ', error);
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
        }
    }

    /** 
     * Method Name: filterBills
     * @description: Filters billing records based on search term and selected status.
     */
    filterBills() {
        try {
            const search = this.searchTerm;
            const status = this.selectedStatus;
    
            this.filteredBillingList = this.billingListRaw.filter(bill => {
                const billName = bill.Name ? bill.Name.toLowerCase() : '';
                const billRef = bill.wfrecon__Billing_Reference_Number__c ? bill.wfrecon__Billing_Reference_Number__c.toLowerCase() : '';
                const dateFields = [
                    bill.wfrecon__Start_Date__c,
                    bill.wfrecon__End_Date__c,
                    bill.wfrecon__Sent_Date__c
                ].filter(Boolean).map(d => d.toLowerCase());
                const billStatus = bill.wfrecon__Status__c || ''; // assuming this is your field
    
                // Match search term
                let matchesSearch = true;

                if (search) {
                    matchesSearch = billName.includes(search) || billRef.includes(search) || dateFields.some(dateStr => dateStr.includes(search));
                }

                // --- Status Matching ---
                const matchesStatus = (status === 'All') || billStatus === status;

                return matchesSearch && matchesStatus;
            });
        } catch (error) {
            console.error('Error in filterBills ::', error);
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
        }
    }

    /** 
     * Method Name: handleActionClick
     * @description: Handles row action clicks for edit/delete/approve/clone on billing and payment records.
     */
    handleActionClick(event) {
        try {
            const recordId = event.currentTarget.dataset.id;
            const actionType = event.currentTarget.dataset.action;
            
            if (actionType === 'deleteBilling') {
                this.deleteRecordId = recordId;
                this.deleteSObjectApiName = 'Billing__c';
                this.showConfirmModal = true;
                this.popupProperties = {
                    heading: 'Confirm Deletion',
                    body: 'Are you sure you want to delete this billing record? This action cannot be undone.',
                    buttonLabel: 'Confirm Delete',
                    action: 'deleteBilling'
                };
            } else if (actionType === 'deletePayment') {
                this.deleteRecordId = recordId;
                this.deleteSObjectApiName = 'Payment__c';
                this.showConfirmModal = true;
                this.popupProperties = {
                    heading: 'Confirm Deletion',
                    body: 'Are you sure you want to delete this payment record? This action cannot be undone.',
                    buttonLabel: 'Confirm Delete',
                    action: 'deletePayment'
                };
            } else if (actionType === 'approveBilling') {
                this.billId = recordId;
                this.showConfirmModal = true;
                this.popupProperties = {
                    heading: 'Approve Billing',
                    body: 'Are you sure you want to approve this billing record?',
                    buttonLabel: 'Approve',
                    action: 'approveBilling'
                };
            } else if (actionType === 'cloneBilling') {
                this.billId = recordId;
                this.showConfirmModal = true;
                this.popupProperties = {
                    heading: 'Clone Billing',
                    body: 'Are you sure you want to clone this billing record? A new billing record with all its line items will be created in Draft status.',
                    buttonLabel: 'Clone',
                    action: 'cloneBilling'
                };
            }
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleActionClick ::', error);
        }
    }

    /** 
     * Method Name: closeConfirmModal
     * @description: Closes the confirmation modal.
     */
    closeConfirmModal(){
        this.showConfirmModal = false;
        this.deleteRecordId = null;
        this.deleteSObjectApiName = null;
        this.billId = null;
        this.popupProperties = {
            heading: '',
            body: '',
            buttonLabel: '',
            action: ''
        };
    }

    /** 
     * Method Name: handleConfirmClick
     * @description: Handles confirm button click in the confirmation modal for dynamic actions.
     */
    handleConfirmClick(){
        try {
            if(this.popupProperties.action === 'deleteBilling' || this.popupProperties.action === 'deletePayment'){
                this.handleDeleteRecord();
            } else if(this.popupProperties.action === 'approveBilling'){
                this.handleApproveBilling();
            } else if(this.popupProperties.action === 'cloneBilling'){
                this.handleCloneBilling();
            }
        } catch (error) {
            console.error('Error in handleConfirmClick :: ', error);
        }
    }

    /** 
     * Method Name: handleApproveBilling
     * @description: Placeholder method for handling approve billing action.
     */
    handleApproveBilling() {
        try {
            const bill = this.billDetails.find(b => b.billId === this.billId);
            if (!bill) {
                console.error('Bill not found with id:', this.billId);
                return;
            }

            const startDate = bill.values.find(v => v.key === 'wfrecon__Start_Date__c')?.value;
            const endDate = bill.values.find(v => v.key === 'wfrecon__End_Date__c')?.value;

            // Check if dates are valid
            if (!startDate || startDate === '--' || !endDate || endDate === '--') {
                this.showToast('Error', 'Please fill both Start and End dates before approving.', 'error');
                return; // Stop further execution
            }

            this.isLoading = true;
            approveBillingRecord({ billingId: this.billId })
                .then((result) => {
                    if(result === 'SUCCESS') {
                        this.showToast('Success', 'Billing approved successfully', 'success');
                        this.closeConfirmModal();
                        this.loadBillingData();
                        this.popupProperties = {
                            heading: '',
                            body: '',
                            buttonLabel: '',
                            action: ''
                        };
                        this.billId = null;
                    } else {
                        const message = result || 'Failed to approve billing. Please contact system admin.';
                        this.showToast('Error', message, 'error');
                    }
                })
                .catch((error) => {
                    console.error('Error approving billing:', error);
                    let message = 'Failed to approve billing. Please contact system admin.';
                    if (error && error.body && error.body.message) {
                        message = error.body.message;
                    } else if (error && error.message) {
                        message = error.message;
                    }
                    this.showToast('Error', message, 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in handleApproveBilling ::', error);
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            this.isLoading = false;
        }
    }

    /** 
     * Method Name: handleCloneBilling
     * @description: Clones the billing record along with its billing line items.
     */
    handleCloneBilling() {
        try {
            this.isLoading = true;
                        
            cloneBillingRecord({ billingId: this.billId })
                .then((result) => {
                    console.log('cloneBilling apex result :: ', result);
                    
                    if (result === 'SUCCESS') {
                        this.showToast('Success', 'Billing record cloned successfully', 'success');
                        this.loadBillingData();
                    } else {
                        this.showToast('Error', result, 'error');
                    }
                })
                .catch((error) => {
                    console.error('Error in cloneBilling :: ', error);
                    let message = 'An unexpected error occurred';
                    if (error && error.body && error.body.message) {
                        message = error.body.message;
                    } else if (error && error.message) {
                        message = error.message;
                    }
                    this.showToast('Error', message, 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                    this.closeConfirmModal();
                });
        } catch (error) {
            console.error('Error in handleCloneBilling ::', error);
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            this.isLoading = false;
        }
    }

    /** 
     * Method Name: handlePaymentsTab
     * @description: Activates the Payments tab and loads payment data.
     */
    handlePaymentsTab() {
        try {
            this.activeTab = 'payments';
            this.loadPaymentData();
        } catch (error) {
            console.error('Error in handlePaymentsTab :: ', error);
        }
    }

    /** 
     * Method Name: loadPaymentData
     * @description: Calls Apex to fetch payment records for the job and stores filtered/raw lists.
     */
    loadPaymentData() {
        try {
            this.isLoading = true;
            getPaymentsData({jobId: this.recordId})
                .then((result) => {
                    console.log('getPaymentsData apex result :: ', result);
                    this.paymentListRaw = result;
                    this.filteredPaymentList = result;

                    if(result && result.hasApprovedBillings == true) {
                        this.isPaymentCreatable = true;
                        this.paymentListRaw = result.payments;
                        this.filteredPaymentList = result.payments;
                        this.approvedBillingOptions = result.approvedBillings.map(bill => ({
                            label: bill.Name,
                            value: bill.Id
                        }));
                    } else if(result && result.hasApprovedBillings == false) {
                        this.isPaymentCreatable = false;
                        this.paymentListRaw = [];
                        this.filteredPaymentList = [];
                    } else {
                        this.paymentListRaw = [];
                        this.filteredPaymentList = [];
                        this.isPaymentCreatable = false;
                        this.showToast('Error', 'Failed to load payment data. Please contact system admin.', 'error');
                    }
                })
                .catch((error) => {
                    console.error('Error in getPaymentsData :: ', error);
                    this.showToast('Error', 'Failed to load payment data. Please contact system admin.', 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in loadPaymentData :: ', error);
            this.isLoading = false;
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
        }
    }

    /** 
     * Method Name: filterPayments
     * @description: Filters payment records based on the search term.
     */
    filterPayments() {
        try {
            const search = this.searchTerm;
    
            this.filteredPaymentList = this.paymentListRaw.filter(pay => {
                const payName = pay.Name ? pay.Name.toLowerCase() : '';
                const payRef = pay.wfrecon__Payment_Reference__c ? pay.wfrecon__Payment_Reference__c.toLowerCase() : '';
                const dateFields = [
                    pay.wfrecon__Payment_Received_Date__c
                ].filter(Boolean).map(d => d.toLowerCase());
    
                // Match search term
                let matchesSearch = true;

                if (search) {
                    matchesSearch = payName.includes(search) || payName.includes(search) || dateFields.some(dateStr => dateStr.includes(search));
                }

                return matchesSearch;
            });
        } catch (error) {
            console.error('Error in filterPayments ::', error);
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
        }
    }

    /** 
    * Method Name: handleLinkClick 
    * @description: Method is used to handle the link click
    */
    handleLinkClick(event) {
        try {
            const linkData = event.currentTarget.dataset.link;
            if (linkData) {
                // Extract record ID from link path (remove leading slash)
                const recordId = linkData.startsWith('/') ? linkData.substring(1) : linkData;
                this[NavigationMixin.Navigate]({
                    type: 'standard__recordPage',
                    attributes: {
                        recordId: recordId,
                        actionName: 'view',
                    },
                });
            }
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleLinkClick ::', error);
        }
    }

    /** 
     * Method Name: handleCreateBilling
     * @description: Opens the modal to create a new billing record.
     */
    handleCreateBilling() {
        try {
            this.createNewBillModal = true;
            const today = new Date();

            // First day of current month
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            // Last day of current month
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

            // Format as YYYY-MM-DD (for <input type="date">)
            const formatDate = date => {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
                const dd = String(date.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };

            this.newBill = {
                Start_Date__c: formatDate(firstDay),
                End_Date__c: formatDate(lastDay),
                prevBillId: null,
                billingType: 'Regular Bill'
            };
        } catch (error) {
            console.error('Error in handleCreateBilling :: ', error);
        }
    }

    /**
     * Method Name: handleNewBillChange
     * @description: Handles input change for new bill form fields.
     */
    handleNewBillChange(event) {
        const { name, value } = event.target;
        this.newBill = { ...this.newBill, [name]: value };
    }

    /**
     * Method Name: handleSaveNewBill
     * @description: Creates Billing__c record and closes popup with toast.
     */
    handleSaveNewBill() {
        try {
            this.isLoading = true;
            console.log('Creating billing with data: ', this.newBill);
            
            createBilling({ 
                jobId: this.recordId, 
                startDate: this.newBill.Start_Date__c || null, 
                endDate: this.newBill.End_Date__c || null, 
                billingType: this.newBill.billingType || 'Regular Bill',
                prevBill: this.newBill.prevBillId || null
            })
                .then((result) => {
                    if(result == 'SUCCESS') {
                        this.showToast('Success', 'Billing record created successfully.', 'success');
                        this.closeNewBillModal();
                        this.loadBillingData();
                    } else {
                        this.showToast('Error', result, 'error');
                    }
                })
                .catch((error) => {
                    console.error('Error in createBilling :: ', error);
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in handleSaveNewBill :: ', error);
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            this.isLoading = false;
        }
    }

    /** 
     * Method Name: closeNewBillModal
     * @description: Closes the create new billing modal.
     */
    closeNewBillModal() {
        this.createNewBillModal = false;
        this.newBill = {
            Start_Date__c: null,
            End_Date__c: null,
            prevBillId: null,
            billingType: 'Regular Bill'
        };
    }

    /** 
     * Method Name: handleReceivePayment
     * @description: Placeholder for handling receive payment action.
     */
    handleReceivePayment() {
        this.createNewPaymentModal = true;
    }

    /** 
     * Method Name: closeNewPaymentModal
     * @description: Closes the new payment modal and resets the payment form data.
     */
    closeNewPaymentModal() {
        this.createNewPaymentModal = false;
        this.newPayment = {
            Payment_Received_Date__c: null,
            Payment_Reference__c: null,
            billId: null
        };
    }

    /** 
     * Method Name: handleDeleteRecord
     * @description: Deletes a billing or payment record via Apex and refreshes the appropriate data.
     */
    handleDeleteRecord() {
        try {
            if(!this.deleteRecordId || !this.deleteSObjectApiName){
                this.showToast('Error', 'Missing record information to delete.', 'error');
                return;
            }
    
            this.isLoading = true;
            deleteRecordApex({ recordId: this.deleteRecordId, sObjectApiName: this.deleteSObjectApiName })
                .then((result) => {
                    if(result =='SUCCESS') {
                        this.showToast('Success', 'Record deleted successfully.', 'success');
        
                        if (this.activeTab === 'billings') {
                            this.loadBillingData();
                        } else if (this.activeTab === 'payments') {
                            this.loadPaymentData();
                        }
                        this.closeConfirmModal();
                        this.popupProperties = {
                            heading: '',
                            body: '',
                            buttonLabel: '',
                            action: ''
                        };
                        this.billId = null;
                    } else {
                        this.showToast('Error', 'Failed to delete record. Please contact system admin.', 'error');
                    }
                })
                .catch((error) => {
                    console.error('Error deleting record :: ', error);
                    this.showToast('Error', 'Failed to delete record. Please contact system admin.', 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in handleDeleteRecord :: ', error);
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            this.isLoading = false;
        }
    }

    /** 
     * Method Name: handleNewPaymentChange
     * @description: Handles input changes for new payment form fields.
     */
    handleNewPaymentChange(event) {
        const { name, value } = event.target;
        this.newPayment = { ...this.newPayment, [name]: value }; 
    }
    
    /** 
     * Method Name: handleSaveNewPayment
     * @description: Creates a new payment record via Apex and handles the response.
     */
    handleSaveNewPayment() {
        try {
            if(this.newPayment.billId == null) {
                this.showToast('Error', 'Please select a billing for the payment.', 'error');
                return;
            }

            const dateInput = this.template.querySelector('.payment-date-input');
            
            dateInput.reportValidity();
            if (!dateInput.checkValidity()) {
                this.showToast('Error', 'Please enter a valid date.', 'error');
                return;
            }
            console.log(this.newPayment);

            this.isLoading = true;
            createPayment({ jobId: this.recordId, billId: this.newPayment.billId, accountId: this.accountId, paymentReceivedDate: this.newPayment.Payment_Received_Date__c || null, paymentReference: this.newPayment.Payment_Reference__c || null })
                .then((result) => {
                    if (result === 'SUCCESS') {
                        this.showToast('Success', 'Payment created successfully.', 'success');
                        this.closeNewPaymentModal();
                        this.loadPaymentData();
                    } else {
                        this.showToast('Error', 'Failed to create payment. Please contact system admin.', 'error');
                    }
                })
                .catch((error) => {
                    console.error('Error in createPayment :: ', error);
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in handleSaveNewPayment :: ', error);
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            this.isLoading = false;
        }
    }

    /**
     * Method Name: showToast
     * @description: Helper method to display toast messages
     */
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
}