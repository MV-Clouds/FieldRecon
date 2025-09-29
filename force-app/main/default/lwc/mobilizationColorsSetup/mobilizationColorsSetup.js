import { LightningElement, track ,api } from 'lwc';
import fetchPicklistValues  from '@salesforce/apex/DefaultsController.fetchPicklistValues';
import updatePicklist  from '@salesforce/apex/DefaultsController.updatePicklist';
import deletePicklistValues from '@salesforce/apex/DefaultsController.deletePicklistValues';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import FORM_FACTOR  from '@salesforce/client/formFactor';


export default class MobilizationColorsSetup extends LightningElement {
    isLoading = false;
    @track mobilizationStatus = [];
    mobsStatusMap = {};
    mobsChangedMap = {};
    @track newPickListValues = [];

    get className1(){
        switch(FORM_FACTOR) {
            case 'Large':
                return 'status';
                
            case 'Small':
                return 'statusform';
                
            default:
        }
    }

    get className2(){
        switch(FORM_FACTOR) {
            case 'Large':
                return 'textcolor';
                
            case 'Small':
                return 'textcolorform';
                
            default:
        }
    }

    get className3(){
        switch(FORM_FACTOR) {
            case 'Large':
                return 'backgroundcolor';
                
            case 'Small':
                return 'backgroundcolorform';
                
            default:
        }
    }


    get isDataToSave() {
        return Object.keys(this.mobsChangedMap).length > 0 || this.newPickListValues.length > 0;
    }

    connectedCallback() {
        this.getGlobalPicklistValues();
    }

    getGlobalPicklistValues() {
        this.isLoading = true;
        fetchPicklistValues()
        .then((res) => {
            if(res) {
                this.mobilizationStatus = res;
                this.mobilizationStatus.forEach((ele) => {
                    ele['edit'] = false;
                    this.mobsStatusMap[ele.apiName] = ele;
                    if(ele.idOfRecord == null) {
                        this.mobsChangedMap[ele.apiName] = ele;
                    }
                });
            }
            console.log(this.mobsChangedMap);
            this.isLoading = false;
        })
        .catch((err) => {
            if(err && err.body && err.body.message){
                console.log(err);
                this.createToastMessage("Error!",err.body.message,"error");
            }
            this.isLoading = false;
        })
    }

    updateValues() {
        this.isLoading = true;
        var arrayOfVals = Object.values(this.mobsChangedMap);
        arrayOfVals.push(...this.newPickListValues);
        console.log(arrayOfVals);
        arrayOfVals = JSON.stringify(arrayOfVals);
        console.log(arrayOfVals);
        updatePicklist({
            newPickListValues : arrayOfVals
        })
        .then((res) => {
            console.log(res);
            this.getGlobalPicklistValues();
            this.mobsChangedMap = {};
            this.newPickListValues = [];
            this.createToastMessage("Success!","The default colors have been updated","success");
        })
        .catch((err) => {
            this.isLoading = false;
            if(err && err.body && err.body.message){
                console.log(err);
                this.createToastMessage("Error!",err.body.message,"error");
            }
        })
    }

    updateRowNameToEdit(event) {
        console.log(event.target);
        let rowToEdit = event.target.title;
        for(let row of this.mobilizationStatus) {
            if(row.apiName == rowToEdit) {
                row['edit'] = true;
                break;
            }
        }
    }
    handleEditCells(event) {
        let rowIndex = event.currentTarget.dataset.index;
        let newValue = event.target.value;
        let keyToChange = event.target.title;
        let pickValueChange = this.mobilizationStatus[rowIndex];
        if(this.mobsChangedMap[pickValueChange['apiName']] != null) {
            let oldValues = this.mobsChangedMap[pickValueChange['apiName']];
            oldValues[keyToChange] = newValue;
            this.mobsChangedMap[pickValueChange['apiName']] = oldValues;
        }
        else{
            pickValueChange[keyToChange] = newValue;
            this.mobsChangedMap[pickValueChange['apiName']] = pickValueChange;
        }
        console.log(this.mobsChangedMap);
    }
    handleDeleteValue(event){
        this.isLoading = true;
        let labelName = event.target.value;
        let mobObj = {};
        mobObj = this.mobilizationStatus.filter(ele => {
            if(ele.statusName == labelName){
                return ele;
            }
        });
        console.log(mobObj[0]);
        deletePicklistValues({
            valueToDelete : JSON.stringify(mobObj[0])
        })
        .then(res => {
            this.isLoading = false;
            this.createToastMessage("Success!","Value Successfully deleted!","success")
            this.getGlobalPicklistValues();
        })
        .catch(err => {
            this.isLoading = false;
            if(err && err.body && err.body.message){
                console.log(err);
                this.createToastMessage("Error!",err.body.message,"error");
            }
        })
    }
    handleNewCells(event) {
        let rowIndex = event.currentTarget.dataset.index;
        let newValue = event.target.value;
        let keyToChange = event.target.title;
        let newVal = this.newPickListValues[rowIndex];
        newVal[keyToChange] = newValue;
        this.newPickListValues[rowIndex] = newVal;
        console.log(newVal);
    }
    handleNewRow(event) {
        let newTempObj = {};
        newTempObj['statusName'] = '';
        newTempObj['color'] = '#000000';
        newTempObj['bkColor'] = '#FFFFFF';
        this.newPickListValues.push(newTempObj);
    }
    handleDeleteNewValue(event){
        let rowIndex = event.currentTarget.dataset.index;
        this.newPickListValues.splice(rowIndex,1);
    }
    cancelChanges(event) {
        this.newPickListValues = [];
        this.getGlobalPicklistValues();
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