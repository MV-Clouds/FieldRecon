import { api, LightningElement,track } from 'lwc';
import { CloseActionScreenEvent } from 'lightning/actions';
import initialShiftEndLog from '@salesforce/apex/ShiftEndLogController.initialShiftEndLog';
import LibBaseElement from 'c/libBaseElement';
export default class ShiftEndLog extends LibBaseElement {
    @api recordId;
    @track isLoading = false;
    @track shiftEndLogData = {processUpdated:false,materialUsage:false,timeEntries:false,travelLog:false,workPerformed:'',workPerformedDate:'',tomorrowsPlan:''};

    handleToggleChange(event){
        this.shiftEndLogData[event.target.name] = event.target.checked;
    }
    saveAction(){
        let wokPerformed = this.template.querySelector('.workPerformed');
        let workDate = this.template.querySelector('.workPerformedDate')
        let hasError = false;
        if(workDate.value.trim() === ''){
            hasError=true;
            this.showError(workDate,'Please Complete this field');
        }else{
            this.removeError(workDate);
        }
        if(wokPerformed.value && wokPerformed.value.trim() === ''){
            hasError=true;
            this.showError(wokPerformed,'Please Complete this field');
        }else{
            this.removeError(wokPerformed);
        }
        if(hasError === true) return;

        this.shiftEndLogData.workPerformed = wokPerformed.value;
        this.shiftEndLogData.workPerformedDate = workDate.value;
        this.shiftEndLogData.tomorrowsPlan = this.template.querySelector(".tomorrowsPlan").value || '';
        this.isLoading=true;
        this.doCall(this.shiftEndLogData);
    }
    async doCall(data){
        try{
            let response = await this.remoteCall(initialShiftEndLog,{jobId:this.recordId,jsonData:JSON.stringify(data)},true);
            this.toast.success('Shift End log has been created!');
            this.closeAction();
        }catch(error){
            this.toast.error(error.message);
        }finally{
            this.isLoading = false;
        }
    }
    closeAction(){
        //this.dispatchEvent(new CloseActionScreenEvent());
        this.dispatchEvent(new CustomEvent('closebox'));
    }   
}