({
    doInit: function(component, event, helper) {
        var action = component.get("c.getDefaults");
           
        var self = this;
        action.setCallback(this, function(response) {
        var state = response.getState();    
            if (state === "SUCCESS") {
                  
                var res = response.getReturnValue();
                component.set('v.secondLevelAccess',true);
                
                component.set('v.Job',response.getReturnValue());
                 
                if(res.length != 0){
                component.set('v.mapMarkersData',response.getReturnValue()); 
        
                component.set('v.mapCenter',[{
                    location : {
                        Country    : res[0].location.Country,
                    },
                }]);  
                if(res.length == 1){
                    component.set('v.zoomlevel',14);
                }
                component.set('v.markersTitle', 'Job locations');
                }
                component.set('v.totalJob',response.getReturnValue().length);
                component.set('v.crew',response.getReturnValue());
            }else if (state === "ERROR"){
                component.set('v.secondLevelAccess',false);
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
	
    onclick : function (component, event, helper) {
        
        var jobId = event.getSource().get("v.value");
        component.set("v.JobId", jobId);
        component.set("v.isModalOpen", true);
    },
    
    closeModel: function(component, event, helper) {
      component.set("v.isModalOpen", false);
   },
   
    getweekData : function (component, event, helper) {
        var self = this;
        var action = component.get("c.getWeeklyData");
        action.setCallback(this, function(response) {
        var state = response.getState();
            if (state === "SUCCESS") {
                var days = response.getReturnValue();
                var joblist = [];
                for(var i=0; i<days.length ; i++){
                    for(var j=0; j<days[i].jobLocationWrapperList.length; j++){
                        joblist.push(days[i].jobLocationWrapperList[j]);
                        var currentDays =days[i].DayName;
                        days[i].currentDay = currentDays;
                    }
                }
                 component.set('v.Weekly',days);
                 
                
                component.set('v.marker',joblist);
                component.set('v.mapCenterData',joblist);
                component.set('v.markersTitleData', 'Job locations.');
                component.set('v.totalWeeklyJob',joblist.length);
            }else if (state === "ERROR"){
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
    
    navigateToJob : function (component, event, helper) {
        var navEvt = $A.get("e.force:navigateToSObject");
        navEvt.setParams({
        "recordId": JobId,
        "slideDevName": "related"
        });
        navEvt.fire();
    },
    
    /* getTimeSheetData : function(component, event, helper) {
         var action = component.get("c.getTimesheet");
         var self = this;
         component.set('v.columns', [
                    {label: 'JobName', fieldName: 'jobNumber', type: ''},
                    {label: 'TimeSheet', fieldName: 'timesheetName', type: 'Text'},
                    {label: 'TimeSheetEntry', fieldName: 'name', type: ''},
                    {label: 'Entry Date', fieldName: 'Entry_Date__c', type: 'DateTime '},
                    {label: 'Spent Time', fieldName: 'Total_Clock_In_Time__c', type: 'number',cellAttributes: { alignment: 'left' }},
                ]);
       
        action.setCallback(this, function(response){
            var state = response.getState();
            if (state === "SUCCESS") {
                var rows = response.getReturnValue();
                for (var i = 0; i < rows.length ; i++) {
                    var JobNames = rows[i].TimeSheet__r.Job__r.Job_Name__c;
                    rows[i].JobName = JobNames;
                    var JobNo = rows[i].TimeSheet__r.Job__r.Name;
                    rows[i].JobNumber = JobNo;
                    var JobIds = rows[i].TimeSheet__r.Job__c;
                    rows[i].JobId = JobIds;
                    var timesheetNames = rows[i].TimeSheet__r.Name;
                    rows[i].TimeSheetName= timesheetNames;
                     var timesheetIds = rows[i].TimeSheet__c;
                    rows[i].timesheetId= timesheetIds;
                     var totalTimes= rows[i].TimeSheet__r.Total_Timesheet_Time__c;
                    rows[i].totalTime= totalTimes;
                 
                }
                component.set("v.timesheet",rows);
                component.set("v.totalTimesheet",rows.length);
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
  
})