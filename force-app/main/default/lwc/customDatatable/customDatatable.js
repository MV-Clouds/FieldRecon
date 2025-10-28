import { LightningElement } from 'lwc';
import LightningDatatable from 'lightning/datatable';
import clickableLinkTemplate from './clickableLinkTemplate.html';
import buttonGroupTemplate from './buttonGroupTemplate.html';
import picklistTemplate from './picklistTemplate.html';

export default class CustomDatatable extends LightningDatatable {
    static customTypes = {
        customClickableLink: {
            template: clickableLinkTemplate,
            typeAttributes: ['id', 'name']
        },
        customButtonGroup : {
            template : buttonGroupTemplate,
            typeAttributes : ['id','status']
        },
        picklist : {
            template : picklistTemplate,
            typeAttributes : ['id','selectedVal']
        }
    };
}