import { LightningElement, track,wire, api } from "lwc";
import getTimesheetData from "@salesforce/apex/TimeSheetReportController.getTimesheetData";
import getEmployeeTimeEntryData from "@salesforce/apex/TimeSheetReportController.getEmployeeTimeEntryData";
import getNamepaceWithUnderscore from '@salesforce/apex/Lib_Base_Controller.getNamespace';
import checkCostCodeAccess from '@salesforce/apex/TimeSheetReportController.checkCostCodeAccess';
import { jsonToCSV, downloadCSV } from "c/csvUtils";
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import JOB_OBJECT from '@salesforce/schema/Job__c';
import STATUS_FIELD from '@salesforce/schema/Job__c.Status__c';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import {loadScript,loadStyle} from "lightning/platformResourceLoader";
import printMedia from "@salesforce/resourceUrl/printMedia";

const CSV_COLUMNS = [
  { label: "", fieldName: "groupTitle" },
  { label: "Member Name", fieldName: "memberName" },
  { label: "Job Name", fieldName: "jobName" },
  { label: "Time Log(HR)", fieldName: "timeLog" },
  { label: "Cost Code", fieldName: "costCode" }
];

export default class TimesheetReport extends LightningElement {
  showEditRecordForm = false;
  showDateRangeFields = false;
  showEmployeeDetailsModal = false;
  dateSelected = "daily";
  startDate;
  endDate;
  userId;
  costCodeId;
  selectedJobStatus = null;
  activeSections = [];
  isModalLoading = false;
  namespaceObj = {};
  clickedRecord;
  costCodeAccess = false;

  @track jobStatusOptions = [];
  @track timesheetDataIds = [];

  currentPage = 1;
  isLoading = false;

  selectedEmployeeName = "";


  employeeTimeLogColumns = [];

  @track timesheets = [];
  @track timesheetsToDisplay = [];
  @track selectedEmployeeTimeLogs = []; // {title, entries}
  @api open;
  @api formFactor;

  activeSections = [];
  // Date filter options
  get dateOptions() {
    return [
      { label: "Daily", value: "daily" },
      { label: "Weekly", value: "weekly" },
      { label: "Monthly", value: "monthly" },
      { label: "Custom Date Range", value: "custom" }
    ];
  }

  get hasDataToDisplay() {
    return this.timesheetDataIds.length > 0;
  }

  handleClick(e) {
    let idOfElement = e.target.dataset.id;
    let idOfUser,startDateFilter,endDateFilter,jobFilter,flag;
    this.timesheetsToDisplay.forEach((ele) => {
      ele.data.forEach((item) => {
        if(item.id == idOfElement) {
          flag = item.expanded = item.expanded ? false : true;
          idOfUser = item.memberId;
          startDateFilter = item.startDate;
          endDateFilter = item.endDate;
          item.open = flag ? "slds-section slds-is-open" : "slds-section";
          let stringUrl = item.jobLink.toString();
          jobFilter = stringUrl.substring(1);
        }
        else if(item.expanded == true) {
          item.expanded = false;
          item.open = "slds-section";
        }
      });
    });
    console.log(this.timesheetsToDisplay);
    if(flag) {
      this.fetchEmployeeTimeEntries(idOfUser,startDateFilter,endDateFilter,jobFilter);
    }
    this.open = !this.open;
}
  connectedCallback() {
    Promise.all([
      loadStyle(this,printMedia)
  ])
  .then(() => {
      console.log("Loaded!");
  })
    this.getNamespace();
    this.fetchCostCodeAccess();
    this.fetchTimesheetData();
    this.handleFormFactor();

  }

  handleFormFactor(){
    if(!this.formFactor){
      this.employeeTimeLogColumns = [
        {
          label: "Job Name",
          fieldName: "jobLink",
          type: "url",
          initialWidth: 180,
          typeAttributes: {
            target: "_self",
            label: { fieldName: "jobName" }
          }
        },
        {
          label: "Clock-In Time",
          fieldName: "clockInTime",
          type: "text",
          initialWidth: 180,
        },
        {
          label: "Clock-Out Time",
          fieldName: "clockOutTime",
          type: "text",
          initialWidth: 180,
        },
        {
          label: "Total Time",
          fieldName: "totalTime",
          type: "text",
          initialWidth: 180,
        },
        {
          label: "Actions",
          fieldName: "recordLink",
          initialWidth: 180,
          type: "url",
          initialWidth: 180,
          typeAttributes: {
            target: "_self",
            label: "More Details"
          }
        },
        {
          label : "",
          type : "button",
          initialWidth: 180,
          typeAttributes : {
            iconName: 'utility:edit',
            label: 'Edit Time Entry',
            name: 'editRecord',
            disabled: false,
            value: 'viewBtn'
          },
        }
      ];
    }
    else{
      this.employeeTimeLogColumns = [
        {
          label: "Job Name",
          fieldName: "jobLink",
          type: "url",
          typeAttributes: {
            target: "_self",
            label: { fieldName: "jobName" }
          }
        },
        {
          label: "Clock-In Time",
          fieldName: "clockInTime",
          type: "text",
        },
        {
          label: "Clock-Out Time",
          fieldName: "clockOutTime",
          type: "text",
        },
        {
          label: "Total Time",
          fieldName: "totalTime",
          type: "text",
        },
        {
          label: "Actions",
          fieldName: "recordLink",
          initialWidth: 180,
          type: "url",
          typeAttributes: {
            target: "_self",
            label: "More Details"
          }
        },
        {
          label : "",
          type : "button",
          initialWidth: 180,
          typeAttributes : {
            iconName: 'utility:edit',
            label: 'Edit Time Entry',
            name: 'editRecord',
            disabled: false,
            value: 'viewBtn'
          },
        }
      ];

    }
  }

  @wire(getObjectInfo, { objectApiName: JOB_OBJECT })
    objectInfo;
    @wire(getPicklistValues, { recordTypeId: '$objectInfo.data.defaultRecordTypeId', fieldApiName: STATUS_FIELD})
    StatusPicklistValues({data,error}){
        if(data){
            var res = [...data.values];
            res.unshift({
              label: "All",
              value: null
            })
            this.jobStatusOptions = res;
        }
        if(error){
            console.log(error.message);
        };
    };

  fetchCostCodeAccess(){
    this.isLoading = true;
    checkCostCodeAccess()
    .then(res => {
      this.costCodeAccess = res == null || res == undefined ? false : res;
      this.isLoading = false;
    })
    .catch(err => {
      this.isLoading = false;
        if(err && err.body && err.body.message){
          this.createToast("Error",err.body.message,"error");
        }
    })
  }
  // Fetch timesheet data using apex (with filters applied)
  fetchTimesheetData() {
    this.isLoading = true;
    let flt = {dateFilterType: this.dateSelected,startDate: this.startDate,endDate: this.endDate,userId: this.userId,costCodeId: this.costCodeId,jobStatus: this.selectedJobStatus};
    getTimesheetData({flts:flt})
      .then(res=> {
        if (res) {
          console.log(res);
          this.timesheets = res;
          this.timesheetDataIds = [];
          this.currentPage = 1;

          if (!this.timesheets.length) {
            this.timesheetsToDisplay = [];
          }

          var dataId = 0;
          this.timesheets.forEach((ts) => {
            ts.totalTime = ts.data
              .reduce((total, element) => {
                dataId++;
                element.id = dataId + "";
                element.expanded = false;
                element.open = "slds-section";
                this.timesheetDataIds.push(element.id);
                return total + element.timeLog;
              }, 0)
              .toFixed(2);
          });
          console.log(this.timesheets);
        }
        this.isLoading = false;
      })
      .catch((err) => {
        this.isLoading = false;
        if(err && err.body && err.body.message){
          this.createToast("Error",err.body.message,"error");
        }
      });
  }

  fetchEmployeeTimeEntries(employeeId,startDate,endDate,jobId) {
    this.isLoading = true;
    getEmployeeTimeEntryData({
      emplData: {
        employeeId: employeeId,
        startDate : startDate,
        endDate : endDate,
        jobId : jobId
      }
    })
      .then((res) => {
        if (res) {
          console.log(res);
          this.selectedEmployeeTimeLogs = res;
          this.selectedEmployeeTimeLogs.forEach((empLogs) => {
            empLogs.totalTime = empLogs.entries.reduce((total,element) => {
              return total + element.totalTime;
            },0)
            .toFixed(2);
          })
          if (res[0]) {
            this.selectedEmployeeName = res[0].employeeName;
          }
        }
        this.isLoading = false;
      })
      .catch((err) => {
        this.isLoading = false;
        if(err && err.body && err.body.message){
          this.createToast("Error",err.body.message,"error");
        }
      });
  }

  getNamespace(){
    this.isLoading = true;
    getNamepaceWithUnderscore()
    .then((res) => {
        this.namespaceObj.namespaceObject = res[0]+'Timesheet_Entry_Item__c';
        this.namespaceObj.namespaceClockInField = res[0]+'Clock_In_Time__c';
        this.namespaceObj.namespaceClockOutField = res[0]+ 'Clock_Out_Time__c';
    }).catch((err)=>{
        console.log(err);
        this.createToast("Error",err.body.message,"error");
    })
  }
  // Date filter change handler
  handleDateRangeChange(event) {
    this.dateSelected = event.detail.value;
    if (this.dateSelected == "custom") {
      this.showDateRangeFields = true;
      this.fetchTimesheetDataForCustomDates();
      return;
    } else {
      this.showDateRangeFields = false;
      this.startDate = null;
      this.endDate = null;
    }
    this.fetchTimesheetData();
  }

  // Fetch time sheet data when start date changes
  startDatehandleChange(event) {
    this.startDate = event.detail.value;
    this.fetchTimesheetDataForCustomDates();
  }

  // Fetch time sheet data when end date changes
  endDatehandleChange(event) {
    this.endDate = event.detail.value;
    this.fetchTimesheetDataForCustomDates();
  }

  // Fetch timesheet data for custom dates (validating input)
  fetchTimesheetDataForCustomDates() {
    if (this.startDate && this.endDate && this.dateSelected == "custom") {
      this.fetchTimesheetData();
    }
  }

  // Fetch timesheet data when user filter is changed
  onUserFilterChanged(e) {
    this.userId = e.detail.selectedSObject.Id;
    this.fetchTimesheetData();
  }

  // Fetch timesheet data when cost codes filter is changed
  onCostCodesFilterChanged(e) {
    this.costCodeId = e.detail.selectedSObject.Id;
    this.fetchTimesheetData();
  }

  // Fetch timesheet data when job status filter is changed
  onJobStatusChanged(e) {
    this.selectedJobStatus = e.detail.value;
    this.fetchTimesheetData();
  }

  // Apply filter when page changed
  onPageChanged(e) {
    let recordIdsToDisplay = e.detail.recordIdsToDisplay;
    let timesheetsToDisplay = [];
    try {
      timesheetsToDisplay = JSON.parse(JSON.stringify(this.timesheets));
      timesheetsToDisplay = timesheetsToDisplay.filter((ts) => {
        ts.data = ts.data.filter((el) => {
          return recordIdsToDisplay.includes(el.id);
        });
        if (ts.data.length) {
          return true;
        }
        return false;
      });
      this.timesheetsToDisplay = timesheetsToDisplay;
      this.currentPage = e.detail.currentPage;
    } catch (err) {
      if(err && err.body && err.body.message){
        this.createToast("Error",err.body.message,"error");
      }
    }
  }

  generatePdf() {
    try{
      let sizeOfPage = 0;
      this.timesheets.forEach((t) => {
        sizeOfPage = sizeOfPage + t.data.length;
      });
      this.template.querySelector("c-custom-paginator").setupDownload(sizeOfPage);
        window.print();
        this.template.querySelector("c-custom-paginator").setupDownload(4);
    }
    catch (err) {
      if(err && err.body && err.body.message){
        this.createToast("Error",err.body.message,"error");
      }
    }
  }
  onDownload() {
    try {
      
          //this.template.querySelector("c-custom-paginator").setupDownload(4);
      let rows = [];
      this.timesheets.forEach((ts) => {
        if (ts.data) {
          rows.push({ groupTitle: ts.title });
          rows.push(...ts.data);
          rows.push({}); // Add a line seperator
          rows.push({ groupTitle: "TOTAL TIME LOGGED", timeLog: ts.totalTime });
          rows.push({}); // Add a line seperator
        }
      });
      let csv = jsonToCSV(rows, CSV_COLUMNS);
      downloadCSV(csv,'Timesheet.csv');
    } catch (err) {
      if(err && err.body && err.body.message){
        this.createToast("Error",err.body.message,"error");
      }
    }
  }
  handleRowAction(event){
    const action = event.detail.action;
    console.log(action.name);
    const row = event.detail.row;
    console.log(row);
    let rowData = JSON.stringify(row);
    console.log(rowData);
    let rowId = row.recordLink.substring(1);
    console.log(rowId);
    if(action.name == "editRecord"){
      var goto = this.template.querySelector('[data-id="datatable"]');
      window.scrollTo(0,goto.offsetTop);
      this.clickedRecord = rowId;
      this.showEditRecordForm = true;
      this.isModalLoading = true;
    }

  }
  onEditRecordClose(event){
    this.showEditRecordForm = false;
  }
  handleUpdateTime(event){
    event.preventDefault();
    console.log(event.detail.fields);
    this.template.querySelector('lightning-record-edit-form').submit(event.detail.fields);
  }
  handleSuccess(event) {
    this.onEditRecordClose();
    this.fetchTimesheetData();
  }
  handleLoad(event){
    if(this.isModalLoading) {
      var record = event.detail.records;
      var fields = record[this.clickedRecord].fields;
      console.log(fields.Name.value);
      if(fields.Name.value != null ) {
          this.isModalLoading = false;
      }
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
  
}