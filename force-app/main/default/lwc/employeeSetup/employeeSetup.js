import { LightningElement,track,wire } from 'lwc';
import fetchProfiles  from '@salesforce/apex/WFEmployeeController.fetchProfiles';
import updateUsersAndContacts  from '@salesforce/apex/WFEmployeeController.updateUsersAndContacts';
import fetchContactsUsers from '@salesforce/apex/WFEmployeeController.fetchContactsUsers';
import updateUsersData from '@salesforce/apex/WFEmployeeController.updateUsersData'; 
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import TIMEZONESIDKEYFIELD from '@salesforce/schema/User.TimeZoneSidKey';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import ACCOUNT_OBJECT from '@salesforce/schema/Account';

export default class EmployeeSetup extends NavigationMixin(LightningElement) {
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
    @wire(getObjectInfo, { objectApiName: ACCOUNT_OBJECT })
    objectInfo;
    @wire(getPicklistValues,{
        recordTypeId: '$objectInfo.data.defaultRecordTypeId', 
        fieldApiName: TIMEZONESIDKEYFIELD
    })
    StatusPicklistValues({data,error}){
        if(data){
            var res = [...data.values];
            res.unshift({
              label: "All",
              value: null
            })
            this.timeZoneOptions = res;
        }
        if(error){
            console.log(error.message);
            this.createToastMessage("An Error Occured",error.message,"error");
        };
    };
    get hasUserSelectedLicense(){
        return this.selectedLicense != null;
    }
    get hasUserAddedContacts(){
        return this.values.length > 0 && this.selectedLicense != null;
    }
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
        this.fetchUserProfiles();
        this.fetchContactsData();
    }
    fetchUserProfiles() {
        this.isLoading = true;
        fetchProfiles()
        .then(res => {
            if(res.length != 0) {
                this.values = [];
                console.log(res);
                var licenseVals = res.userLicenses;
                licenseVals.forEach(ele => {
                    if(ele.recordId != null) {
                        this.selectedLicense = ele.licenseId;
                        this.selectedLicenseRecordId  = ele.recordId;
                        this.selectedLicenseName = ele.licenseName;
                        //this.hasValues = true;
                    }
                    this.userProfilesOptions = [...this.userProfilesOptions,
                        {value : ele.licenseId, label : ele.licenseName }];
                });
                if(this.selectedLicense == null) {
                    this.userProfilesOptions.unshift({
                        label : '--None--',
                        value : ''
                    });
                    this.selectedLicense = this.userProfilesOptions[0].value;
                }
                this.selectedTimeZone = res.userFieldsDefaults['userTimeZone'];
                this.domain = res.userFieldsDefaults['userDomain'];
                if(res.userFieldsDefaults.recordId != null) {
                    this.userRecordsId = res.userFieldsDefaults.recordId;
                    this.hasValues = true;
                }
                console.log(this.hasValues);
            }
            this.isLoading = false;
        })
        .catch(err => {
            console.error(err);
            if(err.body != null && err.body.message != null) {
                this.createToastMessage("An error occured",err.body.message,"error");
            }
            this.isLoading = false;
        });
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
            this.currentPage = 1;
            //console.log(this.data);
            console.log(this.contactsData);
            console.log(this.userRecordsIds);
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
    selectItemEventHandler(event){
        let args = JSON.parse(JSON.stringify(event.detail.arrItems));
        this.displayItem(args);        
    }

    //captures the remove event propagated from lookup component
    deleteItemEventHandler(event){
        let args = JSON.parse(JSON.stringify(event.detail.arrItems));
        this.displayItem(args);
    }
    displayItem(args){
        this.values = []; //initialize first
        args.map(element=>{
            this.values.push(element);
        });

        this.isItemExists = (args.length>0);
        this.selectedItemsToDisplay = this.values.join(', ');
    }
    handleChangeForFields(event){
        this.hasValues = false;
        console.log(event);
        var fieldName = event.target.name;
        var fieldValue = event.detail.value;
        switch(fieldName){
            case "domainName" : 
                this.domain = fieldValue;
                break;
            case "TimeZone" : 
                this.selectedTimeZone = fieldValue;
                break;
            case "progress" : 
                this.selectedLicense = fieldValue;
                this.selectedLicenseName = event.target.options.find(opt => opt.value === this.selectedLicense).label;
                break;
            default : 
                console.log(fieldName); 
        }
    }
    saveContacts(){
        this.isLoading = true;
        var objectToSend = {};
        var licenseData = {};
        var userRecordsData = {};
        console.log(this.values);
        if(this.domain == null) {
            this.createToastMessage("Invalid Data","Please specify a domain for users","info");
            return;
        }
        if(this.values.length == 0) {
            this.createToastMessage("Invalid Data","Please specify Contacts to convert users","info");
            return;
        }
        licenseData = {
            licenseName : this.selectedLicenseName,
            licenseId : this.selectedLicense
        }
        if(this.selectedLicenseRecordId != null) {
            licenseData['recordId'] = this.selectedLicenseRecordId
        }
        userRecordsData = {
            userTimeZone : this.selectedTimeZone,
            userDomain : this.domain,
            recordId : this.userRecordsId
        }
        objectToSend.userLicenseData  = licenseData;
        objectToSend.userRecords = userRecordsData;
        if(this.hasValues == false){
            updateUsersAndContacts({
                listOfContacts : JSON.stringify(objectToSend)
            })
            .then(res => {
                objectToSend = {};
                objectToSend.contactsData = this.values;
                updateUsersAndContacts({
                    listOfContacts : JSON.stringify(objectToSend)
                })
                .then(res => {
                    this.createToastMessage("Success","The Employees Are All Set!","success");
                    this.isLoading = false;
                    this.fetchUserProfiles();
                })
                .catch(err => {
                    console.error(err);
                    this.isLoading = false;
                    if(err.body != null && err.body.message != null) {
                        this.createToastMessage("An error occured",err.body.message,"error");
                    }
                })
            })
            .catch(err => {
                console.error(err);
                this.isLoading = false;
                if(err.body != null && err.body.message != null) {
                    this.createToastMessage("An error occured",err.body.message,"error");
                }
            })
        }
        else{
            objectToSend.contactsData = this.values;
            updateUsersAndContacts({
                listOfContacts : JSON.stringify(objectToSend)
            })
            .then((res) => {
                console.log(res);
                this.createToastMessage("Success","The Employees Are All Set!","success");
                this.isLoading = false;
                this.fetchUserProfiles();
            })
            .catch((err) => {
                console.error(err);
                this.isLoading = false;
                if(err.body != null && err.body.message != null) {
                    this.createToastMessage("An error occured",err.body.message,"error");
                }
            })
        }
    }
    addNewContacts(event){
        let temp = {
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Contact',
                actionName: 'new'                
            },
            state: {
                useRecordTypeCheck: 1,
                navigationLocation: 'RELATED_LIST'
              }
        }
        this[NavigationMixin.Navigate](temp);
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
        console.log(this.contactsData);
        contactsToDisplay = contactsToDisplay.filter((con) => {
                return recordIdsToDisplay.includes(con.recordId);
        });
      this.contactsToDisplay = contactsToDisplay;
      console.log(contactsToDisplay);
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