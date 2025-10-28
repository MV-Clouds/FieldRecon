import { LightningElement,wire,api } from 'lwc';
import ACCOUNT_OBJECT from '@salesforce/schema/Account';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import TIMEZONESIDKEYFIELD from '@salesforce/schema/User.TimeZoneSidKey';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CustomDatatablePicklist extends LightningElement {
    isEditable = false;
    hasData = true;
    queryTerm;
    timeZoneOptions = [];
    listOfSearchRecords = [];
    @api label = '';
    @api name = '';
    @api required;
    @api placeholder = '';
    @api rowId;
    initialized = false;
    @api selectedTimeZone;
    @wire(getObjectInfo, { objectApiName: ACCOUNT_OBJECT })
    objectInfo;
    @wire(getPicklistValues,{
        recordTypeId: '$objectInfo.data.defaultRecordTypeId', 
        fieldApiName: TIMEZONESIDKEYFIELD
    })
    StatusPicklistValues({data,error}){
        if(data){
            var res = [...data.values];
            this.timeZoneOptions = res;
        }
        if(error){
            console.log(error.message);
            this.createToastMessage("An Error Occured",error.message,"error");
        };
    };
    convertPick(event){
        this.isEditable = true;
    }
    convertToText(event){
        this.isEditable = false;
    }
    setSearchTerm(event){
        //const isEnterKey = event.keyCode === 13;
        const isEnterKey = true;
        if (isEnterKey) {
            this.queryTerm = event.target.value;
            this.queryTerm = this.queryTerm.toLowerCase();
            this.searchValues();
        }
    }
    searchValues(){
        var options = JSON.parse(JSON.stringify(this.timeZoneOptions));
        this.listOfSearchRecords = options.filter(ele => {
            if(ele.value.toLowerCase().includes(this.queryTerm) || ele.label.toLowerCase().includes(this.queryTerm)) {
                return ele;
            }
        })
        if(this.listOfSearchRecords.length == 0){
            this.hasData = false;
        }
        else{
            this.hasData = true;
        }
    }
    selectRecord(event){
        console.log(event);
    }
    convertToText(event){
        this.isEditable = false;
    }
    handleSelect(event){
        console.log(event.target.title);
        console.log(event.target.dataset.label);
        var valueOfTz = event.target.title == "" ? event.target.dataset.value : event.target.title;
        this.dispatchEvent(
            new CustomEvent("picklistchange",{
                composed: true,
                bubbles: true,
                cancelable: true,
                detail : {
                    elementId : this.rowId,
                    name :valueOfTz
                }
            })
        );
        this.listOfSearchRecords = [];
        this.isEditable = false;
        this.selectedTimeZone = valueOfTz;
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