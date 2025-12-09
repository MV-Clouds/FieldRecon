import { LightningElement, api, track } from 'lwc';

let NAMESPACE = 'c';

export default class AiComponentInjector extends LightningElement {

    @api componentName;
    @api props = {};

    COMPONENT_CONSTRUCTOR;

    connectedCallback(){

        console.log('componentName : ', this.componentName);
        console.log('props : ', this.props);
        
        let importState = this.componentMap[this.componentName];
        if(!importState) return;

        importState()
        .then(({default: ctor} )=> {
            this.COMPONENT_CONSTRUCTOR = ctor;
        })
        .catch(error => {
            console.log('Error importing component: ', error.message);
        })
    }

    componentMap = {
        'generateJobSummary' :  NAMESPACE != 'c' ? (() => import('wfrecon/generateJobSummary')) : (() => import('c/generateJobSummary')) ,
        'collectWorkLogs' :     NAMESPACE != 'c' ? (() => import('wfrecon/collectWorkLogs')) : (() => import('c/collectWorkLogs')) ,
        'aIAdminDashboard' :    NAMESPACE != 'c' ? (() => import('wfrecon/aIAdminDashboard')) : (() => import('c/aIAdminDashboard')) ,
        'promptEditor' :        NAMESPACE != 'c' ? (() => import('wfrecon/promptEditor')) : (() => import('c/promptEditor')) ,
        'shiftEndLogV2' :       NAMESPACE != 'c' ? (() => import('wfrecon/shiftEndLogV2')) : (() => import('c/shiftEndLogV2')) ,
    }


}