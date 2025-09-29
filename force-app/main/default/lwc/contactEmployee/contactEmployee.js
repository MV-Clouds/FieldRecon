import { LightningElement,track,wire } from 'lwc';
import fetchProfiles  from '@salesforce/apex/WFEmployeeController.fetchProfiles';
import updateUsersAndContacts  from '@salesforce/apex/WFEmployeeController.updateUsersAndContacts';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import TIMEZONESIDKEYFIELD from '@salesforce/schema/User.TimeZoneSidKey';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import ACCOUNT_OBJECT from '@salesforce/schema/Account';
import {reduceErrors} from 'c/libErrorUtils';


export default class ContactEmployee extends NavigationMixin(LightningElement) {
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
    userRecordsId;
    domain;
    onSched = true;
    canClockIn = true;
    hasValues = false;
    showContactBox = false;
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
    connectedCallback() {
        this.fetchUserProfiles();
    }
    fetchUserProfiles() {
        this.isLoading = true;
        fetchProfiles()
        .then(res => {
            if(res.length != 0) {
                //this.values = [];
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
                this.canClockIn = true;
                this.onSched = true;
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
        var fieldName = event.target.name;
        var fieldValue = event.detail.value == null ? event.detail.checked : event.detail.value;
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
            case "clockIn" : 
                this.canClockIn = fieldValue;
                if(!this.canClockIn){
                    let license = this.userProfilesOptions.filter(ele => ele.label == 'Chatter Free User');
                    this.selectedLicense = license[0].value;
                }
            break;
            case "schd" : 
                this.onSched = fieldValue;
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
        //console.log(this.values);
        if(this.domain == null) {
            this.createToastMessage("Invalid Data","Please specify a domain for users","info");
            return;
        }
        if(this.values.length == 0) {
            this.createToastMessage("Invalid Data","Please specify Contacts to convert users","info");
            return;
        }
        if(this.canClockIn){
            licenseData = {
                licenseName : this.selectedLicenseName,
                licenseId : this.selectedLicense
        }
        if(this.selectedLicenseRecordId != null) {
            licenseData['recordId'] = this.selectedLicenseRecordId
        }
        objectToSend.userLicenseData  = licenseData;
        }
        userRecordsData = {
            userTimeZone : this.selectedTimeZone,
            userDomain : this.domain,
            recordId : this.userRecordsId
        }
        //objectToSend.userLicenseData  = licenseData;
        objectToSend.userRecords = userRecordsData;
        if(this.hasValues == false){
            updateUsersAndContacts({
                listOfContacts : JSON.stringify(objectToSend)
            })
            .then(res => {
                objectToSend = {};
                objectToSend = {
                    contactLogData : {
                        onScheduler : this.onSched,
                        canLogIn : this.canClockIn
                    }
                }
                objectToSend.contactsData = this.values;
                updateUsersAndContacts({
                    listOfContacts : JSON.stringify(objectToSend)
                })
                .then(res => {
                    this.createToastMessage("Success","The Employees Are All Set!","success");
                    this.isLoading = false;
                    this.template.querySelector('c-lwc-multi-select-lookup').clearValues();
                    this.fetchUserProfiles();
                })
                .catch(err => {
                    console.error(err);
                    this.fetchUserProfiles();
                    this.isLoading = false;
                    if(err.body != null && err.body.message != null) {
                        console.log(reduceErrors(err.body.message));
                        this.createToastMessage("An error occured",err.body.message,"error");
                    }
                })
            })
            .catch(err => {
                console.error(err);
                this.fetchUserProfiles();       
                this.isLoading = false;
                if(err.body != null && err.body.message != null) {
                    console.log(reduceErrors(err.body.message));
                    this.createToastMessage("An error occured",err.body.message,"error");
                }
            })
        }
        else{
            objectToSend.contactLogData = {
                onScheduler : this.onSched,
                canLogIn : this.canClockIn
            }
            objectToSend.contactsData = this.values;
            updateUsersAndContacts({
                listOfContacts : JSON.stringify(objectToSend)
            })
            .then((res) => {
                //console.log(res);
                this.createToastMessage("Success","The Employees Are All Set!","success");
                this.isLoading = false;
                this.fetchUserProfiles();
            })
            .catch((err) => {
                console.error(err);
                this.fetchUserProfiles();
                this.isLoading = false;
                if(err.body != null && err.body.message != null) {
                    this.createToastMessage("An error occured",err.body.message,"error");
                }
            })
        }
    }
    /*addNewContacts(event){
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
    } */
    openContactBox(event){
        this.showContactBox = true;
    }
    closeContactBox(event){
        this.showContactBox = false;
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