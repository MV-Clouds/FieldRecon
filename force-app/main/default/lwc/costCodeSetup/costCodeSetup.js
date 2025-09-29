import { LightningElement , track} from 'lwc';
import getCostCodeList from '@salesforce/apex/CostCodeHelper.getCostCodeRecords';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
export default class LightningDatatableLWCExample extends LightningElement {

    @track error;
    @track ccList ;
    ccName;
    ccClassificationType;
    ccDefaultCostCode;
    ccObjectName;
    @track isModalOpen = false;
    @track loader = true;
    @track isLoading = true;
    pageSize = 25;
    @track hasDataToDisplay=false;
    @track currentPage = 1;
    @track isDisplayNoRecords = false;
    
    
    @track columns = [{
            label: 'Cost Code',
            fieldName: 'costCodeName',
            type: 'text',
            hideDefaultActions: true,
           
        },
        {
            label: 'Classification Type',
            fieldName: 'classificationType',
            type: 'text',
            hideDefaultActions: true,

        },        
        {
            label: 'Default Cost Code',
            fieldName: 'defaultCostCode',
            type: 'boolean',
            hideDefaultActions: true,

        }];
 

    connectedCallback(){
       this.getCodes();
        
    }
    
    getCodes(){
        
        getCostCodeList()
        .then(result => {
            var data = JSON.parse(result);
            this.ccList = data.costCodeWrapper;
            this.ccName = data.namespaceCostCodeName;
            this.ccClassificationType = data.namespaceClassificationField;
            this.ccDefaultCostCode = data.namespaceDefaultCostCode;
            this.ccObjectName = data.namespaceObjectName;
            this.hasDataToDisplay = this.ccList.length > 0 ? true : false;
            this.isDisplayNoRecords = !this.hasDataToDisplay;
            this.loader = false;
            console.log(JSON.stringify(this.ccList));
            console.log(JSON.stringify(this.namespace));
        })
        .catch(error => {      
            this.loader = true;      
            this.error = error;
        })
    }

   /* get isDisplayNoRecords() {
        var isDisplay = true;
        if(this.ccList){
            if(this.ccList.length == 0){
                isDisplay = true;
            }else{
                isDisplay = false;
            }
        }
        return isDisplay;
    }*/
    
    handleNew(){
        this.isModalOpen = true;
    }
    closeModal() {
        this.isModalOpen = false
    } 
    handleOnLoad() {
        this.isLoading = false;
    }
    saveMethod(event) {
        event.preventDefault();       // stop the form from submitting
        const fields = event.detail.fields;
        this.template.querySelector('lightning-record-edit-form').submit(fields);
        this.closeModal();
    }
    handleSuccess(event){
        const updatedRecord = event.detail.id;
        console.log('onsuccess: ', updatedRecord);
        const evnt = new ShowToastEvent({
            title: 'Success!',
            message: 'Cost Code created!!',
            variant : 'success',
        });
        this.dispatchEvent(evnt);
        
        this.closeModal();
        this.getCodes();
    }

    onPageChanged(e){
        this.currentPage = e.detail.currentPage;
    }
}