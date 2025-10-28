import { LightningElement,api } from 'lwc';
import SVG_Illustrations from '@salesforce/resourceUrl/svg_illustrations';

export default class LibMessageWithIllustration extends LightningElement {
    @api title = 'Feature Upgrade Required';
    @api message;
    @api severity  = 'error';
    @api type = 'Security';    
    @api isAppSetupOwner = false;
    get imageUrl() {               
        return SVG_Illustrations + '/empty-state-no-access.svg'; 
    }
    get messageCSS() {               
        return (this.severity == 'error' ? 'slds-text-color_error' : ''); 
    }
}