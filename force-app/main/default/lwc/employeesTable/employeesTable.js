import { LightningElement,track } from 'lwc';
import fetchContactsUsers from '@salesforce/apex/WFEmployeeController.fetchContactsUsers';
import updateUsersData from '@salesforce/apex/WFEmployeeController.updateUsersData'; 
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
export default class EmployeesTable extends LightningElement {
    pageSize = 25;
    isLoading = false;
    @track selectedItemsToDisplay = ''; //to display items in comma-delimited way
    @track values = []; //stores the labels in this array
    @track isItemExists = false; //flag to check if message can be displayed
    @track userProfilesOptions = [];
    selectedLicense;
    selectedLicenseRecordId;
    selectedLicenseName;
    selectedTimeZone = '';
    timeZoneOptions = [];
    @track contactsData = [];
    @track userRecordsIds = [];
    @track contactsToDisplay = [];
    userRecordsId;
    currentPage = 1;
    @track usersToUpdate = [];
    domain;
    columns = [
        {
            label : "Name",
            fieldName : "recordUrl",
            type : "url",
            hideDefaultActions : true,
            typeAttributes: {
                target: "_self",
                label: { fieldName: "nameOfContact" }
            }
        },
        {
            label: "User Time Zone",
            fieldName: "userTimeZone",
            type : "picklist",
            hideDefaultActions : true,
            typeAttributes: { 
                id: {fieldName : "recordId"}, 
                selectedVal : {fieldName : "userTimeZone"}
            },
            wrapText : true
        }
    ];
    hasValues = false;
    get contactsToDisplaySize(){
        return this.contactsToDisplay.length > 0;
    }
    get contactsSize(){
        return this.contactsData.length > 0;
    }
    get hasDataToSave(){
        return this.usersToUpdate.length > 0;
    }
    connectedCallback() {
        this.fetchContactsData();
    }
    fetchContactsData(){
        this.isLoading = true;
        fetchContactsUsers()
        .then(res => {
            this.userRecordsIds = [];
            this.contactsData = res;
            this.contactsData.forEach(ele => {
                this.userRecordsIds.push(ele.recordId);
            })
            this.usersToUpdate = [];
            this.currentPage = 1;
            this.isLoading = false;
        })
        .catch(err => {
            console.error(err);
            if(err.body != null && err.body.message != null) {
                this.createToastMessage("An error occured",err.body.message,"error");
            }
            this.isLoading = false;
        })
    }
    setPicklistValues(event){
        let isUpdated = false;
        let userId = event.detail.elementId;
        let timeZoneKey = event.detail.name;
        this.usersToUpdate.forEach(ele => {
            if(ele.recordId == userId){
                ele.userTimeZone = timeZoneKey;
                isUpdated = true;
            }
        })
        if(!isUpdated) {
            let userObj = {};
            userObj.recordId = userId;
            userObj.userTimeZone = timeZoneKey;
            this.usersToUpdate.push(userObj);
        }
    }
    updateUsers(){
        this.isLoading = true;
        updateUsersData({
            userData : JSON.stringify(this.usersToUpdate)
        })
        .then(res => {
            this.isLoading = false;
            this.createToastMessage("Success!","The timezone of the user was updated!","success");
            this.fetchContactsData();
        })
        .catch(err => {
            console.error(err);
            this.isLoading = false;
            if(err.body != null && err.body.message != null) {
                this.createToastMessage("An error occured",err.body.message,"error");
            }
        })
    }
    onPageChanged(e){
        let recordIdsToDisplay = e.detail.recordIdsToDisplay;
        let contactsToDisplay = [];
    try {
        contactsToDisplay = JSON.parse(JSON.stringify(this.contactsData));
        contactsToDisplay = contactsToDisplay.filter((con) => {
                return recordIdsToDisplay.includes(con.recordId);
        });
      this.contactsToDisplay = contactsToDisplay;
      this.currentPage = e.detail.currentPage;
    } catch (err) {
      if(err && err.body && err.body.message){
        this.createToast("Error",err.body.message,"error");
      }
    }
  }
    createToastMessage(title,msg,type) {
        const event = new ShowToastEvent({
            title: title,
            message: msg,
            variant: type,
        });
        this.dispatchEvent(event);
    }
}