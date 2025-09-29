import { LightningElement } from 'lwc';
import getUserProfileData from '@salesforce/apex/DefaultsController.getUserProfileData';
import checkMetaDataAccess from '@salesforce/apex/DefaultsController.checkMetaDataAccess';
import fetchCustomSettings from '@salesforce/apex/DefaultsController.fetchCustomSettings';
import checkSecondLevelAccess from '@salesforce/apex/TimeSheetReportController.checkSecondLevelAccess';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import FORM_FACTOR  from '@salesforce/client/formFactor';


export default class SetupApp extends LightningElement {
    hasAccess = false;
    isLoading = false;
    showCompanySetup = false;
    showColorsSetup = false;
    formFactor = true;
    isCustomSetting = false;
    
    connectedCallback(){
        this.getUserProfileDetails();
        this.getSecondLevelAccess();
        this.checkCustomSettings();
    }
    
    get tabsetVariant(){
        switch(FORM_FACTOR) {
            case 'Large':
                return 'vertical';
                
            case 'Small':
                this.formFactor = false;
                return 'standard';
                
            default:
        }
    }
    getUserProfileDetails(){
        this.isLoading = true;
        getUserProfileData()
        .then(res => {
            this.showCompanySetup = res;
            if(this.showCompanySetup == false){
                checkMetaDataAccess()
                .then(res => {
                    this.showColorsSetup = res;
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
                this.showColorsSetup = true;
            }
            this.isLoading = false;
        })
        .catch(err => {
            console.error(err);
            this.isLoading = false;
            if(err.body != null && err.body.message != null) {
                this.createToastMessage("An error occured",err.body.message,"error");
            }
        })
    }
    getSecondLevelAccess(){
        checkSecondLevelAccess()
        .then(res => {
            this.hasAccess = res;
        })
        .catch(err =>{
            this.hasAccess = false;
            this.createToastMessage("Error",err.msg,"error");
        })
    }
    checkCustomSettings() {
        this.isLoading = true;
        fetchCustomSettings()
        .then(result => {
            if (result != null) {
                this.isCustomSetting = (result > 0) ?  true : false;
                this.isLoading = false;
            }
        })
        .catch(error => {
            this.isLoading = false;
            console.log('Error: '+ JSON.stringify(error));
        })
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