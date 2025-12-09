import { LightningElement, api } from 'lwc';

// Note: Change namespace "c" to relevant namespace before moving to package
let NAMESPACE = 'c';

export default class AiComponentPlaceholder extends LightningElement {

    @api componentName;     // component component you want to render
    @api props = {};        // params to pass to the component

    // Constructor
    COMPONENT_CONSTRUCTOR;

    connectedCallback(){

        // Import the component constructor
        this.importStatement()
        .then(({default: ctor} )=> {
            this.COMPONENT_CONSTRUCTOR = ctor;
        })
        .catch(error => {
            console.log('Error To Import AI component: ', error.message);
        })
    }

    importStatement(){
        // Please change the namespace to relevant namespace before moving to package
        return NAMESPACE != 'c' ? import('wfrecon/aiComponentInjector') : import('c/aiComponentInjector'); 
    }

}