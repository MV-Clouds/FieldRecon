import { LightningElement, track } from 'lwc';
import fetchProfiles  from '@salesforce/apex/WFEmployeeController.fetchProfiles';
import saveEmployeeContact from '@salesforce/apex/WFEmployeeController.saveEmployeeContact';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CreateContactCmp extends LightningElement {
    isLoading = false;
    newContact = {};
    @track values = [];
    @track userProfilesOptions = [];
    userProfilesWithNames = [];
    selectedStep = 1;
    selectedLicense;
    selectedLicenseRecordId;
    selectedLicenseName;
    allDone = false;
    hasValues = false;

    get selectedStepString(){
        return this.selectedStep.toString();
    }
    get isFirstStep(){
        return this.selectedStep == 1 ? true : false;
    }
    get isSecondStep(){
        return this.selectedStep == 2 ? true : false;
    }

    connectedCallback(){
        this.fetchUserProfiles();
    }

    fetchUserProfiles() {
        this.isLoading = true;
        fetchProfiles()
        .then(res => {
            if(res.length != 0) {
                this.values = [];
                var licenseVals = this.userProfilesWithNames = res.userLicenses;
                licenseVals.forEach(ele => {
                    if(ele.recordId != null) {
                        this.selectedLicense = ele.licenseId;
                        this.newContact["prof"] = ele.licenseId;
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

    saveContact(event){
        this.isLoading = true;
        let contactDetails = event.detail;
        contactDetails = JSON.parse(JSON.stringify(contactDetails));
        this.hasValues = contactDetails.prof == undefined || contactDetails.prof == null ? false : true;
        if(this.hasValues && (this.selectedLicense != contactDetails.prof)){
            let licensesUser = this.userProfilesWithNames.filter(ele => {
                if(ele.licenseId == contactDetails.prof){
                    this.selectedLicenseName = ele.licenseName;
                    this.selectedLicense = ele.licenseId;
                }
            })
        }
        else{
            this.hasValues = false;
        }
        if(this.hasValues){
            contactDetails["licenseId"] = this.selectedLicense;
            contactDetails["licenseName"] = this.selectedLicenseName;
            contactDetails["recordId"] = this.selectedLicenseRecordId;
            saveEmployeeContact({
                newConData : JSON.stringify(contactDetails)
            })
            .then(res => {
                delete contactDetails.prof;
                saveEmployeeContact({
                    newConData : JSON.stringify(contactDetails)
                })
                .then(res => {
                    this.isLoading = false;
                    this.createToast("Success","Successfully created Employee!","success");
                    this.allDone = true;
                    this.selectedStep++;
                    const closePageEvent = new CustomEvent("closebox");
                  
                      // Dispatches the event.
                      this.dispatchEvent(closePageEvent);
                })
                .catch(err => {
                    this.isLoading = false;
                    console.log(err);
                })
            })
            .catch(err => {
                this.isLoading = false;
                console.log(err);
            })
        }
        else{
            delete contactDetails.prof;
            saveEmployeeContact({
                newConData : JSON.stringify(contactDetails)
            })
            .then(res => {
                this.isLoading = false;
                this.createToast("Success","Successfully created Employee!","success");
                this.allDone = true;
                this.selectedStep++;
                const closePageEvent = new CustomEvent("closebox");
                  
                      // Dispatches the event.
                      this.dispatchEvent(closePageEvent);
            })
            .catch(err => {
                this.isLoading = false;
                if(err && err.body && err.body.message){
                    this.createToast("Error",err.body.message,"error");
                  }
                console.log(err);
            })
        }
    }

    handleNextStep(event){
        this.newContact = JSON.parse(JSON.stringify(event.detail));
        this.selectedStep++;

    }
    handlePreviousStep(event){
        this.selectedStep--;
        console.log('reached');
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