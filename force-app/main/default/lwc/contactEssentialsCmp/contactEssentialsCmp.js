import { api, LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ContactEssentialsCmp extends LightningElement {
    @api contactObj;
    selectedProfile;
    selectedStep = 1;
    options = [];

    fieldChangeHandler(event){
        let targetName = event.target.name;
        let targetValue = event.target.value;
        let changesForContactObj = JSON.parse(JSON.stringify(this.contactObj));
        switch(targetName) {
            case "fName":
                changesForContactObj["firstName"] =  targetValue;
                break;
            case "lName" : 
                changesForContactObj["lastName"] =  targetValue;
                break;
            case "emailCon" : 
                changesForContactObj["email"] =  targetValue;
                break;
            case "telCon" : 
                changesForContactObj["tel"] =  targetValue;
                break;
        }
        this.contactObj = changesForContactObj;
    }

    handleNextStep(event){
        let fnameData = this.validateUserData(this.contactObj["firstName"],"First Name");
        if(!fnameData) {return;}
        let lnameData = this.validateUserData(this.contactObj["lastName"],"Last Name");
        if(!lnameData) {return;}
        let emailData = this.validateUserData(this.contactObj["email"],"Email");
        if(!emailData) {return;}
        let telData = this.validateUserData(this.contactObj["tel"],"Phone");
        if(!telData) {return;}
        if(fnameData && lnameData && emailData && telData){
            const changePageEvent = new CustomEvent("nextpage",{
                detail : this.contactObj
            });
          
              // Dispatches the event.
              this.dispatchEvent(changePageEvent);
        }
    }
    validateUserData(dataByUser,label){
        if(dataByUser == null || dataByUser == undefined || dataByUser == ''){
            this.createToast("Error","Insufficient Data for "+ label,"error");
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