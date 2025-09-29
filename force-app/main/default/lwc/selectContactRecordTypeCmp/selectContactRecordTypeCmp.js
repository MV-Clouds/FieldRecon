import { api, LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';


export default class SelectContactRecordTypeCmp extends LightningElement {
    @api contactObj;
    @api userProfiles;
    value = '';
    
    get hasUserLogin(){
        return this.contactObj.canLogInOut == null || this.contactObj == null || this.contactObj.canLogInOut == false ? false : true;
    }

    handleFieldChange(event){
        let targetName = event.target.name;
        let targetValue = event.detail.value == null ? event.detail.checked : event.detail.value;
        let changesForContactObj = JSON.parse(JSON.stringify(this.contactObj));
        switch(targetName) {
            case "logInOut":
                changesForContactObj["canLogInOut"] =  targetValue;
                break;
            case "schd" : 
                changesForContactObj["schd"] =  targetValue;
                break;
            case "prof" : 
                changesForContactObj["prof"] =  targetValue;
                break;
        }
        this.contactObj = changesForContactObj;
    }

    updateRecordType(event){
        const selectedOption = event.detail.value;
        contactObj['recordType'] = selectedOption;
    }
    handlePreviousStep(event){
        console.log(event);
        const changePageEvent = new CustomEvent("prevpage");
      
          // Dispatches the event.
          this.dispatchEvent(changePageEvent);
    }
    addContact(){
        let logInData = this.validateUserData(this.contactObj["canLogInOut"],"First Name");
        if(!logInData) {
            this.contactObj = JSON.parse(JSON.stringify(this.contactObj));
            this.contactObj["canLogInOut"] = false;
        }
        let schdData = this.validateUserData(this.contactObj["schd"],"Last Name");
        if(!schdData) {
            this.contactObj = JSON.parse(JSON.stringify(this.contactObj));
            this.contactObj["schd"] = false;
        }
        let profData = this.validateUserData(this.contactObj["prof"],"Profile");
        if(!profData && logInData) {
            this.createToast("Error","Insufficient Data for Profile","error");
            return;}
        const saveContactEvent = new CustomEvent("savedetails",{
            detail : this.contactObj
        });
      
          // Dispatches the event.
          this.dispatchEvent(saveContactEvent);
    }
    validateUserData(dataByUser,label){
        if(dataByUser == null || dataByUser == undefined || dataByUser == ''){
            //this.createToast("Error","Insufficient Data for "+ label,"error");
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