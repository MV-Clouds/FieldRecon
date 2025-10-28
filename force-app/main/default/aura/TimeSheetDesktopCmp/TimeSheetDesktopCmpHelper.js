({
    doInit : function(component, event, helper) {
        var d = new Date();
        
        component.set('v.Month',helper.getMonth(d.getMonth()));
        component.set('v.Year',d.getFullYear());
        component.set('v.WeekNumber',helper.getWeekNumber(d));
        component.set('v.SelectedDate',d.getFullYear()+'-'+(parseInt(d.getMonth())+parseInt(1))+'-'+d.getDate());
        
        helper.getUserId(component, event, helper);
        helper.setDates(component, helper, helper.getDateOfWeek(component.get('v.WeekNumber'),component.get('v.WeekNumber')));
    },

    getUserId : function(component, event, helper){
        var self = this;
        var action = component.get('c.getDefaultUserId');
        action.setCallback(this, function(response){
            if(response.getState() === 'SUCCESS'){
                component.set('v.User',response.getReturnValue());
                component.set('v.showSpinner',false);
                helper.getTimeSheetData(component, event, helper);
            } else if (response.getState() === "ERROR"){
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
            else{
                self.toast.error('Please contact your System admin!');
            }
        });
        $A.enqueueAction(action);
    },

    getTimeSheetData : function(component, event, helper){
        var self = this;
        var d = new Date();
        var thisWeek = helper.getWeekNumber(d);
        var day = helper.getDateOfWeek(parseInt(component.get('v.WeekNumber')), thisWeek );
        
        var dt = new Date(day.getTime() - (day.getTimezoneOffset() * 60000 )).toISOString().split("T")[0];
        
        component.set('v.displayUser',component.get('v.User.Id') == '' ? true : false);
        var action = component.get('c.getTimesheetDatas');
        action.setParams({
            'StartDate' : dt,
            'recordId' : component.get('v.JobId') == '' ? component.get('v.User.Id') : component.get('v.JobId')
        });
        action.setCallback(this, function(response){
            if(response.getState() == 'SUCCESS'){
                component.set('v.secondLevelAccess',true);
                component.set('v.timeSheet',response.getReturnValue());
                component.set('v.showSpinner',false);
            }else if (response.getState() === "ERROR"){
                let errMsg = response.getError()[0].message;
                component.set('v.secondLevelAccess',false);
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

    // FROM DATE PICKER
    NewgetTimeSheetData : function(component, event, helper, Date){
        var self = this;
        component.set('v.displayUser',component.get('v.User.Id') == '' ? true : false);
        var action = component.get('c.getTimesheetDatas');
        
        
        action.setParams({
            'StartDate' : Date,
            'recordId' : component.get('v.JobId') == '' ? component.get('v.User.Id') : component.get('v.JobId')
        });
        action.setCallback(this, function(response){
            if(response.getState() == 'SUCCESS'){
                
                component.set('v.timeSheet',response.getReturnValue());
                component.set('v.showSpinner',false);
            } else if (response.getState() === "ERROR"){
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
            else{
                self.toast.error('FAIL');
            }
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

    // Fullmonth will return month number 
    // January = 0, December = 11;
    getMonthFromString : function(component, event, helper, mon){
        var d = new Date(mon + "1, 2012");
        return d.getMonth();
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

    getDateOfWeekNew : function(weekNumber, thisWeekNumber, NewDate) {
        var d = new Date('"'+NewDate+'"');
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

    setDates : function(component, helper, date){
        // alert('I am here');
        component.set('v.Month',helper.getMonth(date.getMonth()));
        component.set('v.Year',date.getFullYear());

        date.setDate( date.getDate());
        component.set('v.Date1',parseInt(date.getDate()));

        date.setDate( date.getDate() + 1 );
        component.set('v.Date2',parseInt(date.getDate()));

        date.setDate( date.getDate() + 1 );
        component.set('v.Date3',parseInt(date.getDate()));

        date.setDate( date.getDate() + 1 );
        component.set('v.Date4',parseInt(date.getDate()));

        date.setDate( date.getDate() + 1 );
        component.set('v.Date5',parseInt(date.getDate()));

        date.setDate( date.getDate() + 1 );
        component.set('v.Date6',parseInt(date.getDate()));

        date.setDate( date.getDate() + 1 );
        component.set('v.Date7',parseInt(date.getDate()));

    },

    setAllDates : function(Date){

        // Set week number
        component.set('v.WeekNumber',helper.getWeekNumber(Date));

        // Set Date's week
        component.set('v.Day1',Date.getDay() - Date.getDay());
        component.set('v.Day2',Number(Date.getDay()) + Number(1) - Date.getDay());
        component.set('v.Day3',Number(Date.getDay()) + Number(2) - Date.getDay());
        component.set('v.Day4',Number(Date.getDay()) + Number(3) - Date.getDay());
        component.set('v.Day5',Number(Date.getDay()) + Number(4) - Date.getDay());
        component.set('v.Day6',Number(Date.getDay()) + Number(5) - Date.getDay());
        component.set('v.Day7',Number(Date.getDay()) + Number(6) - Date.getDay());
        
        // Get Date's week's start date.
        return new Date(Date.getFullYear(), Date.getMonth, Date.getDate() - Date.getDay() );
    },
})