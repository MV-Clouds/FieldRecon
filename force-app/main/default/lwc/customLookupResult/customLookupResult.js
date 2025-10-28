import { LightningElement, api } from 'lwc';

export default class CustomLookupResult extends LightningElement {
    @api oRecord;
    @api fieldName;
    
    selectRecord(){
        const selectedEvent = new CustomEvent("selected", {
            detail: this.oRecord
        });
        this.dispatchEvent(selectedEvent);
    }

    get label() {
        let fieldName = 'Name';
        if(this.fieldName) {
            fieldName = this.fieldName;
        }
        return this.oRecord[fieldName];
    }

}