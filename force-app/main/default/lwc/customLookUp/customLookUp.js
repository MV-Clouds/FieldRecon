import { LightningElement, api, track } from 'lwc';
import getRecordName from '@salesforce/apex/Lib_CustomLookup_Ctrl.getRecordName';
import fetchLookUpValues from '@salesforce/apex/Lib_CustomLookup_Ctrl.fetchLookUpValues';
import { loadStyle } from 'lightning/platformResourceLoader';
import customResource from '@salesforce/resourceUrl/customResources';
import LibBaseElement from 'c/libBaseElement';

 export default class CustomLookUp extends LibBaseElement {
    @api isSearchTextValid;
    @api value;
    @api objectAPIName;
    @api fieldsToSearch;
    @api iconName = 'standard:user';
    @api label;
    @api readOnly;
    @api labelFieldName;
    @api required;
    @api labelHidden = false;
    @api placeholder = 'search..';
    @api objData;   
    @api soqlFilter;
    @track SearchKeyWord;
    @track selectedRecord = {};
    @track listOfSearchRecords;
    @track Message;
    @track errors;


    renderedCallback() {

        Promise.all([
            loadStyle(this, customResource + '/pillStyling.css')
        ])
            .then(() => {
                //why we are using empty then and catch?
            })
            .catch(error => {
            });
    }

    connectedCallback(){
        this.isSearchTextValid=true;
        if(this.value){
            this.doInit();
        }
    }
    doInit() {
        this.getRecordName();
    }
    async getRecordName(){
        try{
            let result =await this.remoteCall(getRecordName,{'id': this.value,
                                                                'objectName' : this.objectAPIName},true);
                this.handleComponentEvent(result);
        } catch(error){
            this.errorDetails = error;
        }
    }
    onfocus(){
        this.spinner.show();
        let forOpen = this.template.querySelector('.searchRes');
        forOpen.classList.add('slds-is-open');
        forOpen.classList.remove('slds-is-close');  
        this.searchHelper(this.SearchKeyWord || "");
    }

    mouseBlur(event){
        setTimeout(() => {  
          this.onHoverOut(event);
        },200);
    }
   
    onHoverOut(event){
        let bool = false;
        let searchKeyWord = this.template.querySelector('.searchText').value;
        let searchText = this.template.querySelector('.searchText');
        let searchIconn =  this.template.querySelector('.searchIcon');
        let userClass = this.template.querySelector('.user');
        var valueAfterBlur;
        if(searchKeyWord)
        {
            if(this.listOfSearchRecords){
                this.listOfSearchRecords.forEach(function(item){
                    if(item.Name.toLowerCase().trim() === searchKeyWord.toLowerCase().trim()){
                        bool = true;
                        valueAfterBlur=item;
                    }
                });
            }
            if(bool === false && searchKeyWord.length > 0){
                searchIconn.classList.add('slds-p-bottom_medium');
                userClass.classList.add('slds-p-bottom_medium');
                this.showError(searchText,'Please select a valid user!');
                this.listOfSearchRecords = null;
                let forclose = this.template.querySelector('.searchRes');
                forclose.classList.add('slds-is-close');
                forclose.classList.remove('slds-is-open');    
            }else{
                this.handleComponentEvent(valueAfterBlur);
                searchIconn.classList.remove('slds-p-bottom_medium');
                userClass.classList.remove('slds-p-bottom_medium');
                this.removeError(searchText);
            }  
        }
        else{
            bool = true;
            searchIconn.classList.remove('slds-p-bottom_medium');
            userClass.classList.remove('slds-p-bottom_medium');
            this.removeError(searchText);
                this.listOfSearchRecords = null;
                let forclose = this.template.querySelector('.searchRes');
                forclose.classList.add('slds-is-close');
                forclose.classList.remove('slds-is-open'); 
        }
        this.isSearchTextValid = bool;    
    }
   
    keyPressController(event) {
        var getInputkeyWord = event.target.value;
        if( getInputkeyWord.length > 0 ){
            let forOpen = this.template.querySelector('.searchRes');
            forOpen.classList.add('slds-is-open');
            forOpen.classList.remove('slds-is-close');
            this.searchHelper(getInputkeyWord);
        }
        else{  
            this.listOfSearchRecords = null;
            let forclose = this.template.querySelector('.searchRes');
            forclose.classList.add('slds-is-close');
            forclose.classList.remove('slds-is-open');
        }
    }
    searchHelper(getInputkeyWord) {
        this.fetchLookUpValues(getInputkeyWord);
    }
    async fetchLookUpValues(getInputkeyWord){
        try{
            let result =await this.remoteCall(fetchLookUpValues,{
                                                                'searchKeyWord': getInputkeyWord,
                                                                'objectName' : this.objectAPIName,
                                                                'fieldName' : this.fieldsToSearch,
                                                                'soqlFilterImplName' : this.soqlFilter || null},true);
                var response = result;
                if (response.length === 0) {
                    this.Message = 'No Result Found...';
                } else {
                    this.Message = '';
                    this.spinner.hide();
                }
                this.listOfSearchRecords = response;
        } catch(error){
            this.errorDetails = error;
        }
    }

    clear(){
        let pillTarget = this.template.querySelector('.lookup-pill');
        pillTarget.classList.add('slds-hide');
        pillTarget.classList.remove('slds-show');
        let lookUpTarget = this.template.querySelector('.lookupField');
        lookUpTarget.classList.add('slds-show');
        lookUpTarget.classList.remove('slds-hide');
        let searchIcon = this.template.querySelector('.searchIcon');
        searchIcon.classList.add('slds-show');
        searchIcon.classList.remove('slds-hide');
        this.SearchKeyWord = null;
        this.listOfSearchRecords =  [];
        this.selectedRecord ={};   
        this.value =  '';
        
        const detail={role:this.objData, selectedSObject: {}};
        const lookupChange = new CustomEvent('lookupchanged',{detail});
        this.dispatchEvent(lookupChange);
    }

    handleComponentEvent(selectedVal) { 
        let forclose = this.template.querySelector('.lookup-pill');
        forclose.classList.add('slds-show');
        forclose.classList.remove('slds-hide');
        forclose = this.template.querySelector('.searchRes');
        forclose.classList.add('slds-is-close');
        forclose.classList.remove('slds-is-open');
        let lookUpTarget = this.template.querySelector('.lookupField');
        lookUpTarget.classList.add('slds-hide');
        lookUpTarget.classList.remove('slds-show');
        let searchIcon = this.template.querySelector('.searchIcon');
        searchIcon.classList.add('slds-hide');
        searchIcon.classList.remove('slds-show');
        this.SearchKeyWord= '';
        this.value= selectedVal.Id;
        this.selectedRecord=  selectedVal;
        const detail={role:this.objData,selectedSObject:selectedVal};
        const lookupChange = new CustomEvent('lookupchanged',{detail});
        this.dispatchEvent(lookupChange);
    }

    handleLookupResultEvent(event){
        const selectedRecordName = event.detail;
        this.handleComponentEvent(selectedRecordName);
    } 
}