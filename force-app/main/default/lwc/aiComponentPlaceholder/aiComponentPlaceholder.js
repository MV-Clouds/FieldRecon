import { LightningElement, api } from 'lwc';

// Note: Change namespace "c" to relevant namespace before moving to package
let NAMESPACE = 'c';
// set namespace from url parameter in emergency cases or for development purpose...
let params = new URLSearchParams(window.location.search);
if(params.get('fr_ai_namespace') === 'c' || window.location.hash == '#fr_ai_namespace=c') NAMESPACE = 'c';

export default class AiComponentPlaceholder extends LightningElement {

    @api componentName;     // component component you want to render
    @api props = {};        // params to pass to the component

    // Constructor
    COMPONENT_CONSTRUCTOR;

    get component(){
        return {[this.componentName] : true};
    }

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

    // Send "onmessage" to field recon component...
    // Always send message with onmessage....
    handleAIComponentMessage(event){
        let detail = event.detail ?? {};
        this.dispatchEvent(new CustomEvent('message', { detail }));
    }

}