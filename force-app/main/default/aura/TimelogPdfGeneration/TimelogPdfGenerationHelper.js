({
    handleClick: function(component, event, helper) {
        var action=component.get('c.getDefault');
        var self = this;
        var weekdayMapRev = component.get('v.weekdayMapReverse');
        action.setCallback(this, function(response){
            var state = response.getState();
            if(state === 'SUCCESS'){
                var result = response.getReturnValue();
                var selectedDate = component.get("v.StartDate");
                var date = $A.localizationService.formatDate(selectedDate, "EEEE");
                var today  = new Date(selectedDate);
                today.setDate(today.getDate());
                
              if(date != result.weekStartDay){
                   
                    var target  = new Date(today);  
                    var dayNr   = (today.getDay() + 6) % 7;  
                    target.setDate(target.getDate() - dayNr + 3);  
                    var firstThursday = target.valueOf();
                    target.setMonth(0, 1);
                    if (target.getDay() !== 4){
                    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
                    }
                    var weekNr = 1 + Math.ceil((firstThursday - target) / 604800000);  
                    var msg = 'week '+ weekNr +' is selected';
                   
                    self.toast.error(msg);
                    if(weekdayMapRev[date] < weekdayMapRev[result.weekStartDay]){
                        today.setDate(today.getDate() - 7 + (weekdayMapRev[result.weekStartDay] - weekdayMapRev[date]));
                        var date1 = $A.localizationService.formatDate(today, "YYYY-MM-dd");
                        component.set('v.StartDate', date1);
                        
                    }else if(weekdayMapRev[date] > weekdayMapRev[result.weekStartDay]){
                        today.setDate(today.getDate() - weekdayMapRev[date] +weekdayMapRev[result.weekStartDay]);
                        var date1 = $A.localizationService.formatDate(today, "YYYY-MM-dd");
                        component.set('v.StartDate', date1);
                    }
                    var d = new Date(date1);
                    d.setDate(d.getDate() + 6);
                    var date = $A.localizationService.formatDate(d, "YYYY-MM-dd");
                    component.set('v.EndDate', date);
              }else{
                    var d = new Date(component.get("v.StartDate"));
                    d.setDate(d.getDate() + 6);
                    var date = $A.localizationService.formatDate(d, "YYYY-MM-dd");
                    component.set('v.EndDate', date);
              }
            } else if (state === "ERROR"){
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
        
    },
    
	createPDF : function(component,event,helper){
        var self = this;
	     var action = component.get('c.getTimesheetDetail');
         action.setParams({
            'StartDate' : component.get("v.StartDate"),
			'EndDate' : component.get("v.EndDate"),
            'recordId' : component.get("v.recordId"),
            'selectedUser' : component.get("v.selectedOwner")
         });
         action.setCallback(this, function(response){
            var state = response.getState();
            if(state === 'SUCCESS'){
                var recordId = component.get("v.recordId");
                var EndDate = component.get("v.EndDate");
                var StartDate = component.get("v.StartDate");
                var selectedUser = component.get("v.selectedOwner");
                window.open("/apex/TimeSheetWeeklyPage?id="+recordId+"&StartDate="+StartDate+"&EndDate="+EndDate+"&UserId="+selectedUser+"&recordId="+recordId);
            } else if (state === "ERROR"){
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
	},	
})