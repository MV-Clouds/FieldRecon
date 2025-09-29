import { LightningElement, track } from 'lwc';
import checkCostCodeAccess from '@salesforce/apex/TimeSheetReportController.checkCostCodeAccess';
 
export default class SetupAppWizard extends LightningElement {

    @track currentStep = '1';
    click;
    getstarted = true;
    completeSetUp = false;
    costCodeAccess = false;
    showCostCode = false;

    connectedCallback(){
        this.fetchCostCodeAccess();
    }

    fetchCostCodeAccess(){
        checkCostCodeAccess()
        .then(res => {
            this.costCodeAccess = res == null || res == undefined ? false : res;
            this.showCostCode = this.costCodeAccess == true ? true : false;
        })
        .catch(err => {
            if(err && err.body && err.body.message){
                const evnt = new ShowToastEvent({
                    title: 'Error!',
                    message: err.body.message,
                    variant : 'error',
                });
                this.dispatchEvent(evnt);
            }
        })
      }

    handleProgressStep(step){
        this.currentStep = step;
    }

    handleOnStepClick(event) {
        let s =  event.target.value;
        this.handleProgressStep(s);
    }
 
    get IsStep1() {
        return this.currentStep === '1';
    }
 
    get IsStep2() {
        return this.currentStep === '2';
    }
 
    get IsStep3() {
        return this.currentStep === '3';
    }

    get IsStep4() {
        return this.currentStep === '4'
    }

    get isEnableNext() {
        return this.currentStep != '4';
    }
 
    get isEnablePrev() {
        return this.currentStep != '1';
    }
 
    get isEnableFinish() {
        return this.currentStep === '4';
    }
    
    handleClick(){
        this.click = true;
        this.getstarted = false;
    }
    
    handleNext(){
        if(this.currentStep == '1'){
            this.handleProgressStep('2');
        }
        else if(this.currentStep == '2'){
            if(this.showCostCode == false){
                this.handleProgressStep('4');
            }else{
                this.handleProgressStep('3');        
            }
        }
        else if(this.currentStep == '3'){
            this.handleProgressStep('4');
        }
        console.log('currentStep' +this.currentStep);
    }
 
    handlePrev(){
        if(this.currentStep == '4'){
            if(this.showCostCode == false){
                this.currentStep = '2';
            }else{
                this.currentStep = '3';
            }
        }
        else if(this.currentStep == '3'){
            this.currentStep = '2';
        }
        else if(this.currentStep == '2'){
            this.currentStep = '1';
        }
    }

    handleFinish(){
        this.completeSetUp = true;
        this.click = false;

    }   
}