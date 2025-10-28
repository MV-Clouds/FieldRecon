import { api, LightningElement } from 'lwc';

export default class CustomDatatableButtonGroup extends LightningElement {
    @api rowId;
    @api rowStatus;

    get isStatusSubmitted(){
        return this.rowStatus == "Submitted" || this.rowStatus == undefined  ? true : false;
    }

    get isStatusApproved() {
        return this.rowStatus == "Approved" ? true : false;
    }


    get isStatusRejected() {
        return this.rowStatus == "Denied" ? true : false;
    }
    get isStatusPaid() {
        return this.rowStatus == "Paid" ? true : false;
    }

    handleButtonClick(event) {
        console.log(event.detail);
        var goto = this.template.querySelector('[data-id="button"]');
        if(goto != null){
            window.scrollTo(0,goto.offsetTop);
        }
        this.dispatchEvent(
            new CustomEvent("buttonclicked",{
                composed: true,
                bubbles: true,
                cancelable: true,
                detail : {
                    elementId : this.rowId,
                    name : event.target.name
                }
            })
        );
    }
}