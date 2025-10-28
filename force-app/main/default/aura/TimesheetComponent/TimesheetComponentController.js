({
    doInit : function(component, event, helper) {
        component.set("v.showSpinner",true);
        helper.doInit(component, event, helper);
    },

    currentWeek : function(component, event, helper){
        var d = new Date();
        var weekNumber = helper.getWeekNumber(d);
        component.set('v.WeekNum',weekNumber);
        helper.getTimeSheetData(component, event, helper);
        var WeekNumber = parseInt(component.get('v.WeekNum'));
        helper.setDates(component, helper, helper.getDateOfWeek(WeekNumber,weekNumber));
    },
    gettimesheet: function(component,event,helper){
                component.set("v.showSpinner",true);
        helper.getTimeSheetData(component,event,helper);
    },


    previousweek : function(component, event, helper){
        var WeekNumber = parseInt(component.get('v.WeekNum'));
        component.set('v.WeekNum',WeekNumber - 1);
        var WeekData = component.get("v.WeekData");
        var firstDay = new Date(WeekData[0].Date);
        var first = new Date(WeekData[6].Date);
        var date = helper.getFirstDayOfWeek(first.setDate(first.getDate() - 7));
        component.set('v.selectedMonth',date.getMonth());
        component.set('v.yr',date.getFullYear());

        helper.setDates(component, helper, helper.getFirstDayOfWeek(firstDay.setDate(firstDay.getDate() - 7)));
        
    },

    nextweek : function(component, event, helper){
        var WeekNumber = parseInt(component.get('v.WeekNum')); 
        component.set('v.WeekNum',WeekNumber + 1);
        
        var WeekData = component.get("v.WeekData");
        var firstDay = new Date(WeekData[6].Date);
        
        var first = new Date(WeekData[6].Date);
        
        var date = helper.getFirstDayOfWeek(first.setDate(first.getDate() + 7));
        component.set('v.selectedMonth',date.getMonth());
        component.set('v.yr',date.getFullYear());
        helper.setDates(component, helper, helper.getFirstDayOfWeek(firstDay.setDate(firstDay.getDate() + 7)));
        
    },

    getSelectedMonth : function(component,event,helper){
                component.set("v.showSpinner",true);
                helper.getSelectedMonthData(component,event,helper);
    }
})