({
	getTimeSheetData : function(component, event, helper) {
          var action = component.get('c.getTimesheet');
          var self = this;
         component.set('v.columns', [
                    {label: 'JobName', fieldName: 'jobName', type: ''},
                    {label: 'JobNumber', fieldName: 'jobNumber', type: ''},
                    {label: 'TimeSheet', fieldName: 'timesheetURL', type: 'url',typeAttributes: {label: { fieldName: 'timesheetName' }, target: '_blank'}},
                    {label: 'TimeSheetEntry', fieldName: 'name', type: ''},
                    {label: 'EntryDate', fieldName: 'createdDate', type: 'DateTime '},
                    {label: 'Spent Time', fieldName: 'totalTimesheetTime', type: 'number',cellAttributes: { alignment: 'left' }},
                    {label: 'TimeIn', fieldName: 'clockInTime', type: 'DateTime'},
                    {label: 'TimeOut', fieldName: 'clockOutTime', type: 'DateTime'}
                ]); 
       
        action.setCallback(this, function(response){  
            var state = response.getState();  
            
            if (state === 'SUCCESS') { 
                component.set("v.secondLevelAccess",true);
                var rows = response.getReturnValue(); 
                
                
                var TimesheetListDataTable = [];
                
                var TimesheetList = [];
                for(var key in rows){
                   
                    var logEntryList =[]; 
                    
                    for(var key2 in rows[key]){
                        var totalTime = 0.00;
                        var createdDate = new Date();
                        for(var i=0 ; i < rows[key][key2].length;i++){
                            createdDate = rows[key][key2][i].createdDate;
                            if(rows[key][key2][i].totalTime == 0){
                                totalTime = totalTime + rows[key][key2][i].totalTime ;
                            }else{
                                totalTime += rows[key][key2][i].totalTime;
                            }
                        }
                        logEntryList.push({ key2 ,value:rows[key][key2],totalTime,createdDate });
                        
                        var rowLength = rows[key][key2].length;
                        
                        if(rows[key][key2].length > 0){
                            for(var j = 0; j < rows[key][key2].length ; j++){
                                TimesheetListDataTable.push(rows[key][key2][j]);
                            }
                        }
                         
                    }
                    var TotalLogentryTime = 0.00;
                    for(var i=0 ; i < logEntryList.length;i++){
                       
                        if(logEntryList[i].totalTime == 0){
                            TotalLogentryTime = TotalLogentryTime + logEntryList[i].totalTime;
                        }else{
                            TotalLogentryTime += logEntryList[i].totalTime;
                        }
                        
                    }
                    TimesheetList.push({key, value:logEntryList, TotalLogentryTime}); 
                }
                
                 
                /* for (var i = 0; i < Ti
                    mesheetListDataTable.length ; i++) { 
                    var JobNames = TimesheetListDataTable[i].Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c; 
                    TimesheetListDataTable[i].JobName = JobNames;
                    var JobNo = TimesheetListDataTable[i].Timesheet_Entry__r.TimeSheet__r.Job__r.Name;
                    TimesheetListDataTable[i].JobNumber = JobNo;
                    var JobIds = TimesheetListDataTable[i].Timesheet_Entry__r.TimeSheet__r.Job__r.Id;
                    TimesheetListDataTable[i].JobId = JobIds;
                    var timesheetNames = TimesheetListDataTable[i].Timesheet_Entry__r.TimeSheet__r.Name;
                    TimesheetListDataTable[i].TimeSheetName = timesheetNames;
                    TimesheetListDataTable[i].timesheetURL = '/' + TimesheetListDataTable[i].timesheetId;
                    var totalTimes= TimesheetListDataTable[i].Timesheet_Entry__r.TimeSheet__r.Total_Timesheet_Time__c;
                    TimesheetListDataTable[i].totalTime= totalTimes;
                    // 
                } */
                component.set("v.timesheet",TimesheetList);
                component.set("v.timesheetData",TimesheetListDataTable);
                
                
                component.set("v.totalTimesheet",TimesheetListDataTable.length);
                
            } else if (state === "ERROR"){
                component.set("v.secondLevelAccess",false);
                let errMsg = response.getError()[0].message;
                try{
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                }catch(e){
                    try{
                        if(!errMsg.includes('Second')){
                            self.toast.error(response.getError()[0].message);
                        }
                        return;
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
            }
        }); 
        $A.enqueueAction(action);
    },

    // Commented duplicate code
    /* getNextTimeSheetData : function(component, event, helper) {
        var action = component.get("c.getNextTimesheet");
        var self = this;
        component.set('v.columns', [
                    {label: 'JobName', fieldName: 'JobName', type: ''},
                    {label: 'JobNumber', fieldName: 'JobNumber', type: ''},
                    {label: 'TimeSheet', fieldName: 'timesheetId', type: 'url',typeAttributes: {label: { fieldName: 'TimeSheetName' }, target: '_blank'}},
                    {label: 'TimeSheetEntry', fieldName: 'Name', type: ''},
                    {label: 'Entry Date', fieldName: 'Timesheet_Entry__r.Entry_Date__c', type: 'DateTime '},
                    {label: 'Spent Time', fieldName: 'Total_Clock_In_Time__c', type: 'number',cellAttributes: { alignment: 'left' }},
                ]);
       
        action.setCallback(this, function(response){
            var state = response.getState();
            if (state === "SUCCESS") {
                var rows = response.getReturnValue();
                var TimesheetListDataTable = [];
                
                var TimesheetList = [];
                for(var key in rows){
                   
                    var logEntryList =[]; 
                    
                    for(var key2 in rows[key]){
                        var totalTime = 0.00;
                        var createdDate = new Date();
                        for(var i=0 ; i < rows[key][key2].length;i++){
                            createdDate = rows[key][key2][i].createdDate;
                            if(rows[key][key2][i].Total_Time__c == 0){
                                totalTime = totalTime + rows[key][key2][i].Total_Time__c ;
                            }else{
                                totalTime += rows[key][key2][i].Total_Time__c;
                            }
                        }
                        logEntryList.push({ key2 ,value:rows[key][key2],totalTime,createdDate });
                        
                        
                        var rowLength = rows[key][key2].length;
                        
                        if(rows[key][key2].length > 0){
                            for(var j = 0; j < rows[key][key2].length ; j++){
                                TimesheetListDataTable.push(rows[key][key2][j]);
                            }
                        }
                         
                    }
                    var TotalLogentryTime = 0.00;
                    for(var i=0 ; i < logEntryList.length;i++){
                       
                        if(logEntryList[i].totalTime == 0){
                            TotalLogentryTime = TotalLogentryTime + logEntryList[i].totalTime;
                        }else{
                            TotalLogentryTime += logEntryList[i].totalTime;
                        }
                        
                    }
                    TimesheetList.push({key, value:logEntryList, TotalLogentryTime}); 
                }
                
                
                for (var i = 0; i < TimesheetListDataTable.length ; i++) {
                    
                    var JobNames = TimesheetListDataTable[i].Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c; 
                    TimesheetListDataTable[i].JobName = JobNames;
                    var JobNo = TimesheetListDataTable[i].Timesheet_Entry__r.TimeSheet__r.Job__r.Name;
                    TimesheetListDataTable[i].JobNumber = JobNo;
                    var JobIds = TimesheetListDataTable[i].Timesheet_Entry__r.TimeSheet__r.Job__r.Id;
                    TimesheetListDataTable[i].JobId = JobIds;
                    var timesheetNames = TimesheetListDataTable[i].Timesheet_Entry__r.TimeSheet__r.Name;
                    TimesheetListDataTable[i].TimeSheetName = timesheetNames;
                    var timesheetIds = '/'+TimesheetListDataTable[i].Timesheet_Entry__r.TimeSheet__r.Id;
                    TimesheetListDataTable[i].timesheetId= timesheetIds;
                     var totalTimes= TimesheetListDataTable[i].Timesheet_Entry__r.TimeSheet__r.Total_Timesheet_Time__c;
                    TimesheetListDataTable[i].totalTime= totalTimes;
                }
                component.set("v.timesheet",TimesheetList); 
                component.set("v.totalTimesheet",TimesheetListDataTable.length);
                component.set("v.isPreviousButtonActive", false); 
                component.set("v.isNextButtonActive", true); 
                
            }else if (state === "ERROR"){
                try{
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                }catch(e){
                    try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
            }
        });
        $A.enqueueAction(action);
    }, */
    getPreviousTimesheetData : function(component, event, helper) {
        helper.getTimeSheetData(component, event, helper);
        component.set("v.isPreviousButtonActive", true); 
        component.set("v.isNextButtonActive", false); 
                
    },
    
})