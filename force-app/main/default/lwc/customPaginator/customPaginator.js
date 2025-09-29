import { LightningElement, api, track,  } from 'lwc';

export default class CustomPaginator extends LightningElement {
    allrecordids;
    currentpage=1;

    @api 
    get allRecordIds() {
        return this.allrecordids;
    }
    set allRecordIds(val) {
        this.allrecordids = val;
        this.navigate();
    }

    @api 
    get currentPage() {
        return this.currentpage;
    }
    set currentPage(val) {
        this.currentpage = val;
        this.navigate();
    }

    @api pageSize=4;
    
    connectedCallback(){
        this.navigate();
    }
    get totalRecords(){
        return this.allrecordids.length;
    }
        
    get currentPageNo(){
        return this.currentpage;
    }

    get totalPages(){
        return Math.ceil(this.allrecordids.length/this.pageSize);
    } 
    
    get isThereNoRecordsId(){
        return Math.ceil(this.allrecordids.length/this.pageSize)===this.currentpage;
    }

    get pageIsOne(){
        return this.currentpage == 1;    
    }
    
    @api
    navigate(){   
        let startIndex = this.getStartIndex();
        let endIndex = this.getEndIndex();
        let recordIdsToDisplay = this.allrecordids.slice(startIndex, endIndex);
        const cmpEvent = CustomEvent("pagechanged", {detail : {
                recordIdsToDisplay: recordIdsToDisplay,
                currentPage: this.currentpage
            }
        });
        this.dispatchEvent(cmpEvent);
    }

    getStartIndex() {
        return (this.currentpage - 1) * this.pageSize;
    }

    getEndIndex() {
        return (this.currentpage * this.pageSize);
    }
    
    handleNavigation(event){
        var direction = event.currentTarget.value;
        //if user click on next button
        if(direction === 'next') {            
            this.currentpage += 1;
        } else {            
            this.currentpage -= 1;
        }              
        this.navigate();

    }
    @api setupDownload(pageSize) {
        this.pageSize = pageSize;
        this.navigate();
    }

}