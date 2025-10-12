import { LightningElement, api, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import BILLING_OBJECT from '@salesforce/schema/Billing__c';
import STATUS_FIELD from '@salesforce/schema/Billing__c.Status__c';
import getJobData from '@salesforce/apex/BillingAndPaymentTabController.getJobData';
import getBillingsData from '@salesforce/apex/BillingAndPaymentTabController.getBillingsData';
import getPaymentsData from '@salesforce/apex/BillingAndPaymentTabController.getPaymentsData';

export default class BillingAndPaymentTab extends NavigationMixin(LightningElement) {
    @api recordId;
    @track isLoading = false;
    @track activeTab = 'billings';
    @track billingListRaw = [];
    @track filteredBillingList = [];
    @track paymentListRaw = [];
    @track filteredPaymentList = [];
    @track statusOptions = [];
    @track selectedStatus = 'All';
    @track searchTerm = '';
    @track jobDetailsMap = {
        'jobName': '',
        'jobNumber': '',
        'jobRetainage': ''
    };
    @track createNewBillModal = false;
    @track showDeleteConfirmModal = false;
    @track actionRecord;
    @track billId;
    @track paymentId;

    @track billingsColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { label: 'Actions', fieldName: 'actions', style: 'width: 10rem' },
        { 
            label: 'Bill Number', 
            fieldName: 'Name',
            isLink: true,
            recordIdField: 'Id', 
            style: 'width: 10rem'
        },
        { label: 'Status', fieldName: 'wfrecon__Status__c', style: 'width: 15rem' },
        { label: 'Bill Reference Number', fieldName: 'wfrecon__Billing_Reference_Number__c', style: 'width: 15rem' },
        { label: 'Bill Amount', fieldName: 'wfrecon__Amount__c', style: 'width: 15rem' },
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

    get billDetails() {
        try {
            if (!this.filteredBillingList) {
                return [];
            }

            return this.filteredBillingList.map((bill, index) => {
                return {
                    key: bill.Id,
                    billId: bill.Id,
                    values: this.billingsColumns.map(col => {
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
                        } else {
                            cell.value = bill[col.fieldName] || '';
                            if (col.isLink && col.recordIdField) {
                                cell.recordLink = `/${bill[col.recordIdField]}`;
                            }
                        }

                        if (['wfrecon__Start_Date__c', 'wfrecon__End_Date__c', 'wfrecon__Sent_Date__c'].includes(col.fieldName)) {
                            cell.value = cell.value.slice(0, 16).replace('T', ' ');
                        }

                        if(col.fieldName === 'wfrecon__Amount__c') {
                            cell.value = '$' + cell.value
                        }

                        return cell;
                    })
                };
            });
        } catch (error) {
            console.error('Error in billDetails ::', error);
        }
    }

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

                        if (col.fieldName === 'wfrecon__Payment_Received_Date__c') {
                            cell.value = cell.value.slice(0, 16).replace('T', ' ');
                        }

                        return cell;
                    })
                };
            });
        } catch (error) {
            console.error('Error in paymentDetails ::', error);
        }
    }

    connectedCallback() {
        this.isLoading = true;
        console.log(this.recordId);
        this.loadJobDetails();
        this.loadBillingData();
    }

    loadJobDetails(){
        try {
            getJobData({jobId: this.recordId})
                .then((result) => {
                    console.log(result);
                    this.jobDetailsMap = {
                        'jobNumber': result[0].Name,
                        'jobName': result[0].wfrecon__Job_Name__c,
                        'jobRetainage': result[0]?.wfrecon__Retainage__c || '0.00%'
                    };
                })
                .catch((error) => {
                    console.error('Error in loadJobDetails :: ', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in loadJobDetails ::', error);
        }
    }

    loadBillingData() {
        try {
            this.isLoading = true;
            getBillingsData({jobId: this.recordId})
                .then((result) => {
                    console.log(result);
                    this.billingListRaw = result;
                    this.filteredBillingList = result;
                })
                .catch((error) => {
                    console.error('Error in getBillingsData :: ', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in loadBillingData :: ', error);
        }
    }

    handleBillingsTab() {
        this.activeTab = 'billings';
        this.loadBillingData();
    }

    handleSearch(event) {
        let recordType = event.target.dataset.field;
        this.searchTerm = event.target.value ? event.target.value.toLowerCase() : '';

        if(recordType == 'billing') {
            this.filterBills();
        } else if (recordType == 'payment') {
            this.filterPayments();
        }
    }

    handleStatusChange(event) {
        this.selectedStatus = event.detail.value;
        this.filterBills();
    }

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

    handleActionClick(event) {
        try {
            const recordId = event.currentTarget.dataset.id;
            const actionType = event.currentTarget.dataset.action;
            
            if (actionType === 'editBilling') {
                this.billId = recordId;
                this.actionRecord = 'Billing';
            } else if (actionType === 'deleteBilling') {
                this.billId = recordId;
                this.actionRecord = 'Billing';
                this.showDeleteConfirmModal = true;
            } else if (actionType === 'editPayment') {
                this.paymentId = recordId;
                this.actionRecord = 'Payment';
            } else if (actionType === 'deletePayment') {
                this.paymentId = recordId;
                this.actionRecord = 'Payment';
                this.showDeleteConfirmModal = true;
            }
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleActionClick ::', error);
        }
    }

    handlePaymentsTab() {
        this.activeTab = 'payments';
        this.loadPaymentData();
    }

    loadPaymentData() {
        try {
            this.isLoading = true;
            getPaymentsData({jobId: this.recordId})
                .then((result) => {
                    this.paymentListRaw = result;
                    this.filteredPaymentList = result;
                    console.log(result);
                })
                .catch((error) => {
                    console.error('Error in getPaymentsData :: ', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in loadPaymentData :: ', error);
        }
    }

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
            const recordId = event.currentTarget.dataset.link;
            if (recordId) {
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

    handleCreateBilling() {
        this.createNewBillModal = true;
    }

    closeNewBillModal() {
        this.createNewBillModal = false;
    }

    closeDeleteConfirmModal(){
        this.showDeleteConfirmModal = false;
    }

    handleDeleteConfirm(){
        if(this.actionRecord === 'Billing'){

        } else if(this.actionRecord === 'Payment'){

        }
    }

    handleReceivePayment() {
        
    }
}