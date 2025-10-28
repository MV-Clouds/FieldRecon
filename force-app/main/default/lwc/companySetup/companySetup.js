import { LightningElement } from 'lwc';
import getCompanyData from '@salesforce/apex/DefaultsController.fetchCompanyData';
import saveCompanyData from '@salesforce/apex/DefaultsController.updateCompanyData';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CompanySetup extends LightningElement {
    isLoading = false;
    fieldsChanged = false;
    orgFields = {};
    connectedCallback(){
        this.fetchCompanyData();
    }
      fetchCompanyData(){
        this.isLoading = true;
        getCompanyData()
        .then(res => {
            this.isLoading = false;
            this.orgFields = res;
        })
        .catch(err => {
            console.error(err);
            this.isLoading = false;
            if(err.body && err.body.message){
                this.createToast("Error",err.body.message,"error");
            }
        })
      }
      handleChangeForFields(event){
          let targetName = event.target.name;
          this.fieldsChanged = true;
          switch(targetName) {
            case "orgName" : 
                this.orgFields.orgName = event.detail.value;
            break;
            case "addDetails" : 
                this.orgFields.streetName = event.target.street;
                this.orgFields.cityName = event.target.city;
                this.orgFields.stateName = event.target.province;
                this.orgFields.postalCode = event.target.postalCode;
            break;
          }
      }
      saveCompanyDetails(event){
        this.isLoading = true;
        if(this.checkDataValidity(this.orgFields)){
            saveCompanyData({
                companyString : JSON.stringify(this.orgFields)
            })
            .then(res => {
                this.isLoading = false;
                this.createToast("Success","Updated Organization Details Successfully!","success");
                this.fetchCompanyData();
            })
            .catch(err => {
                this.isLoading = false;
                if(err.body && err.body.message){
                    this.createToast("Error",err.body.message,"error");
                }
            })
        }
        else{
            this.isLoading = false;
            this.createToast("Error","Invalid Data Entered in fields","error");
        }
      }
      checkDataValidity(changedData){
        if(changedData.orgName === '' || changedData.orgName === ' ' || changedData.orgName == undefined){
            return false;
        }
        if(changedData.streetName === '' || changedData.streetName === ' ' || changedData.streetName == undefined){
            return false;
        }
        if(changedData.cityName === '' || changedData.cityName === ' ' || changedData.cityName == undefined){
            return false;
        }
        if(changedData.stateName === '' || changedData.stateName === ' ' || changedData.stateName == undefined){
            return false;
        }
        if(changedData.postalCode === '' || changedData.postalCode === ' ' || changedData.postalCode == undefined){
            return false;
        }
        return true;
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