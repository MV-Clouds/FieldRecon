import { LightningElement, track,wire,api} from 'lwc';
import getExpenseData  from '@salesforce/apex/ExpenseReportController.getExpenseData';
import getNamepaceWithUnderscore from '@salesforce/apex/Lib_Base_Controller.getNamespace';
import EXPENSE_OBJECT from '@salesforce/schema/Expense__c';
import EXPENSE_TYPE_FIELD from '@salesforce/schema/Expense__c.Expense_Type__c';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import updateExpenseData from '@salesforce/apex/ExpenseReportController.updateExpenseData';
import getContents from '@salesforce/apex/GalleryController.getContents';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { jsonToCSV, downloadCSV } from "c/csvUtils";
import { NavigationMixin } from "lightning/navigation";
import {loadScript,loadStyle} from "lightning/platformResourceLoader";
/*import JSPDF from "@salesforce/resourceUrl/jsPdf";
import html2canvas from "@salesforce/resourceUrl/html2Canvas";
import html2canvasmin from "@salesforce/resourceUrl/html2CanvasMin";
import jQueryMinJS from "@salesforce/resourceUrl/jQueryMin";*/
import printMedia from "@salesforce/resourceUrl/printMedia";

const CSV_COLUMNS = [
    { label: "", fieldName: "groupTitle" },
    { label: "Member Name", fieldName: "memberName" },
    { label: "Job Name", fieldName: "jobName" },
    { label: "Expense Type", fieldName: "expenseType" },
    { label: "Amount", fieldName: "amount" },
    { label : "Status",fieldName : "status"}
  ];

export default class ExpenseReport extends NavigationMixin(LightningElement) {
    dateSelected = 'daily';
    namespaceRejectionField='';
    namespaceObject='';
    namespaceStatus='';
    showDateRangeFields = false;
    startDate;
    endDate;
    userId;
    selectedJobBillablityStatus;
    selectedJobStatus;
    isLoading = false;
    currentPage = 1;
    showRealtedFilesModal = false;
    showRejectionModal = false;
    @track expenseTypeOptions = [];
    @track expenseSheet=[];
    @track expenseSheetToDisplay = [];
    @track expenseDataIds = [];
    @track selectedExpenseFiles = [];
    isModalLoading = false;
    recordId;
    @api formFactor;

    columns = [
        {
            label: 'Member Name', 
            fieldName: 'memberLink', 
            type: 'url', 
            typeAttributes: {
                target: '_self',
                label: { fieldName: 'memberName' }
            }
        },
        {
            label: 'Job Name', 
            fieldName: 'jobLink', 
            type: 'url', 
            typeAttributes: {
                target: '_self',
                label: { fieldName: 'jobName' }
            }
        },
        {
            label: 'Expense Type', 
            fieldName: 'expenseType', 
            type: 'text'
        },
        {
            label: 'Amount', 
            fieldName: 'amount', 
            type: 'currency',
            typeAttributes: { 
                currencyCode: 'USD', 
                step: '0.01'
            }
        },
        {
            type : "customButtonGroup",
            label: 'Status',
            initialWidth : 210,
            typeAttributes : {
                id : {fieldName : "id"},
                status : {fieldName : "status"}
            }
        },
        {
            type: "customClickableLink",
            fieldName : "fileString",
            typeAttributes: {
                id: { fieldName: "id" }
            }
        }
    ];
    realtedFilesColumns = [
        {
            label : 'File',
            fieldName : 'name',
            type : 'Text'
        },
        {
            label : "Preview",
            type: "button",
            typeAttributes: {
                label : 'Preview',
                name : 'Preview',
                variant : 'brand-outline',
                iconName : 'utility:preview',
                iconPosition : 'right'
            }
        }
    ];
    resourcesLoaded = false;
    get dateOptions() {
        return [
            {label : 'Daily', value : 'daily'},
            {label : 'Weekly', value : 'weekly'},
            {label : 'Monthly', value : 'monthly'},
            {label : 'Custom Date Range', value : 'custom'}
        ]
    }
    get hasDataToDisplay() {
        return this.expenseDataIds.length > 0;
    }
    connectedCallback() {
        Promise.all([
            loadStyle(this,printMedia)
        ])
        .then(() => {
            console.log("Loaded!");
        })
        this.fetchExpenseData();
        this.getNamepace();
    }
    /*renderedCallback() {
        if(!this.resourcesLoaded) {
            Promise.all([
                loadStyle(this,printMedia)
                //loadScript(this,JSPDF),
                //loadScript(this,html2canvas),
                //loadScript(this,jQueryMinJS),
                //loadScript(this,html2canvasmin)
            ])
            .then(() => {
                this.resourcesLoaded = true;
                console.log("Loaded!");
            })
            .catch((err) => {
                console.error("Got an error" + err);
            })
        }
        
    }*/
    @wire(getObjectInfo, { objectApiName: EXPENSE_OBJECT })
    objectInfo;
    @wire(getPicklistValues, { recordTypeId: '$objectInfo.data.defaultRecordTypeId', fieldApiName: EXPENSE_TYPE_FIELD})
    StatusPicklistValues({data,error}){
        if(data){
            var res = [...data.values];
            res.unshift({
                label: "All",
                value: null
            });
            this.expenseTypeOptions = res;
        }
        if(error){
            if(error && error.body && error.body.message){
                this.createToast("Error",error.body.message,"error");
            }
        };
    };

    fetchExpenseData() {
        this.isLoading = true;
        getExpenseData({
            flts : {
                dateFilterType: this.dateSelected,
                startDate: this.startDate,
                endDate: this.endDate,
                userId: this.userId,
                billablityStatus: this.selectedJobBillablityStatus,
            }
        })
        .then((res) => {
            this.expenseDataIds = [];
            if(res) {
                res.forEach((es) => {
                    es.totalAmount = es.data.reduce((total,element) => {
                        //element.id = dataId + '';
                        element.fileString = "View Files";
                        this.expenseDataIds.push(element.id);
                        if(element.status == "Approved" || element.status == "Paid"){
                            return total + element.amount;
                        }   
                        return total;
                    },0).toFixed(2);
                });
                this.expenseSheet = res;
                if(!this.expenseSheet.length) {
                    this.expenseSheetToDisplay = [];
                }
            }
            this.isLoading = false;
        })
        .catch((err) => {
            
            if(err && err.body && err.body.message){
                console.log(err);
                this.createToast("Error",err.body.message,"error");
            }
            this.isLoading = false;
        })
    }
    getNamepace(){
        this.isLoading = true;
        getNamepaceWithUnderscore()
        .then((res) => {
            this.namespaceObject = res[0]+'Expense__c';
            this.namespaceRejectionField = res[0]+'Rejection_Reason__c';
            this.namespaceStatus = res[0]+ 'Status__c';
        }).catch((err)=>{
            console.log(err);
            this.createToast("Error",err.body.message,"error");
        })
    }


    handleDateRangeChange(event) {
        this.dateSelected = event.detail.value;
        if(this.dateSelected == 'custom') {
            this.showDateRangeFields = true;
            this.fetchExpenseDataForCustomDates();
            return;
        } else {
            this.showDateRangeFields = false;
            this.startDate = null;
            this.endDate = null;
        }
        this.fetchExpenseData();
    }
    startDatehandleChange(event){
        this.startDate  = event.detail.value;
        this.fetchExpenseDataForCustomDates();
    }

    // Fetch time sheet data when end date changes
    endDatehandleChange(event){
        this.endDate  = event.detail.value;
        this.fetchExpenseDataForCustomDates();
    }
    onUserFilterChanged(e) {
        this.userId = e.detail.selectedSObject.Id;
        this.fetchExpenseData();
    }
    onBillablityStatusChanged(event) {
        this.selectedJobBillablityStatus = event.detail.value;
        this.fetchExpenseData();
    }
    fetchExpenseDataForCustomDates() {
        if(this.startDate && this.endDate && this.dateSelected == 'custom') {
            this.fetchExpenseData();
        }
    }
    onPageChanged(e) {
        let recordIdsToDisplay = e.detail.recordIdsToDisplay;
        let expensesheetsToDisplay = [];
        try {
            expensesheetsToDisplay = JSON.parse(JSON.stringify(this.expenseSheet));
            expensesheetsToDisplay = expensesheetsToDisplay.filter((ts) => {
                ts.data = ts.data.filter((el) => {
                    return recordIdsToDisplay.includes(el.id);
                });
                if(ts.data.length) {
                    return true;
                }
                return false;
            });
            this.expenseSheetToDisplay = expensesheetsToDisplay;
            this.currentPage = e.detail.currentPage;
        } catch(err) {
            if(err && err.body && err.body.message){
                this.createToast("Error",err.body.message,"error");
            }
        }
    }
    handleAppRejAction(event) {
        this.recordId = event.detail.elementId;
        let statusOfRecord = event.detail.name;
        switch(event.detail.name) {
            case "Paid" : 
            case "Approved"  : 
                this.isLoading = true; 
                updateExpenseData({
                    exps : {
                        expenseId : this.recordId,
                        statusOfRecord : statusOfRecord
                    }
                })
                .then((res) => {
                    if(res.Status == 'success'){
                        this.createToast("Success","Successfully updated the expense","success");
                        this.fetchExpenseData();
                    }
                    else{
                        this.createToast("Error",res.message,"error");
                    }
                    this.isLoading = false;
                });
                break;
            case "Denied" : 
                this.showRejectionModal = true;
                this.isModalLoading = true;
                break;
        }
    }
    createToast(title,msg,variant) {
        const toastEvent = new ShowToastEvent({
            title : title,
            message : msg,
            variant : variant
        });
        this.dispatchEvent(toastEvent);

    }
    generatePdf() {
        let sizeOfPage = 0;
        this.expenseSheet.forEach((t) => {
            sizeOfPage = sizeOfPage + t.data.length;
        });
        this.template.querySelector("c-custom-paginator").setupDownload(sizeOfPage);
        window.print();
        this.template.querySelector("c-custom-paginator").setupDownload(4);
    }
    onDownload() {
        try {
          /*const { jsPDF } = window.jspdf;
          //var doc = new jsPDF();
          var source = this.template.querySelector('[data-id="tabledata"]');
          console.log(source);
          //doc.html($(source));
          const { html2canvas } = window.html2canvas;
          html2canvas(source,{
              onrendered : function(canvas){
                var doc = new jsPDF();
                doc.save('test.pdf');
              }
          })*/
          let rows = [];
          this.expenseSheet.forEach((ts) => {
            if (ts.data) {
              rows.push({ groupTitle: ts.title });
              rows.push(...ts.data);
              rows.push({}); // Add a line seperator
              rows.push({ groupTitle: "TOTAL APPROVED/PAID AMOUNT ", amount: ts.totalAmount });
              rows.push({}); // Add a line seperator
            }
          });
          let csv = jsonToCSV(rows, CSV_COLUMNS);
          downloadCSV(csv,'Expensesheet.csv');
        } catch (err) {
            if(err && err.body && err.body.message){
                this.createToast("Error",err.body.message,"error");
            }
        }
      }
    onDatatableLinkClicked(event) {
        const row = event.detail.row;
        this[NavigationMixin.Navigate]({
            type : 'standard__namedPage',
            attributes : {
                pageName : 'filePreview'
            },
            state : {
                selectedRecordId : row.fileId
            }
        });
    }
    onRealtedFilesModalClosed() {
        this.showRealtedFilesModal = false;
    }
    onRejectionModalClosed() {
        this.showRejectionModal = false;
    }
    onLinkClick(event) {
        this.isModalLoading = true;
                getContents({
                    jobID : event.detail.linkId
                })
                .then((res) => {
                    this.showRealtedFilesModal = true;
                    this.selectedExpenseFiles = res;
                    this.isModalLoading = false;
                })
                .catch((err) => {
                    this.isModalLoading = false;
                    if(err && err.body && err.body.message){
                        this.createToast("Error",err.body.message,"error");
                    }
                })
    }
    handleRejectionSubmit(event) {
        this.isLoading = true;
        event.preventDefault();
        console.log(event.detail.fields);
        this.template.querySelector('lightning-record-edit-form').submit(event.detail.fields);
    }
    handleSuccess(event) {
        this.onRejectionModalClosed();
        this.fetchExpenseData();
    }
    handleLoad(event) {
        if(this.isModalLoading) {
            var record = event.detail.records;
            var fields = record[this.recordId].fields;
            if(fields.Name.value != null ) {
                this.isModalLoading = false;
            }
        }
    }
}