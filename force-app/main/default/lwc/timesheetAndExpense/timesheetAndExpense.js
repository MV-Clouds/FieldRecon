import { LightningElement } from 'lwc';
import checkSecondLevelAccess from '@salesforce/apex/TimeSheetReportController.checkSecondLevelAccess';
import FORM_FACTOR  from '@salesforce/client/formFactor';


export default class timesheetAndExpense extends LightningElement {
    secondLevelAccess = false;
    isLoading = false;
    formFactor = true;
    get tabsetVariant(){
        console.log('hi');
        switch(FORM_FACTOR) {
            case 'Large':
                return 'vertical';
                
            case 'Medium':
                return 'scoped';
                
            case 'Small':
                this.formFactor = false;
                return 'standard';
                
            default:
        }

    }
    connectedCallback(){
        this.getSecondLevelAccess();
    }
    getSecondLevelAccess(){
        this.isLoading = true;
        checkSecondLevelAccess()
        .then(res => {
            this.secondLevelAccess = res;
            this.isLoading = false;
        })
        .catch(err => {
            this.isLoading = false;
            this.secondLevelAccess = false;
        })
    }
}