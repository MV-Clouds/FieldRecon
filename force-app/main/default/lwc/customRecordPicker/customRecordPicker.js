import { LightningElement, api, track, wire } from "lwc";
import { gql, graphql } from "lightning/uiGraphQLApi";

export default class CustomRecordPicker extends LightningElement {

    // ***************************************************************************** //
    // *                             API Attributes           
    // * label              (attribute - label)
    // * multiselect        (attribute - multiselect)                          
    // * searchable         (attribute - searchable)                         
    // * required           (attribute - required)
    // * disabled           (attribute - disabled)                      
    // * showClearButton    (attribute - show-clear-button)                                                     
    // * iconName           (attribute - icon-name)                       
    // * value              (attribute - value)      
    // * dropdownPosition   (attribute - dropdown-position)      
    // * placeholder        (attribute - placeholder) 
    // * hideSearchIcon     (attribute - hide-search-icon)

    // * ====== API Attributes to make "dynamic records fetch" combobox ====
    // *
    // * queryObjectApi         (attribute - query-object-api)      [... Required Attribute ...]     
    // * labelFieldApi          (attribute - label-field-api)
    // * descriptionFieldApi    (attribute - description-field-api)
    // * helptextFieldApi       (attribute - helptext-field-api)
    // * searchByFields         (attribute - search-by-fields)
    // * showFooterButton       (attribute - show-footer-button)
    // * footerButtonLabel      (attribute - footer-button-label)
    // * additionalFields       (attribute - additional-fields)
    // // * tableColumFields       (attribute - table-colum-fields)
    // * filters                (attribute - filters)
    // *

    // ***************************************************************************** //
    // filter formate : - filter formate support array of object...

    //  ---- ---- Filters WITHOUT logical operator it consider AND ----- ---- 

    //  filters = [
    //      {field : 'Name',        operator : 'eq',    value : 'your value'},
    //      {field : 'CreatedDate', operator : 'grq',   value : TODAY}
    //  ];
    
    // ---- ---- Filters WITH custom logical operator  ----- ---- 

    // filters = [
    //     {
    //         or : [
    //             {field : 'Name', operator : 'eq', value : 'your value'}
    //             {field : 'CreatedBy.Name', operator : 'eq', value : 'your other value'}
    //         ]
    //     },
    //     {
    //         {field : 'CreatedDate', operator : 'grq',   value : TODAY}
    //      }
    //
    //  ]

    // TO Understand more about logical operator and filter operator please visit : https://developer.salesforce.com/docs/platform/graphql/guide/filter-fields.html
    // Or read the graphQL filter from salesforce graphQL in lwc blog ...
    // ***************************************************************************** //
        
        

    // * =========== dispatch events ============ 
    // *
    // * change (onchange)                          -- Trigger when user select or remove selected option
    // * focus (onfocus)                            -- Trigger when user focus in input for searchable combo
    // * blur (onblur)                              -- Trigger when user blur from input for searchable combo
    // * search (onsearch)                          -- Trigger when user search value in input for searchable combo
    // * error (onerror)                            -- Trigger when graphQL trow any error
    // * ready (onread)                             -- Trigger when first time data load successfully
    // * clickfooterbutton (onclickfooterbutton)      -- Trigger when click on footer button
    // *

    // ******** API Functions / Method -- Used from parent component...
    // * unselectOption     (method)                             
    // * clearValue         (method)                        
    // * resetValue         (method)                         
    // * isInvalidInput     (method)
    // *
    // ***************************************************************************** //

    _label;
    @api get label(){ return this._label }
    set label(value){ this._label = value }

    // define comboBox is multi-select or no˚°°°...
    isMultiSelect;      
    @api get multiselect(){ return this.isMultiSelect };
    set multiselect(value){ this.isMultiSelect = (value == 'true' || value == true) ? true : false };

    // define comboBox is searchable or not... BY DEFAULT it is searchable...
    isSearchable = true;                 
    @api get searchable(){ return this.isSearchable};
    set searchable(value){ this.isSearchable = (value == 'false' || value == false) ? false : true };

    // define comboBox is required or not...
    isRequired;                 
    @api get required(){ return this.isRequired };
    set required(value){ this.isRequired = (value == 'true' || value == true) ? true : false};

    _disabled;
    @api get disabled(){ return this._disabled };
    set disabled(value){ this._disabled = (value == 'true' || value == true) ? true : false };

    @track isDisabled = this.disabled;
    @track options;

    // use to displays cross icon once option in selected...
    _showClearButton = true;
    @api get showClearButton(){ return this._showClearButton};
    set showClearButton(value){ this._showClearButton = (value == 'false' || value == false) ? false : true};

    // to Show Hide Option Description...
    get showDescription(){ return this.descriptionFieldApi ? true : false };

    get showHelpText(){ return this.helptextFieldApi ? true : false };
    
    get showOptionIcon(){ return this.iconName ? true : false}
    
    _iconName;
    @api get iconName(){ return this._iconName};
    set iconName(value){ this._iconName = value ? value : this._iconName};

    // use to hide search icon... and show native down arrow...Only for Searchable Combobox
    _hideSearchIcon;
    @api get hideSearchIcon(){ return this._hideSearchIcon};
    set hideSearchIcon(value){ this._hideSearchIcon = (value == 'true' || value == true) ? true : false};

    valueToSet = [];
    @api get value(){ return this.valueToSet };
    @track trackValue = this.value;

    set value(val){
        // console.log('Values us :: ', val);
        
        if(Array.isArray(val)){
            this.valueToSet = val.map(ele => { return ele.trim()} );
        }
        else if( typeof val == 'string'){
            if(val.includes(',')){
                this.valueToSet = val.split(',').map(ele => { return ele.trim()} );
            }
            else{
                this.valueToSet = [val.trim()];
            }
        }else{
            this.valueToSet = [];
        }
        this.trackValue = this.valueToSet;
        if(this.trackValue?.length) this.setDefaultValue();

        // console.log('Track Value is :: ', this.trackValue);
        
    }

    @track setDropDownPosition = '';
    @api get dropdownPosition(){ return this.setDropDownPosition };
    set dropdownPosition(value){
        if(value == 'left'){
            this.setDropDownPosition = this.setDropDownPosition + `
                    right: 0% !important;
                    left: auto !important;
                    transform: translateX(0px);
            `
        }
        else if(value == 'right'){
            this.setDropDownPosition =  this.setDropDownPosition + `
                    left: 0% !important;
                    transform: translateX(0px);
            `
        }
        else{
            // by default drop down set to center
            this.setDropDownPosition = ''
        }
    }

    @api get dropdownTop(){return this.setDropDownPosition };
    set dropdownTop(value){
        if((value == 'true' || value == true)){
            this.setDropDownPosition = this.setDropDownPosition + `
                top: auto !important;
                bottom: 100% !important;
            `
        }
    }

    _placeholder;
    @api get placeholder(){ return this._placeholder };
    set placeholder(value){ 
        this._placeholder = value;
        this.setPlaceHolder();
     }

     // === === object api from where we fetch records === ===
     _queryObjectAPI;
     @api get queryObjectApi(){ return this._queryObjectAPI };
     set queryObjectApi(value){ this._queryObjectAPI = value};

     // === === field api from where we display records label === ===
     _labelField = 'Id';
     @api get labelFieldApi(){ return this._labelField };
     set labelFieldApi(value){ this._labelField = value ? value : this._labelField};

     _recordLabelFieldType = 'text'
     @api get recordLabelFieldType(){return this._recordLabelFieldType};
     set recordLabelFieldType(value){ this._recordLabelFieldType === value ? value : this._recordLabelFieldType};

     // === === field api from where we display records description === ===
     _descriptionField;
     @api get descriptionFieldApi(){ return this._descriptionField };
     set descriptionFieldApi(value){ this._descriptionField = value };

    // === === field api from where we display records helptext === ===
    _helptextField;
    @api get helptextFieldApi(){ return this._helptextField };
    set helptextFieldApi(value){ this._helptextField = value };

    // === === searchByFields from where we search records === ===
    _searchFields = [];
    @api get searchByFields(){ return this._searchFields };
    set searchByFields(value){
        if(typeof value == 'object'){
            // if searchByFields are defied in array....
            this._searchFields = value.map(ele => {return ele.trim()});                     // trim() to remove white space...
        }
        else if(typeof value == 'string'){
            if(value.includes(',')){
                // if searchByFields are defied by comma separated string....
                this._searchFields = (value.split(',')).map(ele => {return ele.trim()});    // trim() to remove white space...
            }
            else{
                // if searchByFields is single field....
                this._searchFields = [value.trim()];                                        // trim() to remove white space...
            }
        }
    }

    // === === Addition field to add in query and fetched record...
    _additionalFields
    @api get additionalFields(){ return this._additionalFields };
    set additionalFields(value){
        if(Array.isArray(value)){
            this._additionalFields = value.map(ele => { return ele.trim() });
        }
        else if( typeof value == 'string'){
            if(value.includes(',')){
                this._additionalFields = value.split(',').map(ele => { return ele.trim() });
            }
            else{
                this._additionalFields = [value.trim()];
            }
        }
    }
    
    _filters = [];
    @api get filters(){ return this._filters};
    set filters(value){ this._filters = value ? value : this._filters}

    // == == used to show / hide view all button === ===
    _showFooterButton;
    @api get showFooterButton(){ return this._showFooterButton }
    set showFooterButton(value){ this._showFooterButton = (value == 'true' || value == true) ? true : false}

    // == == used to change footer button label === ===
    _footerButtonLabel = 'View All';
    @api get footerButtonLabel(){ return this._footerButtonLabel };
    set footerButtonLabel(value){ this._footerButtonLabel = value ? value : this._footerButtonLabel; };
    
    @track placeholderText = ''             // to set placeholder in markup as per multi select options
    
    @track displayOptions = [];              // to display option in dropdown
    @track selectedOptions = [];              // to set store and send selected option to parent component
    @track selectedOptionLabel = null;      // to display selected option in markup (for single select)

    @track searchedValue = '';              // to dynamic record fetch based on search key...
    @track fetchingRecords = true;          // to identify record are fetched or still in process;
    @track isGqlError = false;
    @track filterError = false;

    @track optionsMap = new Map();           // to store options in map for quick access...

    get _selectedOptionLabel(){
        return this.selectedOptionLabel;
    }
    
    get loadStyle(){
        // if combo in searchable, then dropdown button section placed above the back-shadow....
        if(this.searchable){
            return `position: relative;z-index: 11;`;
        }
        // if combo in not searchable, then dropdown button section placed below the back-shadow....
        else{
            return `position: relative;`;
        }
    }

    // to display no result found when search result not found...
    get isOptions(){
        return this.displayOptions.length ? true : false;
    }

    get emptyOptionLabel(){
        if(this.queryObjectApi){
            return  this.fetchingRecords ? 'fetching records...' : 'couldn\'t find any records';
        }
        else{
            return 'Query Object not defined';
        }  
    }

    get gqlErrorMessage(){
        var add = this.filterError ? 'filter' : '';
        return `Records cannot be fetched because of ${add} configuration problem.`
    }

    // * ======== ======= ========== =======  graphQL Logic to get record without apex ========= ============ ========== =========== 
    get gqlQueryString(){
        if(this.queryObjectApi){

            // add label field into search fields if not included....
            !this.searchByFields?.includes(this.labelFieldApi) && this.searchByFields.push(this.labelFieldApi); 

            // Prepare gql Query String for searching....
            var searchingString = ''
            this.searchByFields?.forEach(ele => {
                searchingString += ele.includes('.') ? 
                                        `{ ${ele.split('.')[0]} : { ${ele.split('.')[1]} : { like : $searchedValue }} }\n` :
                                        `{ ${ele} : { like : $searchedValue } } \n`;
            });

            // create graphQL query string for filters...
            var filterString = '';
            filterString = this.generateFilterString();
            if(!filterString && this.filters?.length){
                // If Filter are defined and we it is not in well formate... send undefined and show error message...
                return undefined;
            }
            // If value is set...add Id into filter list to fetch record
            var valueString = ''
            if(this.trackValue?.length){
                valueString += `{ Id : {in : ["${this.trackValue.join('","')}"]}}`;
            }

            // Merge search and filter query to fetch records based on search and filter....
            var filterQuery = '';
            if(this.searchedValue || this.filters?.length || this.trackValue?.length){
                 filterQuery = `where : {
                                            or : [
                                                { and : [
                                                    ${this.searchedValue ? `{ or : [${searchingString}]}, \n`  : ``} 
                                                    ${this.filters?.length ?       `${filterString} \n`     : ``} 
                                                    ${!this.searchedValue && !this.filters?.length ? `{Id: { ne: "" }}` : ``} 
                                                ] }
                                                ${this.trackValue?.length ? valueString : ''}
                                            ]
                                        }`;
            }


            // Create a set of field to query to avoid duplicate fields....
            var fieldToQuery = new Set();
            fieldToQuery.add(this.labelFieldApi);
            this.descriptionFieldApi && fieldToQuery.add(this.descriptionFieldApi);
            this.helptextFieldApi && fieldToQuery.add(this.helptextFieldApi);
            this.additionalFields?.forEach(ele => {
                fieldToQuery.add(ele);
            })
            
            // Prepare Query String for Query fields...
            var queryFieldsString = '';
            fieldToQuery?.forEach(ele => {
                queryFieldsString += this.generateQueryFieldStr(ele);
            })

            // Prepare String for variables...
            var variables = '';
            if(this.searchedValue){
                variables = `( ${this.searchedValue ? '$searchedValue : String!' : '' })`;
            }

            /// ==== === ==== GENERATING main graphQL String to fetch record ==== ==== =====
            return `
            query objectRecords${variables}{
                uiapi {
                    query { 
                        ${this.queryObjectApi}(
                        ${filterQuery}
                        first: 250) {
                            edges {
                                node {
                                    Id
                                    ${queryFieldsString}
                                }
                            }
                        }
                    }
                    objectInfos(apiNames : ["${this.queryObjectApi}"]){
                        ApiName
                        label
                    }
                }
            }`;
        }
        else{
            console.log('CustomRecordPickerV2', 'getter gqlQueryString', {message : 'Object API not defied'}, 'warn');
            return undefined;
        }
    }

    get gqlQuery(){
        return  this.queryObjectApi ? gql`${this.gqlQueryString}` : undefined;
    }

    get gqlVariables(){
        return {
            searchedValue :  `%${this.searchedValue}%`,
        };
    }

    // if queryObjectApi is defined, then and then wire method return proper response...
    @wire(graphql, {
        query: '$gqlQuery',
        variables: '$gqlVariables',
    })
    graphqlQueryResult({ data, errors }) {
        if (data && this.queryObjectApi){
            // When data is available and queryObjectApi is defined...
            this.options = this.modifiedRecordList(data.uiapi.query[this.queryObjectApi].edges.map((edge) => edge.node));
            this.optionsMap = new Map((this.options || []).filter(o => o?.Id).map(o => [o.Id, o]));  // create options map for quick access...
            // THEN set displayOption from fetched records...
            this.setDisplayOptions();
            this.setSelection();
            this.fetchingRecords && (new CustomEvent('ready'))      // once first time data loaded ... fire custom event
            this.fetchingRecords = false;
            this.isGqlError = false;
        }
        if(errors){
            this.errorHandler(errors);
        }    
    }

    errorHandler(error){
        console.log('CustomRecordPickerV2', 'custom combobox graphQL Error', error, 'warn');
        if (typeof window !== 'undefined') {
            this.dispatchEvent(new CustomEvent('error', {detail : error}));
        }
        this.isDisabled = true;
        this.isGqlError = true;
        this.setErrorBorder();
        this.fetchingRecords = false;
    }

    // Prepare gql Query String to fetch field value for given field...
    generateQueryFieldStr(fieldAPI){
        var fieldQueryString = '';
        // IF fieldAPI belongs to parent object field....
        if(fieldAPI?.includes('.')){
            fieldQueryString = `${fieldAPI.split('.')[0]}{ ${fieldAPI.split('.')[1]} {value} } \n`;
        }
        else{
            fieldQueryString = fieldAPI && fieldAPI != '' ? `${fieldAPI} {value} \n` : '';
        }

        return fieldQueryString;
    }

    generateFilterString(){
        try {
            if(typeof this.filters == 'object'){
                var filterString = '';
                this.filters?.forEach(ele => {
                    // ==> check if filter array consist any operator or not....
                    if(Object.keys(ele).length == 1 && (Object.keys(ele)[0] == 'or' || Object.keys(ele)[0] == 'and')){
                        // ==> if filter consist any operator.... create query according to that...
                        var logic = Object.keys(ele)[0];
                        var logicFilters = ele[logic];
                        if(logicFilters && logicFilters.length){
                            filterString += `{ ${logic} : [ `;              // add logical operator for log....
                            logicFilters.forEach(filter => {
                                // ==> generic method to create query for each single fields...
                                filterString += this.generateFilterFieldStr(filter.field, filter.operator, filter.value);
                            })
                            filterString += ` ]}`;
                        }
                        this.filterError = false;
                        // return filterString;
                    }
                    else if(Object.keys(ele)?.includes('field') && Object.keys(ele)?.includes('operator') && Object.keys(ele)?.includes('value')){
                         // ==> generic method to create query for each single fields...
                        filterString += this.generateFilterFieldStr(ele.field, ele.operator, ele.value);
                        this.filterError = false;
                        // return filterString;
                    }
                    else{
                        var error = { error : 'Filter formate is not valid'};
                        this.errorHandler(error);
                        this.filterError = true;
                        return null;
                    }
                })
                return filterString;

            }
            else if(this.filters?.length){
                var error = { error : 'Filter formate is not valid'};
                this.errorHandler(error);
                this.filterError = true;
                return null;
            }
        } catch (error) {
            console.log('CustomRecordPickerV2', 'error to parse filters', error, 'warn');
            this.errorHandler(error.stack);
            this.filterError = true;
            return null;
        }
    }

    generateFilterFieldStr(field, operator, value){
        var filterString = '';

        value = typeof value == 'string' ? `"${value}"` : value;
        if(field.includes('.')){
            filterString += `{ ${field.split('.')[0]} :{ ${field.split('.')[1]} : { ${operator} : ${value} } } } 
            `
        }
        else{
            filterString += `{ ${field} : { ${operator} : ${value} }}
            `
        }

        return filterString;
    }

    modifiedRecordList(list = []) {
        try {
            return list.map(record => {
                const newRecord = {};

                for (const [fieldName, fieldValue] of Object.entries(record)) {
                    if (fieldValue && typeof fieldValue === 'object') {
                        if ('value' in fieldValue) {
                            newRecord[fieldName] = fieldValue.value;
                        } else {
                            newRecord[fieldName] = {};
                            for (const [key, nested] of Object.entries(fieldValue)) {
                                newRecord[fieldName][key] = (nested && typeof nested === 'object' && 'value' in nested) 
                                    ? nested.value 
                                    : nested;
                            }
                        }
                    } else {
                        newRecord[fieldName] = fieldValue;
                    }
                }

                return newRecord;
            });
        } catch (error) {
            console.log('CustomRecordPickerV2', 'modifiedRecordList', error, 'warn');
            return list;
        }
    }

    setDisplayOptions(){
        try {
            if(this.options){
                const tempOptions = this.options.map((opt) => ({
                    ...opt,
                    label: this.labelFieldApi.includes('.') ? opt[this.labelFieldApi.split('.')[0]][this.labelFieldApi.split('.')[1]] : opt[this.labelFieldApi],
                    value: opt.Id,
                    description: this.descriptionFieldApi ? (this.descriptionFieldApi.includes('.') ? opt[this.descriptionFieldApi.split('.')[0]][this.descriptionFieldApi.split('.')[1]] : opt[this.descriptionFieldApi]) : undefined,
                    helptext: this.helptextFieldApi ? (this.helptextFieldApi.includes('.') ? opt[this.helptextFieldApi.split('.')[0]][this.helptextFieldApi.split('.')[1]] : opt[this.helptextFieldApi]) : undefined,
                    isSelected: false,
                }));
    
                const trackedSet = new Set(this.trackValue);
                const otherRecords = tempOptions.filter(r => !trackedSet.has(r.Id));
                this.displayOptions = [...this.selectedOptions,...otherRecords];
                
                if(this.trackValue?.length){
                    this.setDefaultValue();
                }
                else{
                    this.clearValue();
                }
            }

        } catch (error) {
            console.log('CustomRecordPickerV2', 'setDisplayOptions', error, 'warn');
        }
    }
    
    // Set default value if user passes value...
    setDefaultValue(){
        try {
            this.selectedOptions = [];
            
            const valueToSet = this.trackValue;
            console.log('Setting :: ', this.trackValue);
            

            if(this.multiselect){
                valueToSet.forEach(ele => {
                    var matchedOption = this.displayOptions.find(option => option.value == ele);

                    if(matchedOption && !matchedOption.disabled){
                        (!matchedOption.isSelected) && this.selectedOptions.push(matchedOption);
                    }
                    else{
                        this.selectedOptions = this.selectedOptions.filter((e) => {
                            return e != ele;
                        });
                    }
                });

                this.setPlaceHolder();
            }
            else{

                // for single select took first one as default option...
                var matchedOption = this.displayOptions.find(option => option.value == valueToSet[0]);
                if(matchedOption && !matchedOption.disabled){
                    this.selectedOptions = [matchedOption];
                    this.selectedOptionLabel = matchedOption.label;
                }
                else{
                    this.selectedOptions = [];
                    this.selectedOptionLabel = null;
                }
            }
            this.setSelection();
            
        } catch (error) {
            console.log('CustomRecordPickerV2', 'setDefaultValue', error, 'warn');
        }
    }

    handleShowDropDown(){
        try {
            const comboBoxDiv = this.template.querySelector(`[data-id="slds-combobox"]`);
            if(comboBoxDiv){
                comboBoxDiv.classList.add('slds-is-open');
            }

            const backDrop = this.template.querySelector('.backDrop');
            if(backDrop){
                backDrop.style = 'display : block'
            }
        } catch (error) {
            console.log('CustomRecordPickerV2', 'handleShowDropDown', error, 'warn');
        }
    }

    handleSearch(event){
        (!this.isGqlError) && (this.searchedValue = event.target.value);
    }

    // this method use to send value to parent component on option selection....
    handleOptionClick(event){
        try {
            if(event.target.closest('.dropDownCSS')) event.target.closest('.dropDownCSS').scrollTop = 0;
            // Use Original Index as unique Value and comparison...
            var itemValue = event.target.closest('li').dataset.value;
            var itemIndex = event.target.closest('li').dataset.index
            const selectedRecord = this.displayOptions[itemIndex];
            if(selectedRecord && !selectedRecord.disabled){
                if(this.multiselect){
    
                    // Assign or remove clicked option from selected list...
                    if(!selectedRecord.isSelected){
                        this.displayOptions[itemIndex].isSelected = true;
                        this.selectedOptions.push(selectedRecord);
                        this.trackValue.push(itemValue);
                    }
                    else{
                        this.displayOptions[itemIndex].isSelected = false;
                        this.selectedOptions = this.selectedOptions.filter((ele) => {
                            return ele.value != itemValue;
                        });
                        this.trackValue = this.trackValue.filter(ele => {
                            return ele != itemValue;
                        });

                    }
                    this.setPlaceHolder();
    
                    // this logic create a list of selected options with original values...(remove additional keys...)
                    var selectedRecordList = [] ;
                    this.selectedOptions.forEach((ele) => {
                        selectedRecordList.push(this.optionsMap.get(ele.value));
                    });
    
                    // Send data to parent component...
                    this.dispatchEvent(new CustomEvent('change',{
                        detail : selectedRecordList
                    }));
    
                }
                else{
                    
                    this.selectedOptionLabel = event.target.closest('li').dataset.label;
                    
                    this.selectedOptions = [selectedRecord];
                    this.trackValue = [itemValue];
                    this.setSelection();
    
                    // if combobox is not multi-select it will return array with only one element...
                    this.dispatchEvent(new CustomEvent('change',{detail : 
                        [this.optionsMap.get(itemValue)]
                    }));
               
                    this.closeDropDown();
                }
    
                this.setErrorBorder();
            }
            this.searchedValue = '';
        } catch (error) {
            console.log('CustomRecordPickerV2', 'handleOptionClick', error, 'warn');
        }
    }

    //this method only for Single select Combo-Box
    clearSelection(){ 
        try {
            this.displayOptions.forEach(option => {option.isSelected = false});
            this.searchedValue = null;

            if(this.searchable){
                const searchInput = this.template.querySelector('[data-id="search-input"]');
                searchInput && searchInput.focus();
            }
            this.selectedOptionLabel = null;
            this.selectedOptions = [];
            // Send Null Data to parent Component...
            this.dispatchEvent(new CustomEvent('change',{detail : 
                []
            }));
            
            this.trackValue = [];
            
            this.clearSearch();
            this.setErrorBorder();
            this.setPlaceHolder();
        } catch (error) {
            console.log('CustomRecordPickerV2', 'clearSelection', error, 'warn');
        }
    }

    closeDropDown(){
        try {
            // remove slds-is-open class from combobox div to hide dropdown...
            const comboBoxDiv = this.template.querySelector(`[data-id="slds-combobox"]`);
            if(comboBoxDiv && comboBoxDiv.classList.contains('slds-is-open')){
                comboBoxDiv.classList.remove('slds-is-open');
            }

            // remove back-shodow from main div
            const backDrop = this.template.querySelector('.backDrop');
            if(backDrop){
                backDrop.style = 'display : none'
            }

            this.setErrorBorder();
        } catch (error) {
            // console.warn('error inside closeDropDown in custom combobox : ', error.stack);
            console.log('CustomRecordPickerV2', 'closeDropDown', error, 'warn');
        }
    }

    // Generic Method -> to update initial options list and display option list...as option select and unselect...
    setSelection(){
        try {
            this.displayOptions.forEach(item => { 
                item.isSelected = this.selectedOptions.length ? this.selectedOptions.some(ele => ele.value == item.value) : false
            });
        } catch (error) {
            // console.warn('error in setSelection : ', error.stack);
            console.log('CustomRecordPickerV2', 'setSelection', error, 'warn');
        }
    }

    // Generic Method -> to Set place older as user select or unselect options... (Generally used for multi-Select combobox)
    setPlaceHolder(){
        if(this.selectedOptions.length < 1){
            this.placeholderText = this.placeholder ? this.placeholder : (this.multiselect ? 'Select an Options...' : 'Select an Option...');
        }
        else{
            var length = this.selectedOptions.length;
            this.placeholderText = this.selectedOptions.length + (length == 1 ? ' option' : ' options') + ' selected';
        }
    }

    //Generic Method -> to Set error border if combobox is required == true and no option selected...
    setErrorBorder() {
        try {
            const input = this.template.querySelector('.slds-combobox__input');
            if (!input) return;

            const needsError = (this.required || this.isGqlError) && (
                (this.multiselect && this.selectedOptions.length === 0) ||
                (!this.multiselect && this.selectedOptionLabel == null));

            input.classList.toggle('error-border', needsError);
        } catch (error) {
            console.log('CustomRecordPickerV2', 'setErrorBorder', error, 'warn');
        }
    }


    handleDisableClick(event){
        event.stopPropagation();
        event.preventDefault();
    }

    handleFooterBtnClick(){
        this.dispatchEvent(new CustomEvent('clickfooterbutton'));
    }

// === ==== ==== ===  [ API Methods to Access from Parent Components ] === === == === ==== ===

    // When user remove selected option form parent component... use this method to remove it from selecteOption Array.....
    @api
    unselectOption(unselectedOption){
        try {
            this.selectedOptions = this.selectedOptions.filter((option) => {
                option.isSelected = false;
                return option.value != unselectedOption;
            });

            this.setSelection();
            this.setErrorBorder();
            this.setPlaceHolder();
        } catch (error) {
            // console.warn('error in unselectOption in custom combobox : ', error.stack);
            console.log('CustomRecordPickerV2', 'unselectOption', error, 'warn');
        }
    }

    // Clear all value from parent component....
    @api
    clearValue(){
        try {
            if(this.multiselect){
                if(this.selectedOptions.length > 0){
                    this.selectedOptions = this.selectedOptions.filter((option) => {
                        option.isSelected = false;
                        return null;
                    });

                    this.setSelection();
                    this.setErrorBorder();
                    this.setPlaceHolder();
                }
            }
            else{
                if(this.selectedOptionLabel != null){
                    this.clearSelection();
                }
            }
        } catch (error) {
            // console.warn('error in clearAll in custom combobox : ', error.stack);
            console.log('CustomRecordPickerV2', 'clearAll', error, 'warn');
        }
    }

    // Reset value to default value from parent component....
    @api
    resetValue(){
        this.clearValue();
        if(this.trackValue?.length){
            // this.setDefaultSection();
            this.setDefaultValue();
        }
    }

    // ==== Clear search value of input element for searchable combobox...
    @api 
    clearSearch(){
        try {
            if(this.searchable){
                const searchInput = this.template.querySelector('[data-id="search-input"]');
                searchInput && (searchInput.value = '');
            }
        } catch (error) {
            // console.warn('error in clearSearch : custom combobox : ', error.stack);
            console.log('CustomRecordPickerV2', 'clearSearch', error, 'warn');
        }
    }

    // Set Error Border from Parent component as per validation on parent component...
    @api
    isInvalidInput(isInvalid) {
        try {
            const input = this.template.querySelector('.slds-combobox__input');
            if (!input) return;

            input.classList.toggle('error-border', isInvalid);
        } catch (error) {
            console.log('CustomRecordPickerV2', 'isInvalidInput', error, 'warn');
        }
    }

}