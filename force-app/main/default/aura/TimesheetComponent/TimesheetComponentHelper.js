({
    doInit : function(component, event, helper) {
        var d = new Date();
        component.set('v.selectedMonth',d.getMonth());
        component.set('v.yr',d.getFullYear());
        component.set('v.WeekNum',helper.getWeekNumber(d));
        component.set('v.selectedDate',new Date(d.getTime() - (d.getTimezoneOffset() * 60000 )).toISOString().split("T")[0]);
        helper.getTimeSheetDataDefault(component, event, helper);
        
        helper.setDates(component, helper, helper.getDateOfWeek(component.get('v.WeekNum'),component.get('v.WeekNum')));
    },

   

    getTimeSheetData : function(component, event, helper){
        var WeekDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        var selectedDate = event.currentTarget.getAttribute("id");
        component.set("v.selectedDate",selectedDate);
        
        var dtnew = new Date(selectedDate);
        component.set("v.selectedMonth",dtnew.getMonth());
        component.set("v.yr",dtnew.getFullYear());
        component.set("v.selectedDay",WeekDays[dtnew.getDay()]);
        var action = component.get("c.getTimeData");
        action.setParams({
            getDate : selectedDate
        });
        var self = this;
        action.setCallback(this,function(response){       
            var state = response.getState();
            if(state === 'SUCCESS'){
                var result = response.getReturnValue();
                component.set('v.timeSheetData',response.getReturnValue());
                
                var totalTime = 0.00;
                for(var i = 0; i < result.length;i++){
                    if(result[i].totalTime == 0){
                        totalTime = totalTime + result[i].totalTime;
                    }else{
                            totalTime =  totalTime + result[i].totalTime;
                    }
                }
                
                component.set('v.totalTime',totalTime.toFixed(2));
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
            component.set("v.showSpinner",false);
        });
        $A.enqueueAction(action);
    },

    getTimeSheetDataDefault : function(component, event, helper){
        var self = this;
        var WeekDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        var selectedDate = component.get("v.selectedDate");
        
        var action = component.get("c.getTimeData");
        component.set("v.selectedDay",WeekDays[new Date(selectedDate).getDay()]);
        action.setParams({
            getDate : selectedDate
        });
        action.setCallback(this,function(response){       
            var state = response.getState();
            if(state === 'SUCCESS'){
                var result = response.getReturnValue();
                component.set('v.timeSheetData',response.getReturnValue());
                
                var totalTime = 0.00;
                for(var i = 0; i < result.length;i++){
                    if(result[i].totalTime == 0){
                        totalTime = totalTime + result[i].totalTime;
                    }else{
                            totalTime =  totalTime + result[i].totalTime;
                    }
                }
                
                component.set('v.totalTime',totalTime.toFixed(2));
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
            component.set("v.showSpinner",false);
        });
        $A.enqueueAction(action);
    },

    // Send month number it will return Month Name...
    getMonth : function(month){
        if(month == 0) return 'January';
        else if(month == 1) return 'Febuary';
        else if(month == 2) return 'March';
        else if(month == 3) return 'April';
        else if(month == 4) return 'May';
        else if(month == 5) return 'June';
        else if(month == 6) return 'July';
        else if(month == 7) return 'August';
        else if(month == 8) return 'September';
        else if(month == 9) return 'October';
        else if(month == 10) return 'November';
        else if(month == 11) return 'December';
    },

    // returns the first date of the week
    getDateOfWeek : function(weekNumber, thisWeekNumber) {
        var d = new Date();
        var n = d.getDay();
        var thisWeek = thisWeekNumber;
        var diffWeek = thisWeek - weekNumber;
        var removeDays = (diffWeek * 7 ) + n - 1;
        d.setDate( d.getDate() - removeDays );
        
        return d;
    },

    getWeekNumber : function(WeekOfDate){
        return Math.ceil(((WeekOfDate - new Date(WeekOfDate.getFullYear(), 0, 1) ) / 86400000 + new Date(WeekOfDate.getFullYear(), 0, 1).getDay() + 1) / 7);
    },
    
    getFirstDayOfWeek: function(d) {
          d = new Date(d);
          var day = d.getDay();
          var diff = d.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
            
          return new Date(d.setDate(diff));
    },

    setDates : function(component, helper, date){
        var self = this;
        component.set("v.showSpinner",true);
        var action = component.get("c.getWeekTimeData");
        var stDate = new Date(date.setDate(date.getDate()));
        var StartDate = new Date(stDate.getTime() - (stDate.getTimezoneOffset() * 60000 )).toISOString().split("T")[0];
        
        action.setParams({
            StartDate : StartDate
        });
        action.setCallback(this,function(response){
            var state = response.getState();
            if(state === 'SUCCESS'){
                
                var result = response.getReturnValue();
                var week = [];
                for(var i=1; i <= 7 ;i++){
                    if(i == 1){
                        var day = new Date(date.setDate(date.getDate()));
                    }else if(i != 1){
                        var day = new Date(date.setDate(date.getDate() + 1));
                    }
                    var cellData = {};

                    cellData['Date'] = new Date(day.getTime() - (day.getTimezoneOffset() * 60000 )).toISOString().split("T")[0];
                    cellData['DayNumber']= day.getDate();
                    cellData['DayName'] = day.getDay();
                    cellData['hours'] = result['Day'+i] == 0 ? '' : result['Day'+i];
                    
                    week.push(cellData);
                }
                component.set("v.WeekData",week);
                helper.getTimeSheetDataDefault(component,event,helper);
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
            component.set("v.showSpinner",false);
            
        });
        $A.enqueueAction(action);
    },

    getSelectedMonthData : function(component,event,helper){
        var today = new Date(component.get("v.selectedDate"));
        
        var toadyDate = today.getDate();
        var mon = component.get('v.selectedMonth');
        
        var firstDayOfmonth = new Date(today.getFullYear(), mon, toadyDate);
        var check = firstDayOfmonth.getDay();
        var WeekNumber = helper.getWeekNumber(firstDayOfmonth) - (check == 0 ? 1 : 0);
        
        var d = new Date();
        var thisWeek = helper.getWeekNumber(d);
        
        component.set("v.selectedDate",new Date(firstDayOfmonth.getTime() - (firstDayOfmonth.getTimezoneOffset() * 60000 )).toISOString().split("T")[0]);

        component.set("v.WeekNum",WeekNumber);
        var selectedmonth = new Date(component.get("v.selectedDate"));
        component.set("v.selectedMonth",selectedmonth.getMonth());
        component.set("v.yr",selectedmonth.getFullYear());
        helper.setDates(component, helper, helper.getFirstDayOfWeek(selectedmonth));
        
    },
})