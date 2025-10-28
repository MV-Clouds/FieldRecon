({
    doInit : function(component, event, helper) {
        helper.doInit(component, event, helper);
    },

    selectDate : function(component, event, helper){
        
        if(component.get('v.JobId') != '' && component.get('v.User.Id') != '' ){
            helper.toast.info('Please select only one either Job or Crew to get the timesheet!');
        }else if (component.get('v.JobId') == '' && component.get('v.User.Id') == '' ){
            helper.toast.info('Please select Job or Crew to get the timesheet!');
        }else{

            helper.NewgetTimeSheetData(component, event, helper, component.get('v.SelectedDate'));
        }
    },

    currentWeek : function(component, event, helper){
        
        if(component.get('v.JobId') != '' && component.get('v.User.Id') != '' ){
            helper.toast.info('Please select only one either Job or Crew to get the timesheet!');
        }else if (component.get('v.JobId') == '' && component.get('v.User.Id') == '' ){
            helper.toast.info('Please select Job or Crew to get the timesheet!');
        }else{
            component.set('v.showSpinner',true);
            var d = new Date();
            var weekNumber = helper.getWeekNumber(d);
            component.set('v.WeekNumber',weekNumber);
            helper.getTimeSheetData(component, event, helper);
            var WeekNumber = parseInt(component.get('v.WeekNumber'));

            helper.setDates(component, helper, helper.getDateOfWeek(WeekNumber,weekNumber));
            component.set('v.SelectedDate',d.getFullYear()+'-'+(parseInt(d.getMonth())+parseInt(1))+'-'+d.getDate());
        }
    },

    generateTimesheet : function(component, event, helper){
        if(component.get('v.JobId') != '' && component.get('v.User.Id') != '' ){
            helper.toast.info('Please select only one either Job or Crew to get the timesheet!');
        }else if (component.get('v.JobId') == '' && component.get('v.User.Id') == '' ){
            helper.toast.info('Please select Job or Crew to get the timesheet!');
        }else{
            helper.getTimeSheetData(component, event, helper);
            component.set('v.showSpinner',true);
        }
    },

    goPrev : function(component, event, helper){
        
        if(component.get('v.JobId') != '' && component.get('v.User.Id') != '' ){
            helper.toast.info('Please select only one either Job or Crew to get the timesheet!');
        }else if (component.get('v.JobId') == '' && component.get('v.User.Id') == '' ){
            helper.toast.info('Please select Job or Crew to get the timesheet!');
        }else{

            var selectedDate = new Date('"'+component.get('v.SelectedDate')+'"');

            var newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), Number(selectedDate.getDate()) - Number(7) );

            var ekdamNewDate = newDate.getFullYear() +'-'+ ( parseInt(newDate.getMonth()) <= 9 ? '0'+newDate.getMonth() : newDate.getMonth() ) +'-'+ ( newDate.getDate() <= 9 ? '0'+newDate.getDate() : newDate.getDate() );

            helper.NewgetTimeSheetData(component, event, helper, ekdamNewDate);

            component.set('v.SelectedDate',newDate.getFullYear()+'-'+(parseInt(newDate.getMonth())+parseInt(1))+'-'+newDate.getDate());

        }
    },

    goNext : function(component, event, helper){
        if(component.get('v.JobId') != '' && component.get('v.User.Id') != '' ){
            helper.toast.info('Please select only one either Job or Crew to get the timesheet!');
        }else if (component.get('v.JobId') == '' && component.get('v.User.Id') == '' ){
            helper.toast.info('Please select Job or Crew to get the timesheet!');
        }else{

            var selectedDate = new Date('"'+component.get('v.SelectedDate')+'"');

            var newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), Number(selectedDate.getDate()) + Number(7) );

            var ekdamNewDate = newDate.getFullYear() +'-'+ ( parseInt(newDate.getMonth()) <= 9 ? '0'+newDate.getMonth() : newDate.getMonth() ) +'-'+ ( newDate.getDate() <= 9 ? '0'+newDate.getDate() : newDate.getDate() );

            helper.NewgetTimeSheetData(component, event, helper, ekdamNewDate);

            component.set('v.SelectedDate',helper.setAllDates(newDate));
            component.set('v.SelectedDate',newDate.getFullYear()+'-'+(parseInt(newDate.getMonth())+parseInt(1))+'-'+newDate.getDate());
            var thisWeek = helper.getWeekNumber(newDate);
        }
    }
})