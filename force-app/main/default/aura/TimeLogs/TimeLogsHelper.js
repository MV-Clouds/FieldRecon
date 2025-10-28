({
	getDefalut : function(component, event, helper, pageNumber, pageSize) {
	    component.set("v.Spinner", true);
		var action = component.get("c.getLogEntries");
        var selectedUser = component.find("UserLookup").get("v.selectedRecordId");
        var selectedJob = component.get("v.recordId") == '' ? component.get("v.JobId") : component.get("v.recordId");
        var self = this;
		action.setParams({
			'JobId': selectedJob,
			'UserId' : selectedUser,
			'Selectedtab' : component.get("v.selectedtab"),
			'StartDatebegin' : component.get("v.StartDatebegin"),
			'StartDateend' : component.get("v.StartDateend"),
			'EndDatebegin' : component.get("v.EndDatebegin"),
			'EndDateend' : component.get("v.EndDateend"),
			'starthourBegin' : component.find("HoursRange").get("v.value"),
			'pageNumber' : pageNumber,
            'pageSize' : pageSize
		}); 
		
		action.setCallback(this, function (response) {
            var state = response.getState();
            
            if (state === "SUCCESS") {
              var totalTimesheet = 0;
                var result = response.getReturnValue();
                
                     for(var j=0; j<result.timelogWrapperList.length; j++){
                         if(totalTimesheet == 0){
                            totalTimesheet = totalTimesheet + result.timelogWrapperList[j].TotalTime;
                         }
                         else{
                             totalTimesheet += result.timelogWrapperList[j].TotalTime;
                         }
                     }
				component.set("v.LogtimeList", result.timelogWrapperList);

				$A.util.isEmpty(selectedUser) && $A.util.isEmpty(component.get("v.JobId")) ? component.set("v.UserIdList", result.UserList) : component.get("v.UserIdList");
				$A.util.isEmpty(selectedUser) && $A.util.isEmpty(component.get("v.JobId")) ?  component.set("v.JobIdList", result.JobList) : component.get("v.JobIdList");
			    
			    component.set("v.TotalTimeData",totalTimesheet);
				component.set("v.isFirst", false);
				component.set("v.PageNumber", result.pageNumber);
                component.set("v.TotalRecords", result.totalRecords);
                component.set("v.RecordStart", result.recordStart);
                component.set("v.RecordEnd", result.recordEnd);
                component.set("v.TotalPages", Math.ceil(result.totalRecords / pageSize));
                
                component.set("v.defaultValues", result.DefaultValues);
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
            component.set("v.Spinner", false);
        });
        $A.enqueueAction(action);
	},
	    
    setLocalTime : function(component, event, helper, message) {
        
        var StartDate = new Date();
        var selectedTab = component.get("v.selectedtab") == 'timesheet' ? 30 : component.get("v.selectedtab") == 'timesheetentries' ? 15 : 7 ;
        
        StartDate = $A.localizationService.formatDate(StartDate.setDate(StartDate.getDate() - selectedTab), "YYYY-MM-DD");
        component.set("v.StartDatebegin", StartDate);
        component.set("v.EndDatebegin", StartDate);
        
        var endDate = new Date();
        endDate = $A.localizationService.formatDate(endDate.setDate(endDate.getDate() + 7), "YYYY-MM-DD");
        var today = $A.localizationService.formatDate(new Date(), "YYYY-MM-DD");
        component.set("v.StartDateend", today);
        component.set("v.EndDateend", endDate );
    },
    
    onDatecompare : function(component, event, helper, StartDate, EndDate, pageNumber, pageSize) {
        
        if(StartDate > EndDate){
            
            component.set("v.StartDatebegin",$A.localizationService.formatDate(StartDate.setDate(StartDate.getDate() - 7), "YYYY-MM-DD"));
            component.set("v.EndDatebegin",$A.localizationService.formatDate(new Date(), "YYYY-MM-DD"));
            
        }else if(StartDate == null || EndDate == null){
            component.set("v.StartDatebegin",$A.localizationService.formatDate(StartDate.setDate(StartDate.getDate() - 7), "YYYY-MM-DD"));
            component.set("v.EndDatebegin",$A.localizationService.formatDate(new Date(), "YYYY-MM-DD"));
        }else{
            helper.getDefalut(component, event, helper, pageNumber, pageSize);
        }
    },
    
})